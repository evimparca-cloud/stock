/**
 * Google Drive OAuth Authentication
 * Kullanıcının kendi Google hesabıyla giriş yapması
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
// Dinamik redirect URI - mevcut request'ten port al
const getRedirectUri = (request: Request) => {
  const url = new URL(request.url);
  return `${url.protocol}//${url.host}/api/admin/backup/google-callback`;
};

// GET - OAuth URL oluştur
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || (session.user as any).role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!GOOGLE_CLIENT_ID) {
      return NextResponse.json({ 
        error: 'Google OAuth not configured',
        instructions: 'Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to .env'
      }, { status: 400 });
    }

    // OAuth URL oluştur
    const scopes = [
      'https://www.googleapis.com/auth/drive.file', // Sadece uygulama dosyalarına erişim
    ];

    const redirectUri = getRedirectUri(request);
    
    const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    authUrl.searchParams.set('client_id', GOOGLE_CLIENT_ID);
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('scope', scopes.join(' '));
    authUrl.searchParams.set('access_type', 'offline'); // Refresh token için
    authUrl.searchParams.set('prompt', 'consent'); // Her seferinde izin iste

    return NextResponse.json({ 
      authUrl: authUrl.toString(),
      configured: true 
    });
  } catch (error: any) {
    console.error('Google auth error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST - Token'ı kaydet (callback'ten sonra)
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || (session.user as any).role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { code } = await request.json();

    if (!code) {
      return NextResponse.json({ error: 'Authorization code required' }, { status: 400 });
    }

    // Code'u token'a çevir
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID!,
        client_secret: GOOGLE_CLIENT_SECRET!,
        code,
        grant_type: 'authorization_code',
        redirect_uri: getRedirectUri(request),
      }),
    });

    const tokens = await tokenResponse.json();

    if (tokens.error) {
      return NextResponse.json({ error: tokens.error_description || tokens.error }, { status: 400 });
    }

    // Token'ları .env'ye yazmak yerine veritabanına kaydedelim
    // Şimdilik response'da döndürelim - kullanıcı .env'ye ekleyebilir
    // Token'ları environment'a kaydet (geçici - production'da veritabanı kullanın)
    process.env.GOOGLE_ACCESS_TOKEN = tokens.access_token;
    process.env.GOOGLE_REFRESH_TOKEN = tokens.refresh_token;

    return NextResponse.json({
      success: true,
      message: 'Google Drive bağlantısı başarılı! Token\'lar kaydedildi.',
      configured: true,
      instructions: 'Kalıcı olması için .env dosyasına ekleyin:\nGOOGLE_ACCESS_TOKEN=' + tokens.access_token + '\nGOOGLE_REFRESH_TOKEN=' + tokens.refresh_token,
    });
  } catch (error: any) {
    console.error('Token exchange error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
