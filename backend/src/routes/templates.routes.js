import { Router } from 'express';
import path from 'path';
import fs from 'fs';
import * as ctrl from '../controllers/templates.controller.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import { audit } from '../middlewares/audit.middleware.js';
import { uploadTemplateMedia } from '../middlewares/upload.middleware.js';
import { prisma } from '../lib/prisma.js';

const router = Router();

router.use(authMiddleware);

// Servir archivos de media de plantillas (solo el dueño puede acceder)
router.get('/media/:filename', async (req, res) => {
  const filename = path.basename(req.params.filename); // previene path traversal
  const template = await prisma.template.findFirst({
    where: { userId: req.user.id, mediaPath: { endsWith: filename } },
    select: { id: true },
  });
  if (!template) return res.status(404).json({ error: 'Archivo no encontrado' });

  const filePath = path.resolve(process.cwd(), 'uploads', 'templates', filename);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Archivo no encontrado' });
  res.sendFile(filePath);
});

router.get('/', ctrl.list);
router.get('/:id', ctrl.getOne);
router.post('/', uploadTemplateMedia.single('media'), audit('CREATE_TEMPLATE', 'Template'), ctrl.create);
router.put('/:id', uploadTemplateMedia.single('media'), audit('UPDATE_TEMPLATE', 'Template'), ctrl.update);
router.delete('/:id', audit('DELETE_TEMPLATE', 'Template'), ctrl.remove);

export default router;
