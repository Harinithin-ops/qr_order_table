import { Request, Response, NextFunction } from 'express';

const AUTH_COOKIE_NAME = 'kh_admin_token';
const AUTH_TOKEN_SECRET = process.env.AUTH_SECRET || 'kavitha-hotel-secret-key-change-in-production';

export interface AuthenticatedRequest extends Request {
  username?: string;
}

function validateToken(token: string): boolean {
  try {
    const decoded = Buffer.from(token, 'base64').toString('utf-8');
    const parts = decoded.split(':');
    if (parts.length < 3) return false;
    // Check that it contains our secret
    if (parts[2] !== AUTH_TOKEN_SECRET) return false;

    // Enforce 12-hour expiration for admin
    if (parts[0] === 'admin') {
      const timestamp = parseInt(parts[1], 10);
      if (isNaN(timestamp)) return false;
      const twelveHoursMs = 12 * 60 * 60 * 1000;
      if (Date.now() - timestamp > twelveHoursMs) {
        return false;
      }
    }

    return true;
  } catch {
    return false;
  }
}

export function authMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const token = req.cookies[AUTH_COOKIE_NAME];
  
  if (!token || !validateToken(token)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const decoded = Buffer.from(token, 'base64').toString('utf-8');
    const parts = decoded.split(':');
    req.username = parts[0];
  } catch {
    // Ignore
  }

  next();
}

export function adminOnly(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (req.username !== 'admin') {
    return res.status(403).json({ error: 'Forbidden: Admin access required' });
  }
  next();
}

export function generateToken(username: string): string {
  const payload = `${username}:${Date.now()}:${AUTH_TOKEN_SECRET}`;
  return Buffer.from(payload).toString('base64');
}

export { AUTH_COOKIE_NAME };
