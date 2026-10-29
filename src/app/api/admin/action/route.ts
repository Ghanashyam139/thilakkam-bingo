import { NextRequest, NextResponse } from 'next/server';
import { updateTileStatus, getLeaderboard } from '@/lib/db';
import { isAuthorizedAdmin } from '@/lib/adminAuth';

export async function POST(req: NextRequest) {
  try {
    if (!isAuthorizedAdmin(req)) {
      return NextResponse.json({ error: 'Unauthorized. Admin login required.' }, { status: 401 });
    }

    const body = await req.json();
    const { playerId, tileIndex, status, rejectionReason } = body;

    if (!playerId || tileIndex === undefined || !status) {
      return NextResponse.json(
        { error: 'Missing required parameters (playerId, tileIndex, status)' },
        { status: 400 }
      );
    }

    if (status !== 'approved' && status !== 'rejected') {
      return NextResponse.json(
        { error: "Invalid status value. Must be 'approved' or 'rejected'" },
        { status: 400 }
      );
    }

    // Update in database and recalculate scores
    const { player, grid } = updateTileStatus(
      playerId,
      tileIndex,
      status,
      undefined, // imagePath remains unchanged
      rejectionReason || ''
    );

    // Fetch updated leaderboard
    const leaderboard = getLeaderboard();

    // Broadcast updates via socket
    const io = (global as any).io;
    if (io) {
      const updatedCell = grid.find((c) => c.tile_index === tileIndex);
      // 1. Notify the player room about their grid update
      io.to(`player-${playerId}`).emit('grid-update', {
        tileIndex,
        status,
        imagePath: updatedCell?.image_path,
        textAnswer: updatedCell?.text_answer,
        rejectionReason: status === 'rejected' ? rejectionReason : null,
        rejectionCount: updatedCell?.rejection_count || 0,
        score: player.bingo_score,
        approvedCount: player.approved_count
      });

      // 2. Broadcast updated leaderboard to all clients
      io.emit('leaderboard-update', leaderboard);

      // 3. Broadcast to admins to remove this submission from the feed
      io.emit('submission-handled', {
        playerId,
        tileIndex,
        status
      });
    }

    return NextResponse.json({
      success: true,
      player,
      leaderboard
    });
  } catch (error: any) {
    console.error('Error handling admin action:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error during admin action' },
      { status: 500 }
    );
  }
}
