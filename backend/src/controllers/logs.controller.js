import * as sendLogService from '../services/sendLog.service.js';
import { prisma } from '../lib/prisma.js';

function parseDate(str) {
  if (!str) return undefined;
  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d;
}

export async function sendLogs(req, res) {
  try {
    const filters = {
      userId: req.user.role === 'ADMIN' && req.query.userId ? Number(req.query.userId) : req.user.id,
      campaignId: req.query.campaignId,
      status: req.query.status,
      phone: req.query.phone,
      page: req.query.page,
      limit: req.query.limit,
    };
    const result = await sendLogService.listGlobal(filters);
    res.json(result);
  } catch (err) {
    console.error('[logs sendLogs]', err);
    res.status(500).json({ error: 'Error al obtener logs' });
  }
}

export async function sendLogsByCampaign(req, res) {
  try {
    const campaignId = Number(req.params.campaignId);
    const campaign = await prisma.campaign.findFirst({
      where: { id: campaignId, userId: req.user.id },
    });
    if (!campaign && req.user.role !== 'ADMIN') {
      return res.status(404).json({ error: 'Campaña no encontrada' });
    }
    const where = { campaignId };
    if (req.user.role !== 'ADMIN') where.userId = req.user.id;
    const items = await prisma.sendLog.findMany({
      where,
      orderBy: { createdAt: 'asc' },
    });
    res.json({ items });
  } catch (err) {
    console.error('[logs sendLogsByCampaign]', err);
    res.status(500).json({ error: 'Error al obtener logs de campaña' });
  }
}

export async function auditLogs(req, res) {
  try {
    const where = {};
    if (req.query.userId) where.userId = Number(req.query.userId);
    if (req.query.action) where.action = req.query.action;

    const from = parseDate(req.query.from);
    const to = parseDate(req.query.to);
    if (req.query.from && from === null) return res.status(400).json({ error: 'Fecha "from" inválida' });
    if (req.query.to && to === null) return res.status(400).json({ error: 'Fecha "to" inválida' });
    if (from) where.createdAt = { ...where.createdAt, gte: from };
    if (to) where.createdAt = { ...where.createdAt, lte: to };

    const items = await prisma.auditLog.findMany({
      where,
      include: { user: { select: { name: true, email: true } } },
      orderBy: { createdAt: 'desc' },
      take: Math.min(200, Number(req.query.limit) || 50),
    });
    res.json({ items });
  } catch (err) {
    console.error('[logs auditLogs]', err);
    res.status(500).json({ error: 'Error al obtener audit logs' });
  }
}

export async function exportCampaignLogs(req, res) {
  try {
    const campaignId = Number(req.params.campaignId);
    const campaign = await prisma.campaign.findFirst({
      where: { id: campaignId, userId: req.user.id },
    });
    if (!campaign) return res.status(404).json({ error: 'Campaña no encontrada' });

    const items = await prisma.sendLog.findMany({
      where: { campaignId },
      orderBy: { createdAt: 'asc' },
    });
    const header = 'phone,messageBody,status,errorCode,errorMessage,sentAt,createdAt\n';
    const rows = items.map((r) => {
      const msg = (r.messageBody || '').replace(/"/g, '""');
      const err = (r.errorMessage || '').replace(/"/g, '""');
      return `${r.phone},"${msg}",${r.status},${r.errorCode || ''},"${err}",${r.sentAt?.toISOString() || ''},${r.createdAt.toISOString()}`;
    });
    const csv = '\uFEFF' + header + rows.join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="send-logs-${campaignId}.csv"`);
    res.send(csv);
  } catch (err) {
    console.error('[logs exportCampaignLogs]', err);
    res.status(500).json({ error: 'Error al exportar logs' });
  }
}
