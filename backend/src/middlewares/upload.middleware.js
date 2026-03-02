import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadDir = path.resolve(process.cwd(), 'uploads');
const templatesMediaDir = path.join(uploadDir, 'templates');

// Crear carpeta templates/ si no existe
if (!fs.existsSync(templatesMediaDir)) {
  fs.mkdirSync(templatesMediaDir, { recursive: true });
}

// --- CSV (listas de contactos) ---
const csvStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.csv';
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`);
  },
});

const csvFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (ext !== '.csv') return cb(new Error('Solo se permiten archivos CSV'), false);
  cb(null, true);
};

export const uploadCSV = multer({
  storage: csvStorage,
  fileFilter: csvFilter,
  limits: { fileSize: 10 * 1024 * 1024 },
});

// --- Media de plantillas (imagen / audio) ---
const ALLOWED_MEDIA_TYPES = new Set([
  'image/jpeg', 'image/png', 'image/webp',
  'audio/mpeg', 'audio/ogg', 'audio/mp4',
]);

const mediaStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, templatesMediaDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '';
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`);
  },
});

const mediaFilter = (req, file, cb) => {
  if (!ALLOWED_MEDIA_TYPES.has(file.mimetype)) {
    return cb(new Error('Tipo de archivo no permitido. Usa JPG, PNG, WEBP, MP3 u OGG'), false);
  }
  cb(null, true);
};

export const uploadTemplateMedia = multer({
  storage: mediaStorage,
  fileFilter: mediaFilter,
  limits: { fileSize: 20 * 1024 * 1024 },
});
