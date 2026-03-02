import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { prisma } from '../lib/prisma.js';
import { getRedis } from '../lib/redis.js';
import { logAction } from '../services/audit.service.js';

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;
if (!JWT_SECRET || !JWT_REFRESH_SECRET) {
  throw new Error('JWT_SECRET y JWT_REFRESH_SECRET deben estar definidos en el entorno');
}

const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '15m';
const JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '7d';

function signAccessToken(userId) {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

function signRefreshToken(userId) {
  return jwt.sign({ userId }, JWT_REFRESH_SECRET, { expiresIn: JWT_REFRESH_EXPIRES_IN });
}

const REFRESH_COOKIE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
  maxAge: REFRESH_COOKIE_TTL_MS,
  path: '/api/auth',
};

// Blacklist de refresh tokens revocados (clave en Redis con TTL automático)
async function revokeRefreshToken(token) {
  try {
    const decoded = jwt.decode(token);
    if (!decoded?.exp) return;
    const ttl = decoded.exp - Math.floor(Date.now() / 1000);
    if (ttl > 0) {
      await getRedis().set(`rt_revoked:${token}`, '1', 'EX', ttl);
    }
  } catch (err) {
    // Si Redis no está disponible el token no se revoca — loguear para visibilidad
    console.warn('[auth] revokeRefreshToken: no se pudo revocar token (Redis caído?):', err.message);
  }
}

async function isRefreshTokenRevoked(token) {
  try {
    const val = await getRedis().get(`rt_revoked:${token}`);
    return val !== null;
  } catch (_) {
    return false;
  }
}

// Límites para evitar abusos (payloads enormes, etc.)
const MAX_PASSWORD_LENGTH = 256;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function login(req, res) {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email y contraseña requeridos' });
    }
    const emailNorm = String(email).trim().toLowerCase();
    if (!EMAIL_REGEX.test(emailNorm)) {
      return res.status(400).json({ error: 'Formato de email no válido' });
    }
    if (String(password).length > MAX_PASSWORD_LENGTH) {
      return res.status(400).json({ error: 'Credenciales inválidas' });
    }

    const user = await prisma.user.findUnique({ where: { email: emailNorm } });
    if (!user || !user.isActive) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

    const accessToken = signAccessToken(user.id);
    const refreshToken = signRefreshToken(user.id);
    res.cookie('refreshToken', refreshToken, cookieOptions);

    try {
      await logAction({ userId: user.id, action: 'LOGIN', req });
    } catch (auditErr) {
      console.error('[auth audit]', auditErr);
    }

    res.json({
      accessToken,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    });
  } catch (err) {
    console.error('[auth login]', err);
    res.status(500).json({ error: 'Error al iniciar sesión' });
  }
}

export async function refresh(req, res) {
  const token = req.cookies?.refreshToken;
  if (!token) return res.status(401).json({ error: 'No autorizado' });

  try {
    if (await isRefreshTokenRevoked(token)) {
      res.clearCookie('refreshToken', { path: '/api/auth' });
      return res.status(401).json({ error: 'Sesión revocada' });
    }

    const decoded = jwt.verify(token, JWT_REFRESH_SECRET);
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, name: true, email: true, role: true, isActive: true },
    });

    if (!user || !user.isActive) {
      res.clearCookie('refreshToken', { path: '/api/auth' });
      return res.status(401).json({ error: 'No autorizado' });
    }

    // Rotar el refresh token: revocar el anterior, emitir uno nuevo
    await revokeRefreshToken(token);
    const newRefreshToken = signRefreshToken(user.id);
    const accessToken = signAccessToken(user.id);
    res.cookie('refreshToken', newRefreshToken, cookieOptions);

    res.json({
      accessToken,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    });
  } catch (err) {
    res.clearCookie('refreshToken', { path: '/api/auth' });
    return res.status(401).json({ error: 'No autorizado' });
  }
}

export async function logout(req, res) {
  const token = req.cookies?.refreshToken;
  if (token) await revokeRefreshToken(token);

  if (req.user) {
    try { await logAction({ userId: req.user.id, action: 'LOGOUT', req }); } catch (_) {}
  }

  res.clearCookie('refreshToken', { path: '/api/auth' });
  res.json({ ok: true });
}

export async function me(req, res) {
  res.json({ user: req.user });
}

export async function changePassword(req, res) {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Contraseña actual y nueva requeridas' });
    }
    const newPass = String(newPassword);
    if (newPass.length < 8) {
      return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres' });
    }
    if (newPass.length > MAX_PASSWORD_LENGTH) {
      return res.status(400).json({ error: 'La contraseña no puede superar 256 caracteres' });
    }
    if (String(currentPassword).length > MAX_PASSWORD_LENGTH) {
      return res.status(400).json({ error: 'Datos inválidos' });
    }

    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) return res.status(400).json({ error: 'Contraseña actual incorrecta' });

    const passwordHash = await bcrypt.hash(newPass, 12);
    await prisma.user.update({ where: { id: req.user.id }, data: { passwordHash } });

    // Revocar todos los tokens activos forzando re-login (por seguridad)
    const currentToken = req.cookies?.refreshToken;
    if (currentToken) await revokeRefreshToken(currentToken);
    res.clearCookie('refreshToken', { path: '/api/auth' });

    await logAction({ userId: req.user.id, action: 'CHANGE_PASSWORD', req });
    res.json({ ok: true, reloginRequired: true });
  } catch (err) {
    console.error('[changePassword]', err);
    res.status(500).json({ error: 'Error al cambiar contraseña' });
  }
}
