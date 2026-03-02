import { Queue, Worker } from 'bullmq';
import { readFile } from 'fs/promises';
import { getRedis } from '../lib/redis.js';
import { getClient } from './whatsappPool.service.js';
import { resolveTemplate } from './template.service.js';
import { resolveSpintax } from '../lib/spintax.js';
import { prisma } from '../lib/prisma.js';
import * as sendLogService from './sendLog.service.js';
import * as usageService from './usage.service.js';
import { emitToUser } from '../lib/sse.js';

const QUEUE_NAME = 'campaign';

let _campaignQueue = null;

function getCampaignQueue() {
  if (!_campaignQueue) {
    _campaignQueue = new Queue(QUEUE_NAME, {
      connection: getRedis(),
      defaultJobOptions: {
        attempts: 2,
        backoff: { type: 'fixed', delay: 5000 },
        removeOnComplete: { count: 500 },
      },
    });
  }
  return _campaignQueue;
}

/**
 * Retardo no-uniforme con distribución gaussiana (Box-Muller).
 * Media = 45 s, desviación = 15 s, rango forzado [20 s, 90 s].
 * Optimizado para cuentas nuevas con bajo volumen de mensajes personales.
 * Simula cadencia humana real para evitar detección de patrones en WA.
 */
function humanDelay() {
  const u1 = Math.random() || 1e-10;
  const u2 = Math.random();
  const z  = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
  const ms = Math.round((45 + z * 15) * 1000);
  return Math.max(20_000, Math.min(90_000, ms));
}

export async function enqueueCampaign(campaignId, userId, recipients, template, initialDelay = 0) {
  const jobs = [];
  let delay = initialDelay;
  for (let i = 0; i < recipients.length; i++) {
    if (i > 0) delay += humanDelay();
    const rec = recipients[i];
    let vars = {};
    try {
      vars = typeof rec.variables === 'string' ? JSON.parse(rec.variables) : rec.variables || {};
    } catch (_) {}
    // Primero resuelve variables {{nombre}}, luego aplica spintax {a|b|c}
    // Cada destinatario recibe una variación aleatoria diferente
    const messageBody = resolveSpintax(resolveTemplate(template.body, vars));
    jobs.push({
      name: 'send-message',
      data: {
        campaignId,
        userId,
        recipientId: rec.id,
        phone: rec.phone,
        messageBody,
        mediaType: template.mediaType || null,
        mediaPath: template.mediaPath || null,
      },
      opts: { delay, jobId: `${campaignId}-${rec.id}` },
    });
  }
  await getCampaignQueue().addBulk(jobs);
}

async function checkAndComplete(campaignId) {
  const c = await prisma.campaign.findFirst({
    where: { id: campaignId },
    select: { sentCount: true, failedCount: true, totalRecipients: true, status: true },
  });
  if (c && c.status === 'RUNNING' && c.sentCount + c.failedCount >= c.totalRecipients) {
    await prisma.campaign.update({
      where: { id: campaignId },
      data: { status: 'COMPLETED', finishedAt: new Date() },
    });
  }
}

let workerInstance = null;

export function startWorker() {
  if (workerInstance) return workerInstance;

  workerInstance = new Worker(
    QUEUE_NAME,
    async (job) => {
      const { campaignId, userId, recipientId, phone, messageBody, mediaType, mediaPath } = job.data;
      const client = getClient(userId);

      // Transicionar SCHEDULED → RUNNING cuando el primer job se ejecuta
      await prisma.campaign.updateMany({
        where: { id: campaignId, status: 'SCHEDULED' },
        data: { status: 'RUNNING', startedAt: new Date() },
      });

      const { usedLast24h, limit24h } = await usageService.getUsage24h(userId);
      if (usedLast24h >= limit24h) {
        await prisma.campaignRecipient.updateMany({
          where: { id: recipientId },
          data: { status: 'FAILED', errorMsg: `Límite de ${limit24h} mensajes en 24 h alcanzado` },
        });
        await prisma.campaign.update({
          where: { id: campaignId },
          data: { failedCount: { increment: 1 } },
        });
        await sendLogService.create({
          campaignId,
          recipientId,
          userId,
          phone,
          messageBody,
          status: 'FAILED',
          errorCode: 'LIMIT_24H',
          errorMessage: `Límite de ${limit24h} mensajes en 24 h alcanzado`,
        });
        await checkAndComplete(campaignId);
        emitProgress(campaignId, userId);
        return;
      }

      if (!client) {
        await prisma.campaignRecipient.updateMany({
          where: { id: recipientId },
          data: { status: 'FAILED', errorMsg: 'WhatsApp no conectado' },
        });
        await prisma.campaign.update({
          where: { id: campaignId },
          data: { failedCount: { increment: 1 } },
        });
        await sendLogService.create({
          campaignId,
          recipientId,
          userId,
          phone,
          messageBody,
          status: 'FAILED',
          errorCode: 'NO_CLIENT',
          errorMessage: 'WhatsApp no conectado',
        });
        await checkAndComplete(campaignId);
        emitProgress(campaignId, userId);
        return;
      }

      // Baileys usa "número@s.whatsapp.net" para DMs y "número@g.us" para grupos
      const chatId = phone.includes('@') ? phone : `${phone.replace(/\D/g, '')}@s.whatsapp.net`;

      try {
        if (mediaType === 'image' && mediaPath) {
          const buffer = await readFile(mediaPath);
          await client.sendMessage(chatId, { image: buffer, caption: messageBody || undefined });
        } else if (mediaType === 'audio' && mediaPath) {
          const buffer = await readFile(mediaPath);
          await client.sendMessage(chatId, { audio: buffer, ptt: true });
          if (messageBody) await client.sendMessage(chatId, { text: messageBody });
        } else {
          await client.sendMessage(chatId, { text: messageBody });
        }
        await prisma.campaignRecipient.updateMany({
          where: { id: recipientId },
          data: { status: 'SENT', sentAt: new Date() },
        });
        await prisma.campaign.update({
          where: { id: campaignId },
          data: { sentCount: { increment: 1 } },
        });
        await sendLogService.create({
          campaignId,
          recipientId,
          userId,
          phone,
          messageBody,
          status: 'SENT',
          sentAt: new Date(),
        });
      } catch (err) {
        await prisma.campaignRecipient.updateMany({
          where: { id: recipientId },
          data: { status: 'FAILED', errorMsg: err.message?.slice(0, 500) },
        });
        await prisma.campaign.update({
          where: { id: campaignId },
          data: { failedCount: { increment: 1 } },
        });
        await sendLogService.create({
          campaignId,
          recipientId,
          userId,
          phone,
          messageBody,
          status: 'FAILED',
          errorCode: err.name || 'Error',
          errorMessage: err.message?.slice(0, 500),
          attemptCount: job.attemptsMade + 1,
        });
      }
      await checkAndComplete(campaignId);
      emitProgress(campaignId, userId);
    },
    { connection: getRedis(), concurrency: 1 }
  );

  workerInstance.on('failed', (job, err) => {
    console.error('[queue] job failed', job?.id, err.message);
  });

  return workerInstance;
}

async function emitProgress(campaignId, userId) {
  const c = await prisma.campaign.findFirst({
    where: { id: campaignId, userId },
    select: { sentCount: true, failedCount: true, totalRecipients: true, status: true },
  });
  if (c) {
    const pending = c.totalRecipients - c.sentCount - c.failedCount;
    emitToUser(userId, 'campaign_progress', {
      campaignId,
      sent: c.sentCount,
      failed: c.failedCount,
      pending,
      total: c.totalRecipients,
      status: c.status,
    });
  }
}

export async function pauseCampaign(campaignId) {
  const jobs = await getCampaignQueue().getJobs(['delayed', 'waiting']);
  const toRemove = jobs.filter(j => j.data.campaignId === campaignId);
  for (const j of toRemove) {
    await j.remove();
  }
  const running = await prisma.campaignRecipient.updateMany({
    where: { campaignId, status: 'PENDING' },
    data: { status: 'CANCELLED' },
  });
  await prisma.campaign.update({
    where: { id: campaignId },
    data: { status: 'CANCELLED', finishedAt: new Date() },
  });
  return { removed: toRemove.length, cancelled: running.count };
}
