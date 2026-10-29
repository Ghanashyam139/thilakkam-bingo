import { NextRequest, NextResponse } from 'next/server';
import { getPlayer, getPlayerGrid } from '@/lib/db';
import { isAuthorizedAdmin } from '@/lib/adminAuth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    if (!isAuthorizedAdmin(req)) {
      return NextResponse.json({ error: 'Unauthorized. Admin login required.' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const playerId = searchParams.get('id');

    if (!playerId) {
      return NextResponse.json({ error: 'Missing player ID parameter' }, { status: 400 });
    }

    const player = getPlayer(playerId);
    if (!player) {
      return NextResponse.json({ error: 'Player not found' }, { status: 404 });
    }

    const grid = getPlayerGrid(playerId);

    return NextResponse.json({
      success: true,
      player,
      grid
    });
  } catch (error: any) {
    console.error('Error fetching player grid for admin:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch player grid' },
      { status: 500 }
    );
  }
}
