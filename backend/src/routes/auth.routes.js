import { Router } from 'express';
import * as authController from '../controllers/auth.controller.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import { audit } from '../middlewares/audit.middleware.js';

const router = Router();

router.post('/login', authController.login);
router.post('/refresh', authController.refresh);
router.post('/logout', authMiddleware, audit('LOGOUT'), authController.logout);
router.get('/me', authMiddleware, authController.me);
router.put('/password', authMiddleware, authController.changePassword);

export default router;
