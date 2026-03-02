import { prisma } from '../lib/prisma.js';

export async function logAction({ userId, action, resource = null, resourceId = null, metadata = null, req = null }) {
  const ip = req?.ip || req?.headers?.['x-forwarded-for']?.split(',')[0]?.trim() || null;
  const userAgent = req?.headers?.['user-agent'] || null;

  await prisma.auditLog.create({
    data: {
      userId,
      action,
      resource,
      resourceId,
      metadata: metadata ? JSON.stringify(metadata) : null,
      ip,
      userAgent,
    },
  });
}
