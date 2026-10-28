import { NextRequest, NextResponse } from 'next/server';
import { signUpPlayer } from '@/lib/db';
import { verifyCaptchaToken, checkSignupRateLimit } from '@/lib/captcha';

export async function POST(req: NextRequest) {
  try {
    // 1. IP-based Rate Limiting (Prevent automated signup flooding)
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
               req.headers.get('x-real-ip') ||
               '127.0.0.1';

    const rateLimit = checkSignupRateLimit(ip);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Too many signup attempts from your network. Please wait a few minutes before trying again.' },
        { status: 429 }
      );
    }

    const body = await req.json();
    const { email, password, nickname, name, department, captchaToken, captchaInput } = body;

    // 2. Validate Captcha
    if (!captchaToken || !captchaInput || typeof captchaInput !== 'string' || !captchaInput.trim()) {
      return NextResponse.json(
        { error: 'Please enter the characters and symbols from the security captcha.' },
        { status: 400 }
      );
    }

    const captchaResult = verifyCaptchaToken(captchaToken, captchaInput);
    if (!captchaResult.success) {
      return NextResponse.json(
        { error: captchaResult.error || 'Security captcha verification failed. Please try again.' },
        { status: 400 }
      );
    }

    // 3. Validate Player Fields
    const cleanEmail = (email || '').trim().toLowerCase();
    if (!cleanEmail) {
      return NextResponse.json({ error: 'Please provide a valid email address.' }, { status: 400 });
    }

    if (!cleanEmail.endsWith('@confianzit.com') || cleanEmail.indexOf('@') <= 0) {
      return NextResponse.json(
        { error: "Email addresses outside the organization won't be allowed. Please use your @confianzit.com email." },
        { status: 400 }
      );
    }

    if (!nickname || !nickname.trim()) {
      return NextResponse.json({ error: 'Please enter or pick a funny nickname.' }, { status: 400 });
    }

    if (!password || password.length < 4) {
      return NextResponse.json({ error: 'Password must be at least 4 characters long.' }, { status: 400 });
    }

    // 4. Create Player & Grid
    const { player, grid } = signUpPlayer(
      email.trim(),
      password,
      nickname.trim(),
      name || undefined,
      department || ''
    );

    // Broadcast new player to admins via socket
    const io = (global as any).io;
    if (io) {
      io.emit('leaderboard-update', (await import('@/lib/db')).getLeaderboard());
    }

    return NextResponse.json({
      success: true,
      player,
      grid
    });
  } catch (error: any) {
    console.error('Error signing up player:', error);
    return NextResponse.json(
      { error: error.message || 'Registration failed. Please try again.' },
      { status: 400 }
    );
  }
}
