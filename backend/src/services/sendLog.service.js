import { prisma } from '../lib/prisma.js';

export async function create(data) {
  return prisma.sendLog.create({
    data: {
      campaignId: data.campaignId,
      recipientId: data.recipientId,
      userId: data.userId,
      phone: data.phone,
      messageBody: data.messageBody,
      status: data.status,
      errorCode: data.errorCode ?? null,
      errorMessage: data.errorMessage ?? null,
      attemptCount: data.attemptCount ?? 1,
      sentAt: data.sentAt ?? null,
    },
  });
}

export async function listGlobal(filters = {}) {
  const where = {};
  if (filters.userId) where.userId = Number(filters.userId);
  if (filters.campaignId) where.campaignId = Number(filters.campaignId);
  if (filters.status) where.status = filters.status;
  if (filters.phone) where.phone = { contains: filters.phone, mode: 'insensitive' };

  const [items, total] = await Promise.all([
    prisma.sendLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: Math.min(Number(filters.limit) || 50, 200),
      skip: (Math.max(1, Number(filters.page) || 1) - 1) * (Number(filters.limit) || 50),
    }),
    prisma.sendLog.count({ where }),
  ]);
  return { items, total };
}
