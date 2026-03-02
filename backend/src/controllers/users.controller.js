import bcrypt from 'bcrypt';
import { prisma } from '../lib/prisma.js';

const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 256;
const MAX_NAME_LENGTH = 100;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const VALID_ROLES = new Set(['ADMIN', 'OPERATOR']);

export async function list(req, res) {
  try {
    const users = await prisma.user.findMany({
      select: { id: true, name: true, email: true, role: true, isActive: true, lastLoginAt: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });
    res.json(users);
  } catch (err) {
    console.error('[users list]', err);
    res.status(500).json({ error: 'Error al obtener usuarios' });
  }
}

export async function getOne(req, res) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'ID inválido' });
    const user = await prisma.user.findUnique({
      where: { id },
      select: { id: true, name: true, email: true, role: true, isActive: true, lastLoginAt: true, createdAt: true },
    });
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
    res.json(user);
  } catch (err) {
    console.error('[users getOne]', err);
    res.status(500).json({ error: 'Error al obtener usuario' });
  }
}

export async function create(req, res) {
  try {
    const { name, email, password, role } = req.body;

    const nameTrimmed = typeof name === 'string' ? name.trim() : '';
    const emailNorm = typeof email === 'string' ? email.trim().toLowerCase() : '';
    const pass = typeof password === 'string' ? password : '';

    if (!nameTrimmed || !emailNorm || !pass) {
      return res.status(400).json({ error: 'Nombre, email y contraseña requeridos' });
    }
    if (nameTrimmed.length > MAX_NAME_LENGTH) {
      return res.status(400).json({ error: `El nombre no puede superar ${MAX_NAME_LENGTH} caracteres` });
    }
    if (!EMAIL_REGEX.test(emailNorm)) {
      return res.status(400).json({ error: 'Formato de email no válido' });
    }
    if (pass.length < MIN_PASSWORD_LENGTH) {
      return res.status(400).json({ error: `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres` });
    }
    if (pass.length > MAX_PASSWORD_LENGTH) {
      return res.status(400).json({ error: 'La contraseña no puede superar 256 caracteres' });
    }
    const assignedRole = role || 'OPERATOR';
    if (!VALID_ROLES.has(assignedRole)) {
      return res.status(400).json({ error: 'Rol inválido' });
    }

    const existing = await prisma.user.findUnique({ where: { email: emailNorm } });
    if (existing) return res.status(400).json({ error: 'El email ya está registrado' });

    const passwordHash = await bcrypt.hash(pass, 12);
    const user = await prisma.user.create({
      data: { name: nameTrimmed, email: emailNorm, passwordHash, role: assignedRole },
      select: { id: true, name: true, email: true, role: true, isActive: true },
    });
    req.auditResourceId = user.id;
    res.status(201).json(user);
  } catch (err) {
    console.error('[users create]', err);
    res.status(500).json({ error: 'Error al crear usuario' });
  }
}

export async function update(req, res) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'ID inválido' });

    const { name, role, isActive } = req.body;
    if (role != null && !VALID_ROLES.has(role)) {
      return res.status(400).json({ error: 'Rol inválido' });
    }
    if (name != null && String(name).trim().length > MAX_NAME_LENGTH) {
      return res.status(400).json({ error: `El nombre no puede superar ${MAX_NAME_LENGTH} caracteres` });
    }

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

    const updated = await prisma.user.update({
      where: { id },
      data: {
        ...(name != null && { name: String(name).trim() }),
        ...(role != null && { role }),
        ...(typeof isActive === 'boolean' && { isActive }),
      },
      select: { id: true, name: true, email: true, role: true, isActive: true },
    });
    req.auditResourceId = id;
    res.json(updated);
  } catch (err) {
    console.error('[users update]', err);
    res.status(500).json({ error: 'Error al actualizar usuario' });
  }
}

export async function resetPassword(req, res) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'ID inválido' });

    const newPassword = typeof req.body.newPassword === 'string' ? req.body.newPassword : '';
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      return res.status(400).json({ error: `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres` });
    }
    if (newPassword.length > MAX_PASSWORD_LENGTH) {
      return res.status(400).json({ error: 'La contraseña no puede superar 256 caracteres' });
    }

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({ where: { id }, data: { passwordHash } });
    req.auditResourceId = id;
    res.json({ ok: true });
  } catch (err) {
    console.error('[users resetPassword]', err);
    res.status(500).json({ error: 'Error al restablecer contraseña' });
  }
}
