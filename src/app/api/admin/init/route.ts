import { NextRequest, NextResponse } from 'next/server';
import { getPendingSubmissions, getRejectedSubmissions, getLeaderboard } from '@/lib/db';
import { isAuthorizedAdmin } from '@/lib/adminAuth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    if (!isAuthorizedAdmin(req)) {
      return NextResponse.json({ error: 'Unauthorized. Admin login required.' }, { status: 401 });
    }

    const pendingSubmissions = getPendingSubmissions();
    const rejectedSubmissions = getRejectedSubmissions();
    const leaderboard = getLeaderboard();

    return NextResponse.json({
      success: true,
      pendingSubmissions,
      rejectedSubmissions,
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
