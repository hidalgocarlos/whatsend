/**
 * Requiere que req.user tenga uno de los roles indicados.
 * Debe usarse después de authMiddleware.
 */
export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'No autorizado' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Sin permiso para esta acción' });
    }
    next();
  };
}
