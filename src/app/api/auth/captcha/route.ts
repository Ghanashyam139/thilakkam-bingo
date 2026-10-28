import { NextResponse } from 'next/server';
import { generateCaptcha } from '@/lib/captcha';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const captcha = generateCaptcha();

    return NextResponse.json(
      {
        success: true,
        token: captcha.token,
        svg: captcha.svg,
        svgDataUrl: captcha.svgDataUrl
      },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      }
    );
  } catch (error: any) {
    console.error('Error generating captcha:', error);
    return NextResponse.json(
      { error: 'Failed to generate security captcha. Please try again.' },
      { status: 500 }
    );
  }
}

