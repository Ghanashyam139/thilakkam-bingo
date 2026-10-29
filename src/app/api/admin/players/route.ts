import { NextRequest, NextResponse } from 'next/server';
import { deletePlayer, resetPlayerPassword, getLeaderboard } from '@/lib/db';
import { isAuthorizedAdmin } from '@/lib/adminAuth';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    if (!isAuthorizedAdmin(req)) {
      return NextResponse.json({ error: 'Unauthorized. Admin login required.' }, { status: 401 });
    }

    const body = await req.json();
    const { action, playerId, newPassword } = body;

    if (!playerId) {
      return NextResponse.json({ error: 'Player ID is required.' }, { status: 400 });
    }

    const io = (global as any).io;

    if (action === 'delete') {
      const result = deletePlayer(playerId);

      // Broadcast real-time updates
      if (io) {
        // 1. Force logout the player if currently connected
        io.to(`player-${playerId}`).emit('force-logout', {
          message: 'Your account was reset by an event administrator.'
        });
        // 2. Broadcast updated leaderboard
        io.emit('leaderboard-update', getLeaderboard());
      }

      return NextResponse.json({
        success: true,
        message: `Account for ${result.email || result.nickname || 'player'} has been deleted and the email is now freed for new signup.`,
        player: result
      });
    }

    if (action === 'reset_password') {
      const passwordToSet = (newPassword && newPassword.trim()) ? newPassword.trim() : 'Confianz@2026';
      const result = resetPlayerPassword(playerId, passwordToSet);

      return NextResponse.json({
        success: true,
        message: `Password for ${result.email || result.nickname} was reset to "${passwordToSet}".`,
        tempPassword: passwordToSet,
        player: result
      });
    }

    return NextResponse.json({ error: 'Invalid action. Must be "delete" or "reset_password".' }, { status: 400 });
  } catch (error: any) {
    console.error('Error in admin player management:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to perform player action.' },
      { status: 500 }
    );
  }
}

