import { NextRequest, NextResponse } from 'next/server';
import { loginPlayer } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, password } = body;

    if (!email || !email.trim() || !password) {
      return NextResponse.json(
        { error: 'Please enter both your email address and password.' },
        { status: 400 }
      );
    }

    const { player, grid } = loginPlayer(email.trim(), password);

    return NextResponse.json({
      success: true,
      player,
      grid
    });
  } catch (error: any) {
    console.error('Error logging in player:', error);
    return NextResponse.json(
      { error: error.message || 'Invalid email or password.' },
      { status: 401 }
    );
  }
}
