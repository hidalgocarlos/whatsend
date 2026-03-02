import { Router } from 'express';
import * as ctrl from '../controllers/whatsapp.controller.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import { sseAuthMiddleware } from '../middlewares/sseAuth.middleware.js';
import { audit } from '../middlewares/audit.middleware.js';

const router = Router();

router.get('/qr', sseAuthMiddleware, ctrl.qrStream);
router.get('/status', authMiddleware, ctrl.status);
router.post('/connect', authMiddleware, audit('WHATSAPP_CONNECT'), ctrl.connect);
router.post('/disconnect', authMiddleware, audit('WHATSAPP_DISCONNECT'), ctrl.disconnect);

export default router;
