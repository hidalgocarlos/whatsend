import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

import { prisma } from './lib/prisma.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import authRoutes from './routes/auth.routes.js';
import whatsappRoutes from './routes/whatsapp.routes.js';
import usersRoutes from './routes/users.routes.js';
import templatesRoutes from './routes/templates.routes.js';
import listsRoutes from './routes/lists.routes.js';
import campaignsRoutes from './routes/campaigns.routes.js';
import dashboardRoutes from './routes/dashboard.routes.js';
import logsRoutes from './routes/logs.routes.js';
import { startWorker } from './services/queue.service.js';
import { reconnectExistingSessions } from './services/whatsappPool.service.js';

const app = express();
const PORT = process.env.PORT || 3001;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

// Detrás de Nginx con HTTPS: Express debe confiar en X-Forwarded-Proto
if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));
app.use(cors({
  origin: FRONTEND_URL,
  credentials: true,
}));
app.use(cookieParser());
app.use(express.json({ limit: '1mb' }));

// Rutas de auth con rate limiting estricto
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Demasiados intentos. Intenta en 15 minutos.' },
  standardHeaders: true,
  legacyHeaders: false,
});
const refreshLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 30,
  message: { error: 'Demasiadas solicitudes de renovación de sesión.' },
  standardHeaders: true,
  legacyHeaders: false,
});
const passwordLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: { error: 'Demasiados intentos de cambio de contraseña.' },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/auth/login', loginLimiter);
app.use('/api/auth/refresh', refreshLimiter);
app.use('/api/auth/password', passwordLimiter);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadsDir = path.resolve(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

app.use('/api/auth', authRoutes);
app.use('/api/whatsapp', whatsappRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/templates', templatesRoutes);
app.use('/api/lists', listsRoutes);
app.use('/api/campaigns', campaignsRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/logs', logsRoutes);

app.get('/api/health', (_, res) => {
  res.json({ ok: true, service: 'whatsend-api' });
});

app.use((req, res) => {
  res.status(404).json({ error: 'Ruta no encontrada' });
});

app.use((err, req, res, next) => {
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Cuerpo de la solicitud demasiado grande' });
  }
  console.error('[server error]', err.message);
  res.status(500).json({ error: 'Error interno del servidor' });
});

async function main() {
  try {
    await prisma.$connect();
    try {
      startWorker();
    } catch (e) {
      console.warn('Redis/BullMQ no disponible:', e.message);
    }
    reconnectExistingSessions();
    app.listen(PORT, () => {
      console.log(`WhatSend API en http://localhost:${PORT}`);
    });
  } catch (e) {
    console.error('No se pudo conectar a la base de datos:', e.message);
    process.exit(1);
  }
}

main();
