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
  try { await fs.unlink(mediaPath); } catch (_) {}
}

export async function list(req, res) {
  try {
    const items = await templateService.listByUser(req.user.id);
    res.json(items);
  } catch (err) {
    console.error('[templates list]', err);
    res.status(500).json({ error: 'Error al obtener plantillas' });
  }
}

export async function getOne(req, res) {
  try {
    const t = await templateService.getById(req.params.id, req.user.id);
    if (!t) return res.status(404).json({ error: 'Plantilla no encontrada' });
    res.json({ ...t, variables: JSON.parse(t.variables || '[]') });
  } catch (err) {
    console.error('[templates getOne]', err);
    res.status(500).json({ error: 'Error al obtener plantilla' });
  }
}

export async function create(req, res) {
  try {
    const { name, body } = req.body;
    if (!name?.trim() || !body) {
      if (req.file) await deleteMediaFile(req.file.path);
      return res.status(400).json({ error: 'Nombre y cuerpo requeridos' });
    }

    let mediaType = null;
    let mediaPath = null;
    let mediaName = null;

    if (req.file) {
      mediaType = detectMediaType(req.file.mimetype);
      mediaPath = req.file.path;
      mediaName = req.file.originalname;
    }

    const t = await templateService.create(req.user.id, { name, body, mediaType, mediaPath, mediaName });
    req.auditResourceId = t.id;
    res.status(201).json({ ...t, variables: JSON.parse(t.variables || '[]') });
  } catch (err) {
    if (req.file) await deleteMediaFile(req.file.path).catch(() => {});
    console.error('[templates create]', err);
    res.status(500).json({ error: 'Error al crear plantilla' });
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

    // Solo pasar campos conocidos para evitar mass assignment
    const updateData = {};
    if (req.body.name != null) updateData.name = req.body.name;
    if (req.body.body != null) updateData.body = req.body.body;

    if (req.file) {
      await deleteMediaFile(existing.mediaPath);
      updateData.mediaType = detectMediaType(req.file.mimetype);
      updateData.mediaPath = req.file.path;
      updateData.mediaName = req.file.originalname;
    } else if (req.body.clearMedia === 'true') {
      await deleteMediaFile(existing.mediaPath);
      updateData.mediaType = null;
      updateData.mediaPath = null;
      updateData.mediaName = null;
    }

    await templateService.update(id, req.user.id, updateData);
    req.auditResourceId = Number(id);
    const updated = await templateService.getById(id, req.user.id);
    res.json({ ...updated, variables: JSON.parse(updated.variables || '[]') });
  } catch (err) {
    if (req.file) await deleteMediaFile(req.file.path).catch(() => {});
    console.error('[templates update]', err);
    res.status(500).json({ error: 'Error al actualizar plantilla' });
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
