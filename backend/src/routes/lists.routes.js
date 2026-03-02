import { Router } from 'express';
import * as ctrl from '../controllers/lists.controller.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import { audit } from '../middlewares/audit.middleware.js';

const router = Router();

router.use(authMiddleware);

router.get('/', ctrl.list);
router.post('/upload', ctrl.uploadMiddleware, audit('CREATE_LIST', 'ContactList'), ctrl.upload);
router.post('/', audit('CREATE_LIST', 'ContactList'), ctrl.createManual);

// Rutas con :id/... (id numérico) antes de GET/DELETE /:id
const idNum = ':id(\\d+)';
router.get(`/${idNum}/tags`, ctrl.getTags);
router.patch(`/${idNum}/tags`, ctrl.renameTag);
router.delete(`/${idNum}/tags`, ctrl.deleteTag);
router.patch(`/${idNum}/items/:itemId/tags`, ctrl.updateItemTags);
router.post(`/${idNum}/items`, ctrl.addItem);
router.delete(`/${idNum}/items/:itemId`, ctrl.removeItem);

router.get('/:id', ctrl.getOne);
router.delete('/:id', audit('DELETE_LIST', 'ContactList'), ctrl.remove);

export default router;
