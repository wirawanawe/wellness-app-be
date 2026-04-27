import express, { Request, Response, NextFunction } from 'express';
export const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  const userId = req.headers['x-user-id'] as string;
  const role = req.headers['x-user-role'] as string;
  const companyId = req.headers['x-company-id'] as string;

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

export const requireRole = (allowedRoles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Forbidden: Insufficient privileges' });
    }
    next();
  };
};

// Extend Express Request
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: number;
        role: string;
        companyId?: number;
      };
    }
  }
}
