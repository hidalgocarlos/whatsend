import fs from 'fs/promises';
import * as templateService from '../services/template.service.js';
import { parseParts } from '../services/template.service.js';

function detectMediaType(mimetype) {
  if (!mimetype) return null;
  if (mimetype.startsWith('image/')) return 'image';
  if (mimetype.startsWith('audio/') || mimetype === 'video/mp4') return 'audio';
  return null;
}

async function deleteMediaFile(mediaPath) {
  if (!mediaPath) return;
  try {
    await fs.unlink(mediaPath);
  } catch (_) {}
}

function templateToApi(t) {
  if (!t) return t;
  return {
    ...t,
    variables: parseParts(t.variables),
    saludos: parseParts(t.saludos),
    cuerpos: parseParts(t.cuerpos),
    ctas: parseParts(t.ctas),
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
    const name = req.body.name != null ? String(req.body.name).trim() : '';
    if (!name) {
      if (req.file) await deleteMediaFile(req.file.path);
      return res.status(400).json({ error: 'El nombre es obligatorio' });
    }

    const saludos = parseParts(req.body.saludos);
    const cuerpos = parseParts(req.body.cuerpos);
    const ctas    = parseParts(req.body.ctas);

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

    // Solo incluir campos en updateData si el cliente los envió explícitamente
    const updateData = {};
    if (req.body.name != null) {
      updateData.name = String(req.body.name).trim() || existing.name;
    }
    if (req.body.saludos !== undefined) updateData.saludos = parseParts(req.body.saludos);
    if (req.body.cuerpos !== undefined) updateData.cuerpos = parseParts(req.body.cuerpos);
    if (req.body.ctas    !== undefined) updateData.ctas    = parseParts(req.body.ctas);

    // Validar cuerpos (ya sea el nuevo o el existente)
    const cuerposToValidate = updateData.cuerpos ?? parseParts(existing.cuerpos);
    const hasCuerpo = cuerposToValidate.some((c) => String(c).trim() !== '');
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
