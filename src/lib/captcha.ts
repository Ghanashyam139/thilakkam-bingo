import crypto from 'crypto';
import { getDB } from './db';

// Character sets for the captcha
const NUMBERS = ['2', '3', '4', '5', '6', '7', '8', '9'];
const LETTERS = [
  'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'J', 'K', 'M',
  'N', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z'
];
// Distinct, easily accessible symbols
const SYMBOLS = ['#', '@', '*', '?', '!', '%', '+', '$'];

const PALETTE = [
  '#FFDC47', // Yellow
  '#00F0FF', // Cyan
  '#DF0586', // Neon Pink
  '#34D399', // Emerald
  '#FB923C', // Orange
  '#A78BFA', // Violet
  '#38BDF8', // Sky Blue
  '#F472B6'  // Rose Pink
];

function getRandomInt(min: number, max: number): number {
  return crypto.randomInt(min, max);
}

function getRandomItem<T>(arr: T[]): T {
  return arr[getRandomInt(0, arr.length)];
}

/**
 * Generates a 5-character captcha code guaranteed to contain:
 * - At least 1 number
 * - At least 1 symbol
 * - At least 1 letter
 * plus 2 additional random characters from the combined pool.
 */
export function generateCaptchaCode(): string {
  const allPool = [...NUMBERS, ...LETTERS, ...SYMBOLS];
  const chars: string[] = [
    getRandomItem(NUMBERS),
    getRandomItem(SYMBOLS),
    getRandomItem(LETTERS),
    getRandomItem(allPool),
    getRandomItem(allPool)
  ];

  // Fisher-Yates cryptographic shuffle
  for (let i = chars.length - 1; i > 0; i--) {
    const j = getRandomInt(0, i + 1);
    const temp = chars[i];
    chars[i] = chars[j];
    chars[j] = temp;
  }

  return chars.join('');
}

function escapeXml(unsafe: string): string {
  return unsafe.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '\'': return '&apos;';
      case '"': return '&quot;';
      default: return c;
    }
  });
}

/**
 * Generates an SVG string representing the captcha visually with:
 * - Noise curves
 * - Scatter dots
 * - Random character rotations, offsets, colors, and font sizes
 * - Obscuring lines
 */
export function generateCaptchaSvg(code: string): string {
  const width = 200;
  const height = 52;

  // Background noise lines (bezier curves)
  let noiseLines = '';
  for (let i = 0; i < 4; i++) {
    const y1 = (10 + getRandomInt(0, 32)).toFixed(1);
    const y2 = (10 + getRandomInt(0, 32)).toFixed(1);
    const cy1 = (5 + getRandomInt(0, 42)).toFixed(1);
    const cy2 = (5 + getRandomInt(0, 42)).toFixed(1);
    const color = getRandomItem(PALETTE);
    const dash = getRandomInt(0, 2) === 1 ? '4,3' : 'none';
    noiseLines += `<path d="M 0 ${y1} C 60 ${cy1}, 140 ${cy2}, ${width} ${y2}" stroke="${color}" stroke-width="1.3" fill="none" opacity="0.32" stroke-dasharray="${dash}" />`;
  }

  // Scatter dots
  let scatterDots = '';
  for (let i = 0; i < 28; i++) {
    const cx = getRandomInt(0, width);
    const cy = getRandomInt(0, height);
    const r = (0.8 + Math.random() * 1.5).toFixed(1);
    const color = getRandomItem(PALETTE);
    const opacity = (0.2 + Math.random() * 0.4).toFixed(2);
    scatterDots += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${color}" opacity="${opacity}" />`;
  }

  // Render each character with rotation and jitter
  let charsSvg = '';
  const step = (width - 34) / code.length;
  for (let i = 0; i < code.length; i++) {
    const char = code[i];
    const x = (22 + i * step + (Math.random() * 6 - 3)).toFixed(1);
    const y = (35 + (Math.random() * 6 - 3)).toFixed(1);
    const rot = getRandomInt(-16, 17);
    const color = getRandomItem(PALETTE);
    const fontSize = getRandomInt(25, 30);
    const escaped = escapeXml(char);

    charsSvg += `<text x="${x}" y="${y}" font-size="${fontSize}" font-family="'Courier New', Courier, monospace" font-weight="900" fill="${color}" text-anchor="middle" transform="rotate(${rot} ${x} ${y})" filter="url(#drop-shadow)">${escaped}</text>`;
  }

  // Overlay wave line crossing characters
  const waveY1 = (20 + getRandomInt(0, 15)).toFixed(1);
  const waveY2 = (20 + getRandomInt(0, 15)).toFixed(1);
  const waveMidY = (15 + getRandomInt(0, 25)).toFixed(1);
  const overlayLine = `<path d="M 10 ${waveY1} Q 100 ${waveMidY} 190 ${waveY2}" stroke="#FFFFFF" stroke-width="1.2" fill="none" opacity="0.25" stroke-dasharray="6,4" />`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" style="background-color: transparent; border-radius: 12px; overflow: hidden; display: block; user-select: none;">
  <defs>
    <filter id="drop-shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="1.5" stdDeviation="0.6" flood-color="#000000" flood-opacity="0.95" />
    </filter>
    <linearGradient id="captcha-bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0B0C11" />
      <stop offset="100%" stop-color="#141520" />
    </linearGradient>
  </defs>
  <rect width="100%" height="100%" rx="12" fill="url(#captcha-bg)" stroke="#262738" stroke-width="1.5" />
  ${scatterDots}
  ${noiseLines}
  ${charsSvg}
  ${overlayLine}
</svg>`;
}

/**
 * Retrieves the persistent encryption key from environment or SQLite.
 */
function getCaptchaSecret(): Buffer {
  const envSecret = process.env.CAPTCHA_SECRET;
  if (envSecret && envSecret.length >= 16) {
    return crypto.createHash('sha256').update(envSecret).digest();
  }

  try {
    const db = getDB();
    const row = db.prepare('SELECT value FROM app_settings WHERE key = ?').get('captcha_secret') as { value: string } | undefined;
    if (row && row.value) {
      return Buffer.from(row.value, 'hex');
    }

    const newSecret = crypto.randomBytes(32);
    db.prepare('INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)').run('captcha_secret', newSecret.toString('hex'));
    return newSecret;
  } catch {
    // Fallback in-memory hash if DB not ready
    return crypto.createHash('sha256').update('fallback-photo-bingo-secret-key-32b').digest();
  }
}

/**
 * Encrypts captcha payload { id, code, exp } into an authenticated token.
 */
export function encryptCaptchaToken(id: string, code: string, ttlMs: number = 10 * 60 * 1000): string {
  const secret = getCaptchaSecret();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', secret, iv);

  const payload = JSON.stringify({
    id,
    code,
    exp: Date.now() + ttlMs
  });

  const encrypted = Buffer.concat([cipher.update(payload, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  // Combine iv (12) + tag (16) + encrypted data
  return Buffer.concat([iv, tag, encrypted]).toString('base64url');
}

/**
 * Decrypts and authenticates a captcha token.
 */
export function decryptCaptchaToken(token: string): { id: string; code: string; exp: number } | null {
  try {
    const buf = Buffer.from(token, 'base64url');
    if (buf.length < 28) return null; // 12 IV + 16 Tag

    const iv = buf.subarray(0, 12);
    const tag = buf.subarray(12, 28);
    const ciphertext = buf.subarray(28);

    const secret = getCaptchaSecret();
    const decipher = crypto.createDecipheriv('aes-256-gcm', secret, iv);
    decipher.setAuthTag(tag);

    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return JSON.parse(decrypted.toString('utf8'));
  } catch {
    return null;
  }
}

/**
 * Generates a full captcha challenge: code, token, raw SVG, and base64 data URL.
 */
export function generateCaptcha(): {
  token: string;
  svg: string;
  svgDataUrl: string;
} {
  const id = crypto.randomUUID();
  const code = generateCaptchaCode();
  const token = encryptCaptchaToken(id, code);
  const svg = generateCaptchaSvg(code);
  const svgBase64 = Buffer.from(svg, 'utf8').toString('base64');
  const svgDataUrl = `data:image/svg+xml;base64,${svgBase64}`;

  return {
    token,
    svg,
    svgDataUrl
  };
}

/**
 * Verifies the user's captcha input against the token:
 * 1. Authenticates & decrypts token
 * 2. Checks expiration (default 10 minutes)
 * 3. Checks replay attacks in SQLite (single-use token)
 * 4. Compares input (case-insensitive for letters, exact for symbols and numbers)
 */
export function verifyCaptchaToken(token: string, userInput: string): { success: boolean; error?: string } {
  if (!token || typeof token !== 'string') {
    return { success: false, error: 'Missing security captcha. Please complete the captcha verification.' };
  }

  if (!userInput || typeof userInput !== 'string' || !userInput.trim()) {
    return { success: false, error: 'Please enter the characters and symbols from the captcha.' };
  }

  const payload = decryptCaptchaToken(token);
  if (!payload) {
    return { success: false, error: 'Invalid or tampered captcha token. Please refresh the captcha.' };
  }

  // Check expiration
  if (Date.now() > payload.exp) {
    return { success: false, error: 'Captcha has expired. Please tap refresh to get a new code.' };
  }

  const db = getDB();

  // Replay check: Ensure this captcha token hasn't been used yet
  try {
    const existing = db.prepare('SELECT id FROM used_captchas WHERE id = ?').get(payload.id);
    if (existing) {
      return { success: false, error: 'This captcha has already been used. Please get a fresh code.' };
    }

    // Mark as used immediately to prevent replay
    db.prepare('INSERT INTO used_captchas (id, used_at) VALUES (?, ?)').run(payload.id, Date.now());

    // Clean up old used captchas (older than 1 hour)
    db.prepare('DELETE FROM used_captchas WHERE used_at < ?').run(Date.now() - 3600000);
  } catch (dbErr) {
    console.error('Error tracking used captcha in db:', dbErr);
  }

  // Compare input vs expected code:
  // Case-insensitive comparison for letters, exact comparison for symbols & digits.
  const cleanInput = userInput.trim().toLowerCase();
  const cleanExpected = payload.code.toLowerCase();

  if (cleanInput !== cleanExpected) {
    return { success: false, error: 'Incorrect security captcha. Please check the symbols and numbers and try again.' };
  }

  return { success: true };
}

/**
 * Rate limiter for signup requests per IP address.
 * Max 10 signup attempts per 5 minutes per IP.
 */
export function checkSignupRateLimit(ip: string, maxAttempts: number = 10, windowMs: number = 5 * 60 * 1000): { allowed: boolean; remaining: number } {
  try {
    const db = getDB();
    const now = Date.now();
    const windowStart = now - windowMs;

    // Purge records older than window
    db.prepare('DELETE FROM signup_rate_limits WHERE timestamp < ?').run(windowStart);

    // Count attempts in window
    const countRow = db.prepare('SELECT COUNT(*) as cnt FROM signup_rate_limits WHERE ip = ? AND timestamp >= ?').get(ip, windowStart) as { cnt: number };
    const currentCount = countRow ? countRow.cnt : 0;

    if (currentCount >= maxAttempts) {
      return { allowed: false, remaining: 0 };
    }

    // Record attempt
    db.prepare('INSERT INTO signup_rate_limits (ip, timestamp) VALUES (?, ?)').run(ip, now);
    return { allowed: true, remaining: maxAttempts - currentCount - 1 };
  } catch (err) {
    console.error('Error in checkSignupRateLimit:', err);
    return { allowed: true, remaining: maxAttempts };
  }
}

