import { NextResponse } from 'next/server';
import { getPendingSubmissions, getLeaderboard } from '@/lib/db';

export async function GET() {
  try {
    const pendingSubmissions = getPendingSubmissions();
    const leaderboard = getLeaderboard();

    return NextResponse.json({
      success: true,
      pendingSubmissions,
      leaderboard
    });
  } catch (error: any) {
    console.error('Error initializing admin dashboard:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error initializing admin dashboard' },
      { status: 500 }
    );
  }
}
