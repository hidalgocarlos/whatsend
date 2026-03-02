import { Router } from 'express';
import * as ctrl from '../controllers/users.controller.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import { requireRole } from '../middlewares/role.middleware.js';
import { audit } from '../middlewares/audit.middleware.js';

const router = Router();

router.use(authMiddleware);
router.use(requireRole('ADMIN'));

router.get('/', ctrl.list);
router.get('/:id', ctrl.getOne);
router.post('/', audit('CREATE_USER', 'User'), ctrl.create);
router.put('/:id', audit('UPDATE_USER', 'User'), ctrl.update);
router.post('/:id/reset-password', audit('RESET_PASSWORD', 'User'), ctrl.resetPassword);

export default router;
