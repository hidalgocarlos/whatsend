/**
 * SSE manager: mapa userId -> response para emitir eventos a cada usuario.
 * Se usa para QR de WhatsApp, progreso de campaña y dashboard en tiempo real.
 */

const streams = new Map();

export function registerStream(userId, res) {
  const id = Number(userId);
  // Cerrar stream anterior si existe para no dejar conexiones huérfanas
  const existing = streams.get(id);
  if (existing && !existing.writableEnded) {
    try { existing.end(); } catch (_) {}
  }
  streams.set(id, res);
  res.on('close', () => {
    if (streams.get(id) === res) streams.delete(id);
  });
}

export function emitToUser(userId, event, data) {
  const res = streams.get(Number(userId));
  if (res && !res.writableEnded) {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  }
}

export function removeStream(userId) {
  const id = Number(userId);
  const res = streams.get(id);
  if (res && !res.writableEnded) {
    try { res.end(); } catch (_) {}
  }
  streams.delete(id);
}
