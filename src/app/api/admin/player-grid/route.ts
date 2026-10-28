import { NextRequest, NextResponse } from 'next/server';
import { getPlayer, getPlayerGrid } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
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
