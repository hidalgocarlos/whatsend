import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma.js';

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) throw new Error('JWT_SECRET no definido en variables de entorno');

/**
 * SSE: EventSource no envía Authorization header, acepta token en query ?token=JWT
 * Los tokens SSE tienen vida corta (15min) y se usan en conexiones de corta duración.
 */
export async function sseAuthMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = req.query.token ||
    (authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null);
  if (!token) return res.status(401).json({ error: 'No autorizado' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, name: true, email: true, role: true, isActive: true },
    });
    if (!user || !user.isActive) return res.status(401).json({ error: 'No autorizado' });
    req.user = user;
    next();
  } catch (_) {
    return res.status(401).json({ error: 'No autorizado' });
  }
}
