import { NextRequest, NextResponse } from 'next/server';
import { signUpPlayer } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, password, nickname, name, department } = body;

    if (!email || !email.trim()) {
      return NextResponse.json({ error: 'Please provide a valid email address.' }, { status: 400 });
    }

    if (!nickname || !nickname.trim()) {
      return NextResponse.json({ error: 'Please enter or pick a funny nickname.' }, { status: 400 });
    }

    if (!password || password.length < 4) {
      return NextResponse.json({ error: 'Password must be at least 4 characters long.' }, { status: 400 });
    }

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
