import fs from 'fs/promises';
import { prisma } from '../lib/prisma.js';
import { processCSVBuffer } from '../services/csv.service.js';
import { uploadCSV } from '../middlewares/upload.middleware.js';

const MAX_ITEMS = 100;

export async function list(req, res) {
  try {
    const lists = await prisma.contactList.findMany({
      where: { userId: req.user.id },
      include: { _count: { select: { items: true } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json(lists.map(l => ({ ...l, itemCount: l._count.items })));
  } catch (err) {
    console.error('[lists list]', err);
    res.status(500).json({ error: 'Error al obtener listas' });
  }
}

export async function getOne(req, res) {
  try {
    const id = Number(req.params.id);
    const list = await prisma.contactList.findFirst({
      where: { id, userId: req.user.id },
      include: { items: true },
    });
    if (!list) return res.status(404).json({ error: 'Lista no encontrada' });
    res.json(list);
  } catch (err) {
    console.error('[lists getOne]', err);
    res.status(500).json({ error: 'Error al obtener lista' });
  }
}

// GET /api/lists/:id/tags — devuelve todos los tags únicos de la lista
export async function getTags(req, res) {
  try {
    const id = Number(req.params.id);
    const list = await prisma.contactList.findFirst({
      where: { id, userId: req.user.id },
      select: { items: { select: { tags: true } } },
    });
    if (!list) return res.status(404).json({ error: 'Lista no encontrada' });

    const unique = new Set();
    for (const item of list.items) {
      let parsed = [];
      try { parsed = JSON.parse(item.tags || '[]'); } catch (_) {}
      for (const t of parsed) if (t) unique.add(t);
    }
    res.json([...unique].sort());
  } catch (err) {
    console.error('[lists getTags]', err);
    res.status(500).json({ error: 'Error al obtener tags' });
  }
}

// PATCH /api/lists/:id/tags — renombrar un tag en toda la lista
export async function renameTag(req, res) {
  try {
    const listId = Number(req.params.id);
    const { oldTag, newTag } = req.body;
    const oldVal = String(oldTag ?? '').trim().toLowerCase();
    const newVal = String(newTag ?? '').trim().toLowerCase();
    if (!oldVal || !newVal) {
      return res.status(400).json({ error: 'oldTag y newTag son requeridos' });
    }
    if (oldVal === newVal) {
      return res.status(400).json({ error: 'El nuevo nombre debe ser distinto' });
    }

    const list = await prisma.contactList.findFirst({
      where: { id: listId, userId: req.user.id },
      include: { items: true },
    });
    if (!list) return res.status(404).json({ error: 'Lista no encontrada' });

    let updated = 0;
    for (const item of list.items) {
      let tags = [];
      try { tags = JSON.parse(item.tags || '[]'); } catch (_) {}
      if (!tags.includes(oldVal)) continue;
      const next = tags.map(t => t === oldVal ? newVal : t);
      await prisma.contactListItem.update({
        where: { id: item.id },
        data: { tags: JSON.stringify(next) },
      });
      updated++;
    }
    res.json({ ok: true, updated });
  } catch (err) {
    console.error('[lists renameTag]', err);
    res.status(500).json({ error: 'Error al renombrar tag' });
  }
}

// DELETE /api/lists/:id/tags — quitar un tag de todos los contactos que lo tengan
export async function deleteTag(req, res) {
  try {
    const listId = Number(req.params.id);
    const tagToRemove = String(req.body?.tag ?? req.query?.tag ?? '').trim().toLowerCase();
    if (!tagToRemove) {
      return res.status(400).json({ error: 'tag es requerido' });
    }

    const list = await prisma.contactList.findFirst({
      where: { id: listId, userId: req.user.id },
      include: { items: true },
    });
    if (!list) return res.status(404).json({ error: 'Lista no encontrada' });

    let updated = 0;
    for (const item of list.items) {
      let tags = [];
      try { tags = JSON.parse(item.tags || '[]'); } catch (_) {}
      if (!tags.includes(tagToRemove)) continue;
      const next = tags.filter(t => t !== tagToRemove);
      await prisma.contactListItem.update({
        where: { id: item.id },
        data: { tags: JSON.stringify(next) },
      });
      updated++;
    }
    res.json({ ok: true, removed: updated });
  } catch (err) {
    console.error('[lists deleteTag]', err);
    res.status(500).json({ error: 'Error al eliminar tag' });
  }
}

// PATCH /api/lists/:id/items/:itemId/tags — reemplaza los tags de un contacto
export async function updateItemTags(req, res) {
  try {
    const listId  = Number(req.params.id);
    const itemId  = Number(req.params.itemId);
    const { tags } = req.body;
    if (!Array.isArray(tags)) {
      return res.status(400).json({ error: 'tags debe ser un array' });
    }

    // Verificar que la lista pertenece al usuario
    const list = await prisma.contactList.findFirst({
      where: { id: listId, userId: req.user.id },
      select: { id: true },
    });
    if (!list) return res.status(404).json({ error: 'Lista no encontrada' });

    const item = await prisma.contactListItem.findFirst({
      where: { id: itemId, contactListId: listId },
    });
    if (!item) return res.status(404).json({ error: 'Contacto no encontrado' });

    const cleaned = tags.map(t => String(t).trim().toLowerCase()).filter(Boolean);
    const updated = await prisma.contactListItem.update({
      where: { id: itemId },
      data: { tags: JSON.stringify(cleaned) },
    });
    res.json({ id: updated.id, tags: cleaned });
  } catch (err) {
    console.error('[lists updateItemTags]', err);
    res.status(500).json({ error: 'Error al actualizar tags' });
  }
}

export async function upload(req, res) {
  if (!req.file) {
    return res.status(400).json({ error: 'Archivo CSV requerido' });
  }
  const name = (req.body.name || req.file.originalname || 'Lista').trim().replace(/\.csv$/i, '');
  let buffer;
  try {
    buffer = await fs.readFile(req.file.path);
  } catch (e) {
    return res.status(400).json({ error: 'No se pudo leer el archivo' });
  } finally {
    await fs.unlink(req.file.path).catch(() => {});
  }

  try {
    const { valid, errors } = processCSVBuffer(buffer);
    if (valid.length === 0 && errors.length > 0) {
      return res.status(400).json({ error: 'No hay filas válidas', details: errors });
    }
    if (valid.length > MAX_ITEMS) {
      return res.status(400).json({ error: `Máximo ${MAX_ITEMS} contactos por lista` });
    }

    const list = await prisma.contactList.create({
      data: {
        userId: req.user.id,
        name,
        items: {
          create: valid.map(({ phone, variables, tags = [] }) => ({
            phone,
            variables: JSON.stringify(variables),
            tags: JSON.stringify(tags),
          })),
        },
      },
      include: { _count: { select: { items: true } } },
    });
    req.auditResourceId = list.id;
    res.status(201).json({ ...list, itemCount: list._count.items });
  } catch (err) {
    console.error('[lists upload]', err);
    res.status(500).json({ error: 'Error al crear lista' });
  }
}

export async function createManual(req, res) {
  try {
    const { name, items } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'Nombre requerido' });
    const arr = Array.isArray(items) ? items : [];
    if (arr.length > MAX_ITEMS) {
      return res.status(400).json({ error: `Máximo ${MAX_ITEMS} contactos por lista` });
    }

    const { validateAndNormalizeRows } = await import('../services/csv.service.js');
    const rows = arr.map(({ phone, tags: _tags, ...vars }) => ({ telefono: phone, ...vars }));
    const { valid, errors } = validateAndNormalizeRows(rows);
    if (valid.length === 0 && errors.length > 0) {
      return res.status(400).json({ error: 'Datos inválidos', details: errors });
    }

    // Preservar tags que vengan en el payload original por índice
    const list = await prisma.contactList.create({
      data: {
        userId: req.user.id,
        name: name.trim(),
        items: {
          create: valid.map(({ phone, variables }, idx) => {
            const rawTags = arr[idx]?.tags;
            const tags = Array.isArray(rawTags)
              ? rawTags.map(t => String(t).trim().toLowerCase()).filter(Boolean)
              : [];
            return { phone, variables: JSON.stringify(variables), tags: JSON.stringify(tags) };
          }),
        },
      },
      include: { _count: { select: { items: true } } },
    });
    req.auditResourceId = list.id;
    res.status(201).json({ ...list, itemCount: list._count.items });
  } catch (err) {
    console.error('[lists createManual]', err);
    res.status(500).json({ error: 'Error al crear lista' });
  }
}

// POST /api/lists/:id/items — agrega un contacto a una lista existente
export async function addItem(req, res) {
  try {
    const listId = Number(req.params.id);
    if (!Number.isInteger(listId) || listId < 1) {
      return res.status(400).json({ error: 'ID de lista inválido' });
    }
    const list = await prisma.contactList.findFirst({
      where: { id: listId, userId: req.user.id },
      include: { _count: { select: { items: true } } },
    });
    if (!list) return res.status(404).json({ error: 'Lista no encontrada' });
    if (list._count.items >= MAX_ITEMS) {
      return res.status(400).json({ error: `Máximo ${MAX_ITEMS} contactos por lista` });
    }

    const { phone, variables = {}, tags = [] } = req.body;
    if (!phone || typeof phone !== 'string') {
      return res.status(400).json({ error: 'Teléfono requerido' });
    }

    // Normalizar teléfono
    const PHONE_REGEX = /^\+?[1-9]\d{7,14}$/;
    const cleaned = phone.replace(/\s|-|\./g, '').trim();
    const normalized = cleaned.startsWith('+') ? cleaned : `+${cleaned}`;
    if (!PHONE_REGEX.test(normalized)) {
      return res.status(400).json({ error: 'Número de teléfono inválido (ej: +573001234567)' });
    }

    const cleanedTags = Array.isArray(tags)
      ? tags.map(t => String(t).trim().toLowerCase()).filter(Boolean)
      : [];

    const item = await prisma.contactListItem.create({
      data: {
        contactListId: listId,
        phone: normalized,
        variables: JSON.stringify(typeof variables === 'string' ? JSON.parse(variables) : variables),
        tags: JSON.stringify(cleanedTags),
      },
    });
    res.status(201).json({ ...item, tags: cleanedTags });
  } catch (err) {
    console.error('[lists addItem]', err);
    res.status(500).json({ error: 'Error al agregar contacto' });
  }
}

// DELETE /api/lists/:id/items/:itemId — elimina un contacto de la lista
export async function removeItem(req, res) {
  try {
    const listId = Number(req.params.id);
    const itemId = Number(req.params.itemId);

    const list = await prisma.contactList.findFirst({
      where: { id: listId, userId: req.user.id },
      select: { id: true },
    });
    if (!list) return res.status(404).json({ error: 'Lista no encontrada' });

    const r = await prisma.contactListItem.deleteMany({
      where: { id: itemId, contactListId: listId },
    });
    if (r.count === 0) return res.status(404).json({ error: 'Contacto no encontrado' });
    res.status(204).send();
  } catch (err) {
    console.error('[lists removeItem]', err);
    res.status(500).json({ error: 'Error al eliminar contacto' });
  }
}

export async function remove(req, res) {
  try {
    const id = Number(req.params.id);
    const r = await prisma.contactList.deleteMany({
      where: { id, userId: req.user.id },
    });
    if (r.count === 0) return res.status(404).json({ error: 'Lista no encontrada' });
    req.auditResourceId = id;
    res.status(204).send();
  } catch (err) {
    console.error('[lists remove]', err);
    res.status(500).json({ error: 'Error al eliminar lista' });
  }
}

export const uploadMiddleware = uploadCSV.single('file');
