import { prisma } from '../lib/prisma.js';
import { resolveSpintax } from '../lib/spintax.js';

const VARIABLE_REGEX = /\{\{(\w+)\}\}/g;

function parseParts(val) {
  if (Array.isArray(val)) return val;
  if (typeof val === 'string') {
    try {
      return JSON.parse(val || '[]');
    } catch (_) {
      return [];
    }
  }
  return [];
}

function pickRandom(arr) {
  if (!arr || arr.length === 0) return '';
  return arr[Math.floor(Math.random() * arr.length)];
}

/** Extrae nombres de variables {{x}} de todos los textos de saludos, cuerpos y ctas */
export function extractVariables(parts) {
  const set = new Set();
  const texts = [
    ...parseParts(parts.saludos),
    ...parseParts(parts.cuerpos),
    ...parseParts(parts.ctas),
  ].filter(Boolean);
  const text = texts.join('\n');
  let m;
  const re = new RegExp(VARIABLE_REGEX.source, 'g');
  while ((m = re.exec(text)) !== null) {
    set.add(m[1]);
  }
  return [...set];
}

export function resolveTemplate(body, variables = {}) {
  if (!body) return '';
  return body.replace(VARIABLE_REGEX, (_, key) => variables[key] ?? `{{${key}}}`);
}

/**
 * Construye el mensaje: una opción al azar de Saludo, Cuerpo y CTA,
 * unidas con doble salto de línea; aplica variables y spintax.
 * Si no hay partes, usa template.body (legacy).
 */
export function buildMessageFromParts(template, variables = {}) {
  const saludos = parseParts(template?.saludos);
  const cuerpos = parseParts(template?.cuerpos);
  const ctas = parseParts(template?.ctas);
  const hasParts = saludos.length > 0 || cuerpos.length > 0 || ctas.length > 0;

  const raw = hasParts
    ? [pickRandom(saludos), pickRandom(cuerpos), pickRandom(ctas)].filter(Boolean).join('\n\n')
    : (template?.body || '');
  return resolveSpintax(resolveTemplate(raw, variables));
}

export async function listByUser(userId) {
  return prisma.template.findMany({
    where: { userId },
    orderBy: { updatedAt: 'desc' },
  });
}

export async function getById(id, userId) {
  return prisma.template.findFirst({
    where: { id: Number(id), userId },
  });
}

export async function create(userId, data) {
  const name = (data.name || '').trim();
  const saludos = Array.isArray(data.saludos) ? data.saludos.map(String) : [];
  const cuerpos = Array.isArray(data.cuerpos) ? data.cuerpos.map(String) : [];
  const ctas = Array.isArray(data.ctas) ? data.ctas.map(String) : [];

  const hasCuerpo = cuerpos.some((c) => String(c).trim() !== '');
  if (!hasCuerpo) {
    throw new Error('El cuerpo del mensaje debe tener al menos una variante con texto.');
  }

  const variables = JSON.stringify(extractVariables({ saludos, cuerpos, ctas }));

  return prisma.template.create({
    data: {
      userId,
      name,
      body: '',
      variables,
      saludos: JSON.stringify(saludos),
      cuerpos: JSON.stringify(cuerpos),
      ctas: JSON.stringify(ctas),
      mediaType: data.mediaType ?? null,
      mediaPath: data.mediaPath ?? null,
      mediaName: data.mediaName ?? null,
    },
  });
}

export async function update(id, userId, data) {
  const existing = await getById(id, userId);
  if (!existing) return null;

  const saludos = data.saludos !== undefined
    ? (Array.isArray(data.saludos) ? data.saludos.map(String) : [])
    : parseParts(existing.saludos);
  const cuerpos = data.cuerpos !== undefined
    ? (Array.isArray(data.cuerpos) ? data.cuerpos.map(String) : [])
    : parseParts(existing.cuerpos);
  const ctas = data.ctas !== undefined
    ? (Array.isArray(data.ctas) ? data.ctas.map(String) : [])
    : parseParts(existing.ctas);

  const hasCuerpo = cuerpos.some((c) => String(c).trim() !== '');
  if (!hasCuerpo) {
    throw new Error('El cuerpo del mensaje debe tener al menos una variante con texto.');
  }

  const variables = JSON.stringify(extractVariables({ saludos, cuerpos, ctas }));

  const updatePayload = {
    name: data.name !== undefined ? String(data.name).trim() : existing.name,
    variables,
    saludos: JSON.stringify(saludos),
    cuerpos: JSON.stringify(cuerpos),
    ctas: JSON.stringify(ctas),
  };

  if (data.mediaType !== undefined) updatePayload.mediaType = data.mediaType;
  if (data.mediaPath !== undefined) updatePayload.mediaPath = data.mediaPath;
  if (data.mediaName !== undefined) updatePayload.mediaName = data.mediaName;

  await prisma.template.updateMany({
    where: { id: Number(id), userId },
    data: updatePayload,
  });

  return getById(id, userId);
}

export async function remove(id, userId) {
  const r = await prisma.template.deleteMany({
    where: { id: Number(id), userId },
  });
  return r.count > 0;
}
