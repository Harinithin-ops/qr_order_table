import { Request, Response, NextFunction } from 'express';
import { verifyJwt, generateJwt } from '../utils/jwt.js';
import { prisma } from '../lib/prisma.js';

const AUTH_COOKIE_NAME = 'kh_admin_token';

export interface AuthenticatedRequest extends Request {
  username?: string;
  userRole?: string;
}

export async function authMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  let token = req.cookies[AUTH_COOKIE_NAME];
  const authHeader = req.headers['authorization'] || req.headers.authorization;
  
  if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  }
  
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized: No token provided' });
  }

  const payload = verifyJwt(token);
  if (!payload) {
    return res.status(401).json({ error: 'Unauthorized: Invalid or expired token' });
  }

  try {
    // Check if session exists in the database
    const session = await (prisma as any).userSession.findUnique({
      where: { token }
    });

    if (!session) {
      return res.status(401).json({ error: 'Unauthorized: Session has been logged out' });
    }

    // Check if session expired
    if (new Date() >= new Date(session.expiresAt)) {
      // Clean up expired session
      await (prisma as any).userSession.delete({ where: { id: session.id } }).catch(() => {});
      return res.status(401).json({ error: 'Unauthorized: Session expired' });
    }

    // Update lastActiveAt periodically (e.g. if it was updated more than 5 minutes ago)
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    if (new Date(session.lastActiveAt) < fiveMinutesAgo) {
      await (prisma as any).userSession.update({
        where: { id: session.id },
        data: { lastActiveAt: new Date() }
      }).catch(() => {});
    }

    req.username = payload.username;
    req.userRole = payload.role;
  } catch (err) {
    console.error('Session validation error:', err);
    return res.status(401).json({ error: 'Unauthorized: Session validation failed' });
  }

  next();
}

export function adminOnly(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (req.userRole !== 'admin' && req.username !== 'admin') {
    return res.status(403).json({ error: 'Forbidden: Admin access required' });
  }
  next();
}

export function waiterOnly(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (req.userRole !== 'waiter') {
    return res.status(403).json({ error: 'Forbidden: Waiter access required' });
  }
  next();
}

export function generateToken(username: string): string {
  // Legacy support just in case, using our internal utility
  return generateJwt({ username, role: username === 'admin' ? 'admin' : 'waiter' });
}

export { AUTH_COOKIE_NAME };

