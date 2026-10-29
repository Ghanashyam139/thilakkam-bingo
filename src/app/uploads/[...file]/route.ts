import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

function detectMimeType(buffer: Buffer, filePath: string): string {
  if (buffer && buffer.length >= 4) {
    if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
      return 'image/jpeg';
    }
    if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) {
      return 'image/png';
    }
    if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x38) {
      return 'image/gif';
    }
    if (
      buffer.length >= 12 &&
      buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 &&
      buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50
    ) {
      return 'image/webp';
    }
  }

  const ext = path.extname(filePath).toLowerCase();
  const fallbackMimes: Record<string, string> = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml'
  };
  return fallbackMimes[ext] || 'application/octet-stream';
}

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ file: string[] }> }
) {
  try {
    const { file } = await ctx.params;
    if (!file || file.length === 0) {
      return new NextResponse('File not found', { status: 404 });
    }

    const safeFilename = path.basename(decodeURIComponent(file.join('/')));
    const possiblePaths = [
      path.resolve(process.cwd(), 'public', 'uploads', safeFilename),
      path.resolve(process.cwd(), 'uploads', safeFilename)
    ];

    let foundPath: string | null = null;
    for (const p of possiblePaths) {
      try {
        await fs.access(p);
        foundPath = p;
        break;
      } catch {
        // Continue checking
      }
    }

    if (!foundPath) {
      return new NextResponse('File not found', { status: 404 });
    }

    const buffer = await fs.readFile(foundPath);
    const contentType = detectMimeType(buffer, safeFilename);

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Length': buffer.length.toString(),
        'Cache-Control': 'public, max-age=31536000, immutable',
        'Access-Control-Allow-Origin': '*'
      }
    });
  } catch (err) {
    console.error('Error serving upload:', err);
    return new NextResponse('File not found', { status: 404 });
  }
}
