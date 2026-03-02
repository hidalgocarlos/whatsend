import { Router } from 'express';
import * as ctrl from '../controllers/dashboard.controller.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';

const router = Router();

router.use(authMiddleware);

router.get('/summary', ctrl.summary);
router.get('/usage', ctrl.usage);
router.get('/chart/daily', ctrl.chartDaily);
router.get('/chart/status-distribution', ctrl.statusDistribution);
router.get('/recent-logs', ctrl.recentLogs);

export default router;
