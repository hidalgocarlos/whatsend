import { Router } from 'express';
import * as ctrl from '../controllers/campaigns.controller.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import { sseAuthMiddleware } from '../middlewares/sseAuth.middleware.js';
import { audit } from '../middlewares/audit.middleware.js';

const router = Router();

router.get('/', authMiddleware, ctrl.list);
router.get('/:id', authMiddleware, ctrl.getOne);
router.get('/:id/events', sseAuthMiddleware, ctrl.eventsStream);
router.get('/:id/export', authMiddleware, ctrl.exportCSV);
router.post('/', authMiddleware, audit('CREATE_CAMPAIGN', 'Campaign'), ctrl.create);
router.delete('/:id', authMiddleware, audit('CANCEL_CAMPAIGN', 'Campaign'), ctrl.cancel);

export default router;
