import { NextRequest, NextResponse } from 'next/server';
import { updateTileStatus, getPlayer, getPlayerGrid } from '@/lib/db';
import { promises as fs } from 'fs';
import path from 'path';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const playerId = formData.get('playerId') as string;
    const tileIndexStr = formData.get('tileIndex') as string;
    const textAnswer = (formData.get('textAnswer') as string || '').trim();
    const file = formData.get('image') as File | null;

    if (!playerId || !tileIndexStr) {
      return NextResponse.json(
        { error: 'Missing required parameters (playerId or tileIndex)' },
        { status: 400 }
      );
    }

    if (!file && !textAnswer) {
      return NextResponse.json(
        { error: 'Please provide either a photo upload or a text answer to submit.' },
        { status: 400 }
      );
    }

    const tileIndex = parseInt(tileIndexStr, 10);
    if (isNaN(tileIndex) || tileIndex < 0 || tileIndex >= 25) {
      return NextResponse.json({ error: 'Invalid tile index' }, { status: 400 });
    }

    const player = getPlayer(playerId);
    if (!player) {
      return NextResponse.json({ error: 'Player session not found' }, { status: 404 });
    }

    const currentGrid = getPlayerGrid(playerId);
    const existingCell = currentGrid.find((c) => c.tile_index === tileIndex);
    if (!existingCell) {
      return NextResponse.json({ error: 'Tile not found' }, { status: 404 });
    }

    if (existingCell.status === 'approved') {
      return NextResponse.json(
        { error: 'This challenge has already been approved and cannot be modified.' },
        { status: 400 }
      );
    }

    // If cell was rejected, only 1 retry is allowed (rejection_count must be < 2)
    if (existingCell.status === 'rejected' && (existingCell.rejection_count || 0) >= 2) {
      return NextResponse.json(
        { error: 'Maximum retry limit reached. You can only retry 1 time after a rejection.' },
        { status: 400 }
      );
    }

    let dbImagePath: string | null = null;

    // Handle file upload if provided
    if (file && typeof file.arrayBuffer === 'function' && file.size > 0) {
      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);

      let ext = path.extname(file.name).toLowerCase();
      if (file.type === 'image/jpeg' && ext !== '.jpg' && ext !== '.jpeg') {
        ext = '.jpg';
      } else if (file.type === 'image/png' && ext !== '.png') {
        ext = '.png';
      } else if (file.type === 'image/webp' && ext !== '.webp') {
        ext = '.webp';
      } else if (!ext) {
        ext = '.jpg';
      }

      const filename = `${playerId}_tile_${tileIndex}_${Date.now()}${ext}`;
      const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
      await fs.mkdir(uploadsDir, { recursive: true, mode: 0o755 });
      const uploadPath = path.join(uploadsDir, filename);

      await fs.writeFile(uploadPath, buffer, { mode: 0o644 });
      dbImagePath = `/uploads/${filename}`;
    }

    // Update status to pending in DB (preserves current rejection_count)
    const { player: updatedPlayer, grid: updatedGrid } = updateTileStatus(
      playerId,
      tileIndex,
      'pending',
      dbImagePath,
      undefined,
      textAnswer || undefined
    );

    const updatedCell = updatedGrid.find((c) => c.tile_index === tileIndex);

    // Broadcast socket updates
    const io = (global as any).io;
    if (io) {
      const pendingData = {
        player_id: playerId,
        player_name: updatedPlayer.nickname || updatedPlayer.name,
        player_department: updatedPlayer.department,
        tile_index: tileIndex,
        task_id: updatedCell?.task_id || 0,
        task_title: updatedCell?.task_title || '',
        task_description: updatedCell?.task_description || '',
        task_type: updatedCell?.task_type || (textAnswer ? 'question' : 'photo'),
        clue_image: updatedCell?.clue_image || null,
        image_path: updatedCell?.image_path || dbImagePath,
        text_answer: updatedCell?.text_answer || textAnswer || null,
        uploaded_at: updatedCell?.uploaded_at || new Date().toISOString(),
        approved_at: null,
        rejection_count: updatedCell?.rejection_count || 0
      };

      // Broadcast to Admin feed
      io.emit('new-submission', pendingData);

      // Notify the specific player
      io.to(`player-${playerId}`).emit('grid-update', {
        tileIndex,
        status: 'pending',
        imagePath: updatedCell?.image_path || dbImagePath,
        textAnswer: updatedCell?.text_answer || textAnswer || null,
        uploadedAt: updatedCell?.uploaded_at || new Date().toISOString(),
        approvedAt: null,
        rejectionReason: null,
        rejectionCount: updatedCell?.rejection_count || 0,
        score: updatedPlayer.bingo_score,
        approvedCount: updatedPlayer.approved_count
      });
    }

    return NextResponse.json({
      success: true,
      imagePath: updatedCell?.image_path || dbImagePath,
      textAnswer: updatedCell?.text_answer || textAnswer || null,
      uploadedAt: updatedCell?.uploaded_at || new Date().toISOString(),
      approvedAt: null,
      player: updatedPlayer
    });
  } catch (error: any) {
    console.error('Error submitting challenge:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error during submission' },
      { status: 500 }
    );
  }
}
