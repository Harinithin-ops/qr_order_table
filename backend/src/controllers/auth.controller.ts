import { Request, Response } from 'express';
import { AuthenticatedRequest, generateToken, AUTH_COOKIE_NAME } from '../middleware/auth.middleware.js';
import { createClient } from '@supabase/supabase-js';

const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'kavitha2024';

const SERVER_USERNAME = process.env.SERVER_USERNAME || 'server';
const SERVER_PASSWORD = process.env.SERVER_PASSWORD || 'server2024';

const ADMIN_EMAIL = 'kavithahotel47471@gmail.com';

const supabaseUrl = process.env.SUPABASE_URL || 'https://ozutplxygsiijdkgbici.supabase.co';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || '';

const supabase = supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null;

// In-memory OTP storage for fallbacks & development testing
const pendingOtps = new Map<string, { code: string; expiresAt: number }>();

export async function login(req: Request, res: Response) {
  const { username, password } = req.body;

  if (username === SERVER_USERNAME && password === SERVER_PASSWORD) {
    const token = generateToken(username);
    
    res.cookie(AUTH_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    return res.json({ success: true, role: username });
  }

  if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
    // Admin login triggers OTP
    try {
      if (supabase) {
        const { error } = await supabase.auth.signInWithOtp({
          email: ADMIN_EMAIL,
          options: { shouldCreateUser: false }
        });
        
        if (error) {
          console.error('Supabase OTP send failed, falling back to console code:', error);
          const fallbackCode = Math.floor(100000 + Math.random() * 900000).toString();
          pendingOtps.set(ADMIN_EMAIL, {
            code: fallbackCode,
            expiresAt: Date.now() + 10 * 60 * 1000 // 10 mins
          });
          console.log(`\n\n==================================================`);
          console.log(`📩 SECURE FALLBACK OTP for ${ADMIN_EMAIL}: [ ${fallbackCode} ]`);
          console.log(`==================================================\n\n`);
        } else {
          console.log(`📩 Supabase OTP sent successfully to ${ADMIN_EMAIL}`);
        }
      } else {
        const fallbackCode = Math.floor(100000 + Math.random() * 900000).toString();
        pendingOtps.set(ADMIN_EMAIL, {
          code: fallbackCode,
          expiresAt: Date.now() + 10 * 60 * 1000
        });
        console.log(`\n\n==================================================`);
        console.log(`📩 SECURE DEVELOPER OTP for ${ADMIN_EMAIL}: [ ${fallbackCode} ]`);
        console.log(`==================================================\n\n`);
      }
      
      return res.json({ success: true, otpRequired: true, email: ADMIN_EMAIL });
    } catch (err) {
      console.error('OTP flow error:', err);
      return res.status(500).json({ error: 'Failed to trigger verification code' });
    }
  }

  return res.status(401).json({ error: 'Invalid credentials' });
}

export async function verifyOtp(req: Request, res: Response) {
  const { code } = req.body;

  if (!code) {
    return res.status(400).json({ error: 'Verification code is required' });
  }

  let verified = false;

  // 1. Check in-memory first (for fallback / development console OTP)
  const pending = pendingOtps.get(ADMIN_EMAIL);
  if (pending && pending.expiresAt > Date.now() && pending.code === code) {
    verified = true;
    pendingOtps.delete(ADMIN_EMAIL);
  }

  // 2. Verify with Supabase if client is configured and not yet verified
  if (!verified && supabase) {
    try {
      const { error } = await supabase.auth.verifyOtp({
        email: ADMIN_EMAIL,
        token: code,
        type: 'email'
      });
      if (!error) {
        verified = true;
      } else {
        console.error('Supabase OTP verification failed:', error.message);
      }
    } catch (err) {
      console.error('Supabase verification exception:', err);
    }
  }

  if (verified) {
    const token = generateToken('admin');
    
    res.cookie(AUTH_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    return res.json({ success: true, role: 'admin' });
  }

  return res.status(401).json({ error: 'Invalid or expired verification code' });
}

export function logout(req: Request, res: Response) {
  res.clearCookie(AUTH_COOKIE_NAME, { path: '/' });
  return res.json({ success: true });
}

export function checkAuth(req: AuthenticatedRequest, res: Response) {
  return res.json({ authenticated: true, username: req.username });
}
