import { prisma } from '../lib/prisma.js';
import { resolveSpintax } from '../lib/spintax.js';

const VARIABLE_REGEX = /\{\{(\w+)\}\}/g;

/** Extrae nombres de variables {{x}} de un string o de las partes saludos/cuerpos/ctas */
export function extractVariables(bodyOrParts) {
  const set = new Set();
  let text = '';
  if (typeof bodyOrParts === 'string') {
    text = bodyOrParts;
  } else if (bodyOrParts && typeof bodyOrParts === 'object') {
    const arr = (s) => (Array.isArray(s) ? s : (typeof s === 'string' ? (() => { try { return JSON.parse(s || '[]'); } catch (_) { return []; } })() : []));
    const saludos = arr(bodyOrParts.saludos);
    const cuerpos = arr(bodyOrParts.cuerpos);
    const ctas = arr(bodyOrParts.ctas);
    text = [...saludos, ...cuerpos, ...ctas].filter(Boolean).join('\n');
    if (bodyOrParts.body) text += '\n' + bodyOrParts.body;
  }
  let m;
  while ((m = VARIABLE_REGEX.exec(text)) !== null) {
    set.add(m[1]);
  }
  return [...set];
}

export function resolveTemplate(body, variables = {}) {
  if (!body) return '';
  return body.replace(VARIABLE_REGEX, (_, key) => variables[key] ?? `{{${key}}}`);
}

function parseParts(val) {
  if (Array.isArray(val)) return val;
  if (typeof val === 'string') {
    try { return JSON.parse(val || '[]'); } catch (_) { return []; }
  }
  return [];
}

function pickRandom(arr) {
  if (!arr || arr.length === 0) return '';
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Construye el mensaje final: una opción al azar de cada bloque (saludo, cuerpo, cta),
 * concatenadas con doble salto de línea, luego resolveTemplate y resolveSpintax.
 * Si los tres bloques están vacíos, usa template.body (comportamiento legacy).
 */
export function buildMessageFromParts(template, variables = {}) {
  const saludos = parseParts(template.saludos);
  const cuerpos = parseParts(template.cuerpos);
  const ctas = parseParts(template.ctas);
  const hasParts = saludos.length > 0 || cuerpos.length > 0 || ctas.length > 0;

  let raw;
  if (hasParts) {
    const parts = [
      pickRandom(saludos),
      pickRandom(cuerpos),
      pickRandom(ctas),
    ].filter(Boolean);
    raw = parts.join('\n\n');
  } else {
    raw = template.body || '';
  }
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

export async function create(userId, { name, body = '', saludos = [], cuerpos = [], ctas = [], mediaType = null, mediaPath = null, mediaName = null }) {
  const saludosArr = Array.isArray(saludos) ? saludos : [];
  const cuerposArr = Array.isArray(cuerpos) ? cuerpos : [];
  const ctasArr = Array.isArray(ctas) ? ctas : [];
  const variables = JSON.stringify(extractVariables({ body, saludos: saludosArr, cuerpos: cuerposArr, ctas: ctasArr }));
  const data = {
    userId,
    name: name.trim(),
    body: body || '',
    variables,
    saludos: JSON.stringify(saludosArr),
    cuerpos: JSON.stringify(cuerposArr),
    ctas: JSON.stringify(ctasArr),
    mediaType,
    mediaPath,
    mediaName,
  };
  return prisma.template.create({ data });
}

/**
 * fields puede incluir: name, body, saludos, cuerpos, ctas, mediaType, mediaPath, mediaName
 * Para borrar media, el controller pasa mediaType/mediaPath/mediaName = null explícitamente.
 */
export async function update(id, userId, fields) {
  const data = {};

  if (fields.name != null) data.name = fields.name.trim();
  if (fields.body != null) data.body = fields.body;

  if (Object.prototype.hasOwnProperty.call(fields, 'saludos')) {
    data.saludos = JSON.stringify(Array.isArray(fields.saludos) ? fields.saludos : []);
  }
  if (Object.prototype.hasOwnProperty.call(fields, 'cuerpos')) {
    data.cuerpos = JSON.stringify(Array.isArray(fields.cuerpos) ? fields.cuerpos : []);
  }
  if (Object.prototype.hasOwnProperty.call(fields, 'ctas')) {
    data.ctas = JSON.stringify(Array.isArray(fields.ctas) ? fields.ctas : []);
  }

  const needsVariableRecalc = 'body' in fields || 'saludos' in fields || 'cuerpos' in fields || 'ctas' in fields;
  if (needsVariableRecalc) {
    const existing = await getById(id, userId);
    const body = fields.body !== undefined ? fields.body : (existing?.body ?? '');
    const saludos = 'saludos' in fields ? (Array.isArray(fields.saludos) ? fields.saludos : []) : parseParts(existing?.saludos);
    const cuerpos = 'cuerpos' in fields ? (Array.isArray(fields.cuerpos) ? fields.cuerpos : []) : parseParts(existing?.cuerpos);
    const ctas = 'ctas' in fields ? (Array.isArray(fields.ctas) ? fields.ctas : []) : parseParts(existing?.ctas);
    data.variables = JSON.stringify(extractVariables({ body, saludos, cuerpos, ctas }));
  }

  // Solo tocar campos de media si el controller los incluyó en el objeto
  if (Object.prototype.hasOwnProperty.call(fields, 'mediaType')) data.mediaType = fields.mediaType ?? null;
  if (Object.prototype.hasOwnProperty.call(fields, 'mediaPath')) data.mediaPath = fields.mediaPath ?? null;
  if (Object.prototype.hasOwnProperty.call(fields, 'mediaName')) data.mediaName = fields.mediaName ?? null;

  return prisma.template.updateMany({
    where: { id: Number(id), userId },
    data,
  });
}

export async function remove(id, userId) {
  const r = await prisma.template.deleteMany({
    where: { id: Number(id), userId },
  });
  return r.count > 0;
}
