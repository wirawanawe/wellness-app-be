"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireRole = exports.requireAuth = void 0;
const requireAuth = (req, res, next) => {
    const userId = req.headers['x-user-id'];
    const role = req.headers['x-user-role'];
    const companyId = req.headers['x-company-id'];
    if (!userId) {
        return res.status(401).json({ error: 'Unauthorized: Missing x-user-id header' });
    }
    req.user = {
        id: parseInt(userId, 10),
        role: role || '',
        companyId: companyId && companyId !== 'null' ? parseInt(companyId, 10) : undefined,
    };
    next();
};
exports.requireAuth = requireAuth;
const requireRole = (allowedRoles) => {
    return (req, res, next) => {
        if (!req.user || !allowedRoles.includes(req.user.role)) {
            return res.status(403).json({ error: 'Forbidden: Insufficient privileges' });
        }
        next();
    };
};
exports.requireRole = requireRole;
