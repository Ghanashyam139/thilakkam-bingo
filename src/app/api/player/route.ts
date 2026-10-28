import { NextRequest, NextResponse } from 'next/server';
import { registerPlayer, getPlayer, getPlayerGrid } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Missing player ID parameter' }, { status: 400 });
    }

    const player = getPlayer(id);
    if (!player) {
      return NextResponse.json({ error: 'Player session not found' }, { status: 404 });
    }

    const grid = getPlayerGrid(id);

    return NextResponse.json({
      success: true,
      player,
      grid
    });
  } catch (error: any) {
    console.error('Error fetching player data:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error fetching player data' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { firstName, lastName, name, department } = body;

    const resolvedName = (name || `${firstName || ''} ${lastName || ''}`).trim();

    if (!resolvedName) {
      return NextResponse.json(
        { error: 'Please provide your first name and second name.' },
        { status: 400 }
      );
    }

    // Register new player and create grid
    const player = registerPlayer(resolvedName, department || '');
    const grid = getPlayerGrid(player.id);

    return NextResponse.json({
      success: true,
      player,
      grid
    });
  } catch (error: any) {
    console.error('Error registering player:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error registering player' },
      { status: 500 }
    );
  }
}
