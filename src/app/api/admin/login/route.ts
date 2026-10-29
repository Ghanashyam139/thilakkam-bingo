import { NextRequest, NextResponse } from 'next/server';
import { checkAdminCredentials, createAdminSessionToken } from '@/lib/adminAuth';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { username, password } = body;

    if (!username || !password) {
      return NextResponse.json(
        { error: 'Please enter both admin username and password.' },
        { status: 400 }
      );
    }

    const isValid = checkAdminCredentials(username, password);
    if (!isValid) {
      return NextResponse.json(
        { error: 'Invalid admin credentials. Access denied.' },
        { status: 401 }
      );
    }

    const token = createAdminSessionToken();

    const response = NextResponse.json({
      success: true,
      token,
      message: 'Admin authenticated successfully.'
    });

    // Set secure HTTP-only cookie
    response.cookies.set({
      name: 'admin_session',
      value: token,
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 24 * 60 * 60 // 24 hours
    });

    return response;
  } catch (error: any) {
    console.error('Error during admin login:', error);
    return NextResponse.json(
      { error: error.message || 'Login failed.' },
      { status: 500 }
    );
  }
}

