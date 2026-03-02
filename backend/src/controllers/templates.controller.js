import fs from 'fs/promises';
import * as templateService from '../services/template.service.js';

function detectMediaType(mimetype) {
  if (!mimetype) return null;
  if (mimetype.startsWith('image/')) return 'image';
  if (mimetype.startsWith('audio/')) return 'audio';
  return null;
}

async function deleteMediaFile(mediaPath) {
  if (!mediaPath) return;
  try {
    await fs.unlink(mediaPath);
  } catch (_) {}
}

function toArray(val) {
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

function templateToApi(t) {
  if (!t) return t;
  return {
    ...t,
    variables: toArray(t.variables),
    saludos: toArray(t.saludos),
    cuerpos: toArray(t.cuerpos),
    ctas: toArray(t.ctas),
  };
}

function normalizeBody(req) {
  const { name, saludos, cuerpos, ctas } = req.body;
  return {
    name: name != null ? String(name).trim() : '',
    saludos: toArray(saludos),
    cuerpos: toArray(cuerpos),
    ctas: toArray(ctas),
  };
}

export async function list(req, res) {
  try {
    const items = await templateService.listByUser(req.user.id);
    res.json(items.map(templateToApi));
  } catch (err) {
    console.error('[templates list]', err);
    res.status(500).json({ error: 'Error al obtener plantillas' });
  }
}

export async function getOne(req, res) {
  try {
    const t = await templateService.getById(req.params.id, req.user.id);
    if (!t) return res.status(404).json({ error: 'Plantilla no encontrada' });
    res.json(templateToApi(t));
  } catch (err) {
    console.error('[templates getOne]', err);
    res.status(500).json({ error: 'Error al obtener plantilla' });
  }
}

export async function create(req, res) {
  try {
    const { name, saludos, cuerpos, ctas } = normalizeBody(req);
    if (!name) {
      if (req.file) await deleteMediaFile(req.file.path);
      return res.status(400).json({ error: 'El nombre es obligatorio' });
    }

    const hasCuerpo = cuerpos.some((c) => String(c).trim() !== '');
    if (!hasCuerpo) {
      if (req.file) await deleteMediaFile(req.file.path);
      return res.status(400).json({ error: 'Añade al menos una variante en Cuerpo del mensaje' });
    }

    let mediaType = null;
    let mediaPath = null;
    let mediaName = null;
    if (req.file) {
      mediaType = detectMediaType(req.file.mimetype);
      mediaPath = req.file.path;
      mediaName = req.file.originalname;
    }

    const t = await templateService.create(req.user.id, {
      name,
      saludos,
      cuerpos,
      ctas,
      mediaType,
      mediaPath,
      mediaName,
    });
    req.auditResourceId = t.id;
    res.status(201).json(templateToApi(t));
  } catch (err) {
    if (req.file) await deleteMediaFile(req.file.path).catch(() => {});
    console.error('[templates create]', err);
    res.status(400).json({ error: err.message || 'Error al crear plantilla' });
  }
}

export async function update(req, res) {
  try {
    const id = req.params.id;
    const existing = await templateService.getById(id, req.user.id);
    if (!existing) {
      if (req.file) await deleteMediaFile(req.file.path);
      return res.status(404).json({ error: 'Plantilla no encontrada' });
    }

    const { name, saludos, cuerpos, ctas } = normalizeBody(req);
    const updateData = {
      name: name || existing.name,
      saludos,
      cuerpos,
      ctas,
    };

    const hasCuerpo = cuerpos.some((c) => String(c).trim() !== '');
    if (!hasCuerpo) {
      if (req.file) await deleteMediaFile(req.file.path);
      return res.status(400).json({ error: 'Añade al menos una variante en Cuerpo del mensaje' });
    }

    if (req.file) {
      await deleteMediaFile(existing.mediaPath);
      updateData.mediaType = detectMediaType(req.file.mimetype);
      updateData.mediaPath = req.file.path;
      updateData.mediaName = req.file.originalname;
    } else if (req.body.clearMedia === 'true' || req.body.clearMedia === true) {
      await deleteMediaFile(existing.mediaPath);
      updateData.mediaType = null;
      updateData.mediaPath = null;
      updateData.mediaName = null;
    }

    const updated = await templateService.update(id, req.user.id, updateData);
    req.auditResourceId = Number(id);
    res.json(templateToApi(updated));
  } catch (err) {
    if (req.file) await deleteMediaFile(req.file.path).catch(() => {});
    console.error('[templates update]', err);
    res.status(400).json({ error: err.message || 'Error al actualizar plantilla' });
  }
}

export async function remove(req, res) {
  try {
    const existing = await templateService.getById(req.params.id, req.user.id);
    if (!existing) return res.status(404).json({ error: 'Plantilla no encontrada' });
    await deleteMediaFile(existing.mediaPath);
    const deleted = await templateService.remove(req.params.id, req.user.id);
    if (!deleted) return res.status(404).json({ error: 'Plantilla no encontrada' });
    req.auditResourceId = Number(req.params.id);
    res.status(204).send();
  } catch (err) {
    console.error('[templates remove]', err);
    res.status(500).json({ error: 'Error al eliminar plantilla' });
  }
}
