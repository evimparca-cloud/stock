/**
 * Google OAuth Callback
 * Google'dan gelen authorization code'u işler
 */

import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const error = searchParams.get('error');

  if (error) {
    // Hata varsa backup sayfasına yönlendir
    return NextResponse.redirect(
      new URL(`/backup?error=${encodeURIComponent(error)}`, request.url)
    );
  }

  if (code) {
    // Başarılı - code ile backup sayfasına yönlendir
    return NextResponse.redirect(
      new URL(`/backup?google_code=${encodeURIComponent(code)}`, request.url)
    );
  }

  return NextResponse.redirect(new URL('/backup', request.url));
}
