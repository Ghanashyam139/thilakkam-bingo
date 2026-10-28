import { NextResponse } from 'next/server';
import { getLeaderboard } from '@/lib/db';

export async function GET() {
  try {
    const fullLeaderboard = getLeaderboard();
    return NextResponse.json({
      success: true,
      top10: fullLeaderboard.slice(0, 10),
      leaderboard: fullLeaderboard,
      totalPlayers: fullLeaderboard.length
    });
  } catch (error: any) {
    console.error('Error fetching public leaderboard:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch leaderboard' },
      { status: 500 }
    );
  }
}
