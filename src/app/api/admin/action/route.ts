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
        uploadedAt: updatedCell?.uploaded_at,
        approvedAt: updatedCell?.approved_at,
        rejectionReason: status === 'rejected' ? rejectionReason : null,
        rejectionCount: updatedCell?.rejection_count || 0,
        score: player.bingo_score,
        approvedCount: player.approved_count
      });

      // 2. Broadcast updated leaderboard to all clients
      io.emit('leaderboard-update', leaderboard);

      // 3. Broadcast to admins to update submission queues
      io.emit('submission-handled', {
        playerId,
        tileIndex,
        status,
        uploadedAt: updatedCell?.uploaded_at,
        approvedAt: updatedCell?.approved_at,
        rejectionReason: status === 'rejected' ? rejectionReason : null,
        rejectionCount: updatedCell?.rejection_count || 0,
        cell: {
          player_id: playerId,
          player_name: player.nickname || player.name,
          player_nickname: player.nickname,
          player_department: player.department,
          tile_index: tileIndex,
          task_id: updatedCell?.task_id || 0,
          task_title: updatedCell?.task_title || '',
          task_description: updatedCell?.task_description || '',
          task_type: updatedCell?.task_type || 'photo',
          clue_image: updatedCell?.clue_image || null,
          image_path: updatedCell?.image_path || null,
          text_answer: updatedCell?.text_answer || null,
          uploaded_at: updatedCell?.uploaded_at || null,
          rejection_reason: status === 'rejected' ? rejectionReason : null,
          rejection_count: updatedCell?.rejection_count || 0
        }
      });
    }

    return NextResponse.json({
      success: true,
      player,
      grid,
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
