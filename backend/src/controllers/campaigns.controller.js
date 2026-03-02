import { prisma } from '../lib/prisma.js';
import * as templateService from '../services/template.service.js';
import * as queueService from '../services/queue.service.js';
import * as usageService from '../services/usage.service.js';

const MAX_RECIPIENTS = 100;
const VALID_CAMPAIGN_STATUSES = new Set(['SCHEDULED', 'PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED']);

export async function list(req, res) {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 10));
    const status = req.query.status;
    const where = { userId: req.user.id };
    if (status) {
      if (!VALID_CAMPAIGN_STATUSES.has(status)) {
        return res.status(400).json({ error: 'Estado de campaña inválido' });
      }
      where.status = status;
    }

    const [items, total] = await Promise.all([
      prisma.campaign.findMany({
        where,
        include: { template: { select: { name: true } }, contactList: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.campaign.count({ where }),
    ]);
    res.json({ items, total, page, limit });
  } catch (err) {
    console.error('[campaigns list]', err);
    res.status(500).json({ error: 'Error al obtener campañas' });
  }
}

export async function getOne(req, res) {
  try {
    const id = Number(req.params.id);
    const campaign = await prisma.campaign.findFirst({
      where: { id, userId: req.user.id },
      include: {
        template: true,
        contactList: true,
        recipients: true,
      },
    });
    if (!campaign) return res.status(404).json({ error: 'Campaña no encontrada' });
    res.json(campaign);
  } catch (err) {
    console.error('[campaigns getOne]', err);
    res.status(500).json({ error: 'Error al obtener campaña' });
  }
}

export async function create(req, res) {
  const { templateId, contactListId, scheduledAt, tagFilter } = req.body;
  const tid = Number(templateId);
  const cid = Number(contactListId);
  if (!tid || !cid) {
    return res.status(400).json({ error: 'templateId y contactListId requeridos' });
  }

  // Validar y calcular initialDelay si la campaña está programada
  let initialDelay = 0;
  let campaignStatus = 'PENDING';
  let scheduledDate = null;

  if (scheduledAt) {
    scheduledDate = new Date(scheduledAt);
    if (isNaN(scheduledDate.getTime())) {
      return res.status(400).json({ error: 'Fecha de programación inválida' });
    }
    initialDelay = scheduledDate.getTime() - Date.now();
    if (initialDelay < 60_000) {
      return res.status(400).json({ error: 'La fecha de programación debe ser al menos 1 minuto en el futuro' });
    }
    campaignStatus = 'SCHEDULED';
  }

  const [template, contactList] = await Promise.all([
    prisma.template.findFirst({ where: { id: tid, userId: req.user.id } }),
    prisma.contactList.findFirst({ where: { id: cid, userId: req.user.id }, include: { items: true } }),
  ]);

  if (!template) return res.status(404).json({ error: 'Plantilla no encontrada' });
  if (!contactList) return res.status(404).json({ error: 'Lista no encontrada' });

  // Filtrar por tags si se especificaron
  const activeTags = Array.isArray(tagFilter) ? tagFilter.map(t => String(t).trim().toLowerCase()).filter(Boolean) : [];
  const filteredItems = activeTags.length > 0
    ? contactList.items.filter(item => {
        let itemTags = [];
        try { itemTags = JSON.parse(item.tags || '[]'); } catch (_) {}
        return itemTags.some(t => activeTags.includes(t));
      })
    : contactList.items;

  if (filteredItems.length > MAX_RECIPIENTS) {
    return res.status(400).json({ error: `Máximo ${MAX_RECIPIENTS} destinatarios por campaña` });
  }
  if (filteredItems.length === 0) {
    return res.status(400).json({
      error: activeTags.length > 0
        ? 'Ningún contacto tiene los tags seleccionados'
        : 'La lista no tiene contactos',
    });
  }

  const { remaining24h } = await usageService.getUsage24h(req.user.id);
  if (filteredItems.length > remaining24h) {
    return res.status(400).json({
      error: `Límite de ${usageService.getLimit24h()} mensajes en 24 h. Te quedan ${remaining24h} envíos; esta campaña tiene ${filteredItems.length} destinatarios.`,
      remaining24h,
    });
  }

  const campaign = await prisma.campaign.create({
    data: {
      userId: req.user.id,
      templateId: tid,
      contactListId: cid,
      status: campaignStatus,
      scheduledAt: scheduledDate,
      totalRecipients: filteredItems.length,
      recipients: {
        create: filteredItems.map((item) => ({
          phone: item.phone,
          variables: item.variables,
        })),
      },
    },
    include: { recipients: true },
  });

  try {
    queueService.startWorker();
    await queueService.enqueueCampaign(
      campaign.id,
      req.user.id,
      campaign.recipients,
      {
        body: template.body,
        saludos: template.saludos,
        cuerpos: template.cuerpos,
        ctas: template.ctas,
        mediaType: template.mediaType,
        mediaPath: template.mediaPath,
      },
      initialDelay
    );
  } catch (err) {
    await prisma.campaign.update({
      where: { id: campaign.id },
      data: { status: 'FAILED', finishedAt: new Date() },
    });
    return res.status(503).json({ error: 'Servicio de colas no disponible. Revisa Redis.' });
  }

  // Solo marca RUNNING inmediatamente si no está programada
  if (!scheduledDate) {
    await prisma.campaign.update({
      where: { id: campaign.id },
      data: { status: 'RUNNING', startedAt: new Date() },
    });
  }

  req.auditResourceId = campaign.id;
  res.status(201).json({ campaignId: campaign.id, scheduled: !!scheduledDate, scheduledAt: scheduledDate });
}

export async function cancel(req, res) {
  try {
    const id = Number(req.params.id);
    const campaign = await prisma.campaign.findFirst({
      where: { id, userId: req.user.id },
    });
    if (!campaign) return res.status(404).json({ error: 'Campaña no encontrada' });
    if (!['RUNNING', 'PENDING', 'SCHEDULED'].includes(campaign.status)) {
      return res.status(400).json({ error: 'La campaña no está en curso' });
    }
    const result = await queueService.pauseCampaign(id);
    req.auditResourceId = id;
    res.json({ ok: true, ...result });
  } catch (err) {
    console.error('[campaigns cancel]', err);
    res.status(500).json({ error: 'Error al cancelar campaña' });
  }
}

export async function eventsStream(req, res) {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  const campaignId = Number(req.params.id);
  const campaign = await prisma.campaign.findFirst({
    where: { id: campaignId, userId: req.user.id },
    select: { sentCount: true, failedCount: true, totalRecipients: true, status: true },
  });
  if (!campaign) {
    res.write(`event: error\ndata: ${JSON.stringify({ error: 'Campaña no encontrada' })}\n\n`);
    res.end();
    return;
  }

  const payload = {
    sent: campaign.sentCount,
    failed: campaign.failedCount,
    pending: campaign.totalRecipients - campaign.sentCount - campaign.failedCount,
    total: campaign.totalRecipients,
    status: campaign.status,
  };
  res.write(`event: progress\ndata: ${JSON.stringify(payload)}\n\n`);

  const interval = setInterval(async () => {
    try {
      const updated = await prisma.campaign.findFirst({
        where: { id: campaignId, userId: req.user.id },
        select: { sentCount: true, failedCount: true, totalRecipients: true, status: true },
      });
      if (!updated) return;
      const next = {
        sent: updated.sentCount,
        failed: updated.failedCount,
        pending: updated.totalRecipients - updated.sentCount - updated.failedCount,
        total: updated.totalRecipients,
        status: updated.status,
      };
      if (!res.writableEnded) res.write(`event: progress\ndata: ${JSON.stringify(next)}\n\n`);
      if (updated.status === 'COMPLETED' || updated.status === 'FAILED' || updated.status === 'CANCELLED') {
        clearInterval(interval);
        if (!res.writableEnded) res.end();
      }
    } catch (err) {
      console.error('[campaigns eventsStream] poll error', err.message);
    }
  }, 2000);

  req.on('close', () => clearInterval(interval));
}

export async function exportCSV(req, res) {
  try {
    const id = Number(req.params.id);
    const campaign = await prisma.campaign.findFirst({
      where: { id, userId: req.user.id },
      include: { recipients: true, template: { select: { name: true } } },
    });
    if (!campaign) return res.status(404).json({ error: 'Campaña no encontrada' });

    const header = 'phone,status,errorMsg,sentAt\n';
    const rows = campaign.recipients.map((r) => {
      const sentAt = r.sentAt ? r.sentAt.toISOString() : '';
      const errorMsg = (r.errorMsg || '').replace(/"/g, '""');
      return `${r.phone},${r.status},"${errorMsg}",${sentAt}`;
    });
    const csv = header + rows.join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="campaign-${id}.csv"`);
    res.send(csv);
  } catch (err) {
    console.error('[campaigns exportCSV]', err);
    res.status(500).json({ error: 'Error al exportar campaña' });
  }
}
