import { NextRequest, NextResponse } from 'next/server';
import { isAuthorizedAdmin } from '@/lib/adminAuth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const authenticated = isAuthorizedAdmin(req);
  return NextResponse.json({ authenticated });
}

