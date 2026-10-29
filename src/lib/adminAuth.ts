import crypto from 'crypto';
import { NextRequest } from 'next/server';

export const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'thilakkamquest2026';
export const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'thilakkam&Confianz2026';

function getAdminSecret(): Buffer {
  const secret = process.env.ADMIN_SESSION_SECRET || 'thilakkam-quest-admin-secure-session-key-2026';
  return crypto.createHash('sha256').update(secret).digest();
}

/**
 * Validates admin credentials using timing-safe comparison.
 */
export function checkAdminCredentials(username: string, password: string): boolean {
  if (!username || !password) return false;

  const expectedUser = Buffer.from(ADMIN_USERNAME);
  const providedUser = Buffer.from(username.trim());

  const expectedPass = Buffer.from(ADMIN_PASSWORD);
  const providedPass = Buffer.from(password);

  const uMatch = expectedUser.length === providedUser.length && crypto.timingSafeEqual(expectedUser, providedUser);
  const pMatch = expectedPass.length === providedPass.length && crypto.timingSafeEqual(expectedPass, providedPass);

  return uMatch && pMatch;
}

/**
 * Generates an encrypted AES-256-GCM session token for authenticated admin.
 */
export function createAdminSessionToken(): string {
  const payload = JSON.stringify({
    role: 'admin',
    user: ADMIN_USERNAME,
    exp: Date.now() + 24 * 60 * 60 * 1000 // 24 hours
  });

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getAdminSecret(), iv);
  const encrypted = Buffer.concat([cipher.update(payload, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return Buffer.concat([iv, tag, encrypted]).toString('base64url');
}

/**
 * Validates and authenticates the admin session token.
 */
export function verifyAdminSessionToken(token: string): boolean {
  try {
    if (!token || typeof token !== 'string') return false;

    const buf = Buffer.from(token, 'base64url');
    if (buf.length < 28) return false;

    const iv = buf.subarray(0, 12);
    const tag = buf.subarray(12, 28);
    const ciphertext = buf.subarray(28);

    const decipher = crypto.createDecipheriv('aes-256-gcm', getAdminSecret(), iv);
    decipher.setAuthTag(tag);

    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    const payload = JSON.parse(decrypted.toString('utf8'));

    if (!payload || payload.role !== 'admin' || Date.now() > payload.exp) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * Checks if the incoming request has a valid admin session (via cookie or header).
 */
export function isAuthorizedAdmin(req: NextRequest): boolean {
  // 1. Check HTTP-only cookie
  const cookieToken = req.cookies.get('admin_session')?.value;
  if (cookieToken && verifyAdminSessionToken(cookieToken)) {
    return true;
  }

  // 2. Check Authorization Bearer header
  const authHeader = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (authHeader && verifyAdminSessionToken(authHeader)) {
    return true;
  }

  // 3. Check custom header x-admin-token
  const xAdminToken = req.headers.get('x-admin-token');
  if (xAdminToken && verifyAdminSessionToken(xAdminToken)) {
    return true;
  }

  return false;
}

