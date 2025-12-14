/**
 * Google Drive Klasör Listesi
 * STOK_YEDEK klasörünün ID'sini bul
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || (session.user as any).role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const accessToken = process.env.GOOGLE_ACCESS_TOKEN;
    if (!accessToken) {
      return NextResponse.json({ error: 'Google Drive not connected' }, { status: 400 });
    }

    // Klasörleri listele
    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=mimeType='application/vnd.google-apps.folder'&fields=files(id,name,parents)`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Google API error: ${response.status}`);
    }

    const data = await response.json();
    const folders = data.files || [];

    // STOK_YEDEK klasörünü bul
    const stokYedekFolder = folders.find((folder: any) => folder.name === 'STOK_YEDEK');

    return NextResponse.json({
      folders: folders.map((f: any) => ({ id: f.id, name: f.name })),
      stokYedekFolder: stokYedekFolder || null,
      recommendation: stokYedekFolder
        ? `STOK_YEDEK klasörü bulundu! ID: ${stokYedekFolder.id}`
        : 'STOK_YEDEK klasörü bulunamadı. Google Drive\'da oluşturun.',
    });
  } catch (error: any) {
    console.error('Google folders error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
