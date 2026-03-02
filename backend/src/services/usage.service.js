import { prisma } from '../lib/prisma.js';

const LIMIT_24H = 80;

/**
 * Ventana móvil: mensajes SENT en las últimas 24 horas (por sentAt).
 * Devuelve usado, límite y restantes para mostrar en UI y validar envíos.
 */
export async function getUsage24h(userId) {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const usedLast24h = await prisma.sendLog.count({
    where: {
      userId,
      status: 'SENT',
      sentAt: { gte: since },
    },
  });

  const remaining = Math.max(0, LIMIT_24H - usedLast24h);

  return {
    usedLast24h,
    limit24h: LIMIT_24H,
    remaining24h: remaining,
  };
}

export function getLimit24h() {
  return LIMIT_24H;
}
