import { Router } from 'express';
import * as ctrl from '../controllers/logs.controller.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import { requireRole } from '../middlewares/role.middleware.js';

const router = Router();

router.use(authMiddleware);

router.get('/send', ctrl.sendLogs);
router.get('/send/:campaignId', ctrl.sendLogsByCampaign);
router.get('/send/:campaignId/export', ctrl.exportCampaignLogs);

router.get('/audit', requireRole('ADMIN'), ctrl.auditLogs);

export default router;
