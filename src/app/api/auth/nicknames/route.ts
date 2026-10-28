import { NextRequest, NextResponse } from 'next/server';
import { getAvailableNicknames, isNicknameAvailable } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const checkQuery = searchParams.get('check');

    if (checkQuery !== null) {
      const clean = checkQuery.trim();
      if (!clean) {
        return NextResponse.json({ nickname: '', available: false, error: 'Nickname cannot be empty' });
      }
      const available = isNicknameAvailable(clean);
      return NextResponse.json({ nickname: clean, available });
    }

    const { available, taken } = getAvailableNicknames();

    // Shuffle available suggestions to present a fresh fun set
    const shuffled = [...available].sort(() => Math.random() - 0.5);

    return NextResponse.json({
      suggestions: shuffled.slice(0, 10),
      totalAvailable: available.length,
      taken
    });
  } catch (error: any) {
    console.error('Error fetching nicknames:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch nicknames' },
      { status: 500 }
    );
  }
}
