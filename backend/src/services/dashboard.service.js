import { prisma } from '../lib/prisma.js';
import * as usageService from './usage.service.js';

export async function getSummary(userId) {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [sentToday, failedToday, totalSentAllTime, activeCampaigns, runningCount, usage24h] = await Promise.all([
    prisma.sendLog.count({
      where: { userId, status: 'SENT', createdAt: { gte: todayStart } },
    }),
    prisma.sendLog.count({
      where: { userId, status: 'FAILED', createdAt: { gte: todayStart } },
    }),
    prisma.sendLog.count({
      where: { userId, status: 'SENT' },
    }),
    prisma.campaign.findMany({
      where: { userId, status: 'RUNNING' },
      select: { id: true, totalRecipients: true, sentCount: true, failedCount: true, template: { select: { name: true } } },
    }),
    prisma.campaign.count({ where: { userId, status: 'RUNNING' } }),
    usageService.getUsage24h(userId),
  ]);

  const totalToday = sentToday + failedToday;
  const successRate = totalToday > 0 ? Math.round((sentToday / totalToday) * 100) : 0;

  return {
    sentToday,
    failedToday,
    successRateToday: successRate,
    totalSentAllTime,
    activeCampaigns,
    waStatus: runningCount > 0 ? 'active' : 'idle',
    usage24h,
  };
}

export async function getDailyChart(userId, days = 30) {
  const start = new Date();
  start.setDate(start.getDate() - days);
  start.setHours(0, 0, 0, 0);

  const logs = await prisma.sendLog.findMany({
    where: { userId, createdAt: { gte: start } },
    select: { status: true, createdAt: true },
  });

  const dateMap = {};
  for (let d = 0; d < days; d++) {
    const dte = new Date(start);
    dte.setDate(dte.getDate() + d);
    const key = dte.toISOString().slice(0, 10);
    dateMap[key] = { date: key, sent: 0, failed: 0 };
  }
  for (const log of logs) {
    const key = log.createdAt.toISOString().slice(0, 10);
    if (!dateMap[key]) dateMap[key] = { date: key, sent: 0, failed: 0 };
    if (log.status === 'SENT') dateMap[key].sent += 1;
    if (log.status === 'FAILED') dateMap[key].failed += 1;
  }
  return Object.values(dateMap).sort((a, b) => a.date.localeCompare(b.date));
}

export async function getStatusDistribution(userId) {
  const result = await prisma.sendLog.groupBy({
    by: ['status'],
    where: { userId },
    _count: true,
  });
  const map = { SENT: 0, FAILED: 0, CANCELLED: 0 };
  for (const r of result) map[r.status] = r._count;
  return map;
}

export async function getRecentLogs(userId, limit = 20) {
  return prisma.sendLog.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: { id: true, phone: true, status: true, errorMessage: true, createdAt: true, campaignId: true },
  });
}
