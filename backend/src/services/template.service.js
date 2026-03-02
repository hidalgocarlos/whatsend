import { prisma } from '../lib/prisma.js';

const VARIABLE_REGEX = /\{\{(\w+)\}\}/g;

export function extractVariables(body) {
  const set = new Set();
  let m;
  while ((m = VARIABLE_REGEX.exec(body)) !== null) {
    set.add(m[1]);
  }
  return [...set];
}

export function resolveTemplate(body, variables = {}) {
  return body.replace(VARIABLE_REGEX, (_, key) => variables[key] ?? `{{${key}}}`);
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

export async function create(userId, { name, body, mediaType = null, mediaPath = null, mediaName = null }) {
  const variables = JSON.stringify(extractVariables(body));
  return prisma.template.create({
    data: { userId, name: name.trim(), body, variables, mediaType, mediaPath, mediaName },
  });
}

/**
 * fields puede incluir: name, body, mediaType, mediaPath, mediaName
 * Para borrar media, el controller pasa mediaType/mediaPath/mediaName = null explícitamente.
 */
export async function update(id, userId, fields) {
  const data = {};

  if (fields.name != null) data.name = fields.name.trim();
  if (fields.body != null) {
    data.body = fields.body;
    data.variables = JSON.stringify(extractVariables(fields.body));
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
