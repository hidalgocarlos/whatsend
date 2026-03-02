import * as whatsappPool from '../services/whatsappPool.service.js';
import { registerStream, removeStream, emitToUser } from '../lib/sse.js';

export async function status(req, res) {
  const summary = whatsappPool.getStatus(req.user.id);
  res.json(summary);
}

export async function connect(req, res) {
  try {
    await whatsappPool.getOrCreateClient(req.user.id);
    const summary = whatsappPool.getStatus(req.user.id);
    res.json(summary);
  } catch (err) {
    console.error('[whatsapp connect]', err);
    res.status(500).json({ error: 'No se pudo iniciar el cliente WhatsApp' });
  }
}

export async function disconnect(req, res) {
  try {
    await whatsappPool.destroyClient(req.user.id);
    removeStream(req.user.id);
    res.json({ ok: true, status: 'disconnected' });
  } catch (err) {
    console.error('[whatsapp disconnect]', err);
    res.status(500).json({ error: 'Error al desconectar' });
  }
}

export function qrStream(req, res) {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  registerStream(req.user.id, res);

  // Enviar estado actual inmediatamente
  const summary = whatsappPool.getStatus(req.user.id);
  res.write(`event: status\ndata: ${JSON.stringify(summary)}\n\n`);

  // Si ya había un QR generado antes de que el stream se abriera, reenviarlo
  const pendingQr = whatsappPool.getLastQr(req.user.id);
  if (pendingQr) {
    res.write(`event: qr\ndata: ${JSON.stringify(pendingQr)}\n\n`);
  }

  req.on('close', () => {
    removeStream(req.user.id);
  });
}
