import { logAction } from '../services/audit.service.js';

/**
 * Middleware que registra la acción en audit_log después de que el controller responda.
 * Uso: router.post('/path', authMiddleware, audit('CREATE_CAMPAIGN', 'Campaign'), controller.create);
 * resourceId se puede setear en req.auditResourceId desde el controller.
 */
export function audit(action, resource = null) {
  return async (req, res, next) => {
    const originalJson = res.json.bind(res);
    res.json = function (body) {
      if (req.user && res.statusCode < 400) {
        const resourceId = req.auditResourceId ?? body?.id ?? body?.campaignId;
        logAction({
          userId: req.user.id,
          action,
          resource,
          resourceId,
          metadata: body ? { summary: typeof body === 'object' ? Object.keys(body) : [] } : null,
          req,
        }).catch((err) => console.error('[audit]', err));
      }
      return originalJson(body);
    };
    next();
  };
}
