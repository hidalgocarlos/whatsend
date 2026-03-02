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

function parseJsonArray(val) {
  if (Array.isArray(val)) return val;
  try { return JSON.parse(val || '[]'); } catch (_) { return []; }
}

function templateToApi(t) {
  if (!t) return t;
  return {
    ...t,
    variables: parseJsonArray(t.variables),
    saludos: parseJsonArray(t.saludos),
    cuerpos: parseJsonArray(t.cuerpos),
    ctas: parseJsonArray(t.ctas),
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
    let { name, body, saludos, cuerpos, ctas } = req.body;
    if (!name?.trim()) {
      if (req.file) await deleteMediaFile(req.file.path);
      return res.status(400).json({ error: 'Nombre requerido' });
    }
    if (typeof saludos === 'string') { try { saludos = JSON.parse(saludos); } catch (_) { saludos = []; } }
    if (typeof cuerpos === 'string') { try { cuerpos = JSON.parse(cuerpos); } catch (_) { cuerpos = []; } }
    if (typeof ctas === 'string') { try { ctas = JSON.parse(ctas); } catch (_) { ctas = []; } }
    const saludosArr = Array.isArray(saludos) ? saludos : (saludos != null ? [String(saludos)] : []);
    const cuerposArr = Array.isArray(cuerpos) ? cuerpos : (cuerpos != null ? [String(cuerpos)] : []);
    const ctasArr = Array.isArray(ctas) ? ctas : (ctas != null ? [String(ctas)] : []);
    const hasBody = body != null && String(body).trim() !== '';
    const hasCuerpos = cuerposArr.length > 0 && cuerposArr.some(s => String(s).trim() !== '');
    if (!hasBody && !hasCuerpos) {
      if (req.file) await deleteMediaFile(req.file.path);
      return res.status(400).json({ error: 'Indica al menos el cuerpo del mensaje o al menos una variante en Cuerpo' });
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
      body: body ?? '',
      saludos: saludosArr,
      cuerpos: cuerposArr,
      ctas: ctasArr,
      mediaType,
      mediaPath,
      mediaName,
    });
    req.auditResourceId = t.id;
    res.status(201).json(templateToApi(t));
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

    const updateData = {};
    if (req.body.name != null) updateData.name = req.body.name;
    if (req.body.body != null) updateData.body = req.body.body;
    let saludos = req.body.saludos;
    let cuerpos = req.body.cuerpos;
    let ctas = req.body.ctas;
    if (typeof saludos === 'string') { try { saludos = JSON.parse(saludos); } catch (_) { saludos = []; } }
    if (typeof cuerpos === 'string') { try { cuerpos = JSON.parse(cuerpos); } catch (_) { cuerpos = []; } }
    if (typeof ctas === 'string') { try { ctas = JSON.parse(ctas); } catch (_) { ctas = []; } }
    if (req.body.saludos !== undefined) updateData.saludos = Array.isArray(saludos) ? saludos : [];
    if (req.body.cuerpos !== undefined) updateData.cuerpos = Array.isArray(cuerpos) ? cuerpos : [];
    if (req.body.ctas !== undefined) updateData.ctas = Array.isArray(ctas) ? ctas : [];

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
    res.json(templateToApi(updated));
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
