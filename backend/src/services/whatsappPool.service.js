import path from 'path';
import fs from 'fs';
import QRCode from 'qrcode';
import * as sse from '../lib/sse.js';

import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  Browsers,
  fetchLatestBaileysVersion,
} from '@whiskeysockets/baileys';
import pino from 'pino';

const authPath = path.resolve(process.cwd(), 'wwebjs_auth');

// Mapa userId -> { sock, status, phone, lastQr }
const clients = new Map();

// Contador de reintentos independiente del entry (sobrevive a clients.delete)
const retryCounts = new Map();

// Códigos que indican fallo permanente — no reintentar, limpiar sesión
const TERMINAL_CODES = new Set([
  DisconnectReason.loggedOut,  // 401
  403,  // forbidden
  405,  // stream error / sesión inválida
  500,  // bad session
]);

const MAX_RETRIES = 5;

export function getStatus(userId) {
  const entry = clients.get(Number(userId));
  if (!entry) return { status: 'disconnected' };
  return {
    status: entry.status,
    phone: entry.phone || undefined,
  };
}

export async function getOrCreateClient(userId) {
  const id = Number(userId);
  if (clients.has(id)) return clients.get(id);

  const sessionDir = path.join(authPath, `session-user_${id}`);
  fs.mkdirSync(sessionDir, { recursive: true });

  const { state, saveCreds } = await useMultiFileAuthState(sessionDir);

  // Versión actualizada de WhatsApp Web — evita el error 405
  let version;
  try {
    ({ version } = await fetchLatestBaileysVersion());
  } catch (err) {
    console.warn('[whatsapp] No se pudo obtener la última versión de WA, usando la empaquetada:', err.message);
    ({ version } = await import('@whiskeysockets/baileys').then(m => ({ version: m.baileysVersion ?? [2, 3000, 0] })).catch(() => ({ version: [2, 3000, 0] })));
  }

  const logger = pino({ level: 'silent' });

  const sock = makeWASocket({
    version,
    auth: state,
    logger,
    browser: Browsers.ubuntu('Chrome'),
    printQRInTerminal: false,
    connectTimeoutMs: 60_000,
    retryRequestDelayMs: 2000,
  });

  const entry = { sock, status: 'initializing', phone: null, lastQr: null };
  clients.set(id, entry);

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      try {
        const dataUrl = await QRCode.toDataURL(qr, { width: 300, margin: 2 });
        entry.lastQr = dataUrl;
        entry.status = 'qr';
        sse.emitToUser(id, 'qr', dataUrl);
      } catch (err) {
        console.error('[whatsapp] qr convert error', err.message);
      }
    }

    if (connection === 'open') {
      retryCounts.delete(id);
      entry.status = 'connected';
      entry.lastQr = null;
      const rawId = sock.user?.id ?? '';
      const phone = rawId.split(':')[0] || rawId.split('@')[0] || null;
      entry.phone = phone ? `+${phone}` : null;
      sse.emitToUser(id, 'status', { status: 'connected', phone: entry.phone });
    }

    if (connection === 'close') {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const isTerminal = TERMINAL_CODES.has(statusCode);
      entry.lastQr = null;

      const retries = (retryCounts.get(id) ?? 0);

      if (!isTerminal && retries < MAX_RETRIES) {
        retryCounts.set(id, retries + 1);
        console.log(`[whatsapp] Reconectando usuario ${id} (código ${statusCode}, intento ${retries + 1}/${MAX_RETRIES})...`);
        clients.delete(id);
        sse.emitToUser(id, 'status', { status: 'disconnected', reason: `reconnecting (${statusCode})` });
        // Backoff exponencial: 3 s → 6 s → 12 s → 24 s → 48 s
        const delay = 3000 * Math.pow(2, retries);
        setTimeout(() => getOrCreateClient(id).catch(console.error), delay);
      } else {
        const reason = isTerminal ? `code ${statusCode}` : 'max retries';
        console.log(`[whatsapp] Usuario ${id} desconectado permanentemente (${reason}). Limpiando sesión...`);
        retryCounts.delete(id);
        clients.delete(id);
        entry.status = 'disconnected';
        entry.phone = null;
        sse.emitToUser(id, 'status', { status: 'disconnected', reason });
        try {
          fs.rmSync(sessionDir, { recursive: true, force: true });
        } catch (_) {}
      }
    }
  });

  return entry;
}

export async function destroyClient(userId) {
  const id = Number(userId);
  const entry = clients.get(id);
  if (!entry) return;
  try {
    await entry.sock.logout();
  } catch (_) {
    try { entry.sock.end(undefined); } catch (__) {}
  }
  retryCounts.delete(id);
  clients.delete(id);
  sse.emitToUser(id, 'status', { status: 'disconnected' });
}

export function getClient(userId) {
  const entry = clients.get(Number(userId));
  return entry?.sock ?? null;
}

export function getLastQr(userId) {
  const entry = clients.get(Number(userId));
  return entry?.lastQr ?? null;
}

// Reconectar sesiones existentes al arrancar el servidor
export async function reconnectExistingSessions() {
  try {
    if (!fs.existsSync(authPath)) return;
    const entries = fs.readdirSync(authPath);
    for (const entry of entries) {
      const match = entry.match(/^session-user_(\d+)$/);
      if (match) {
        const userId = Number(match[1]);
        const credsFile = path.join(authPath, entry, 'creds.json');
        if (fs.existsSync(credsFile)) {
          console.log(`[whatsapp] Auto-reconectando sesión del usuario ${userId}...`);
          getOrCreateClient(userId).catch((err) =>
            console.warn(`[whatsapp] No se pudo reconectar usuario ${userId}:`, err.message)
          );
        }
      }
    }
  } catch (_) {}
}
