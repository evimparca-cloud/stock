/**
 * Google Drive Otomatik Temizlik
 * 30 günden eski yedekleri sil
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || (session.user as any).role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const accessToken = process.env.GOOGLE_ACCESS_TOKEN;
    const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID || 'root';

    if (!accessToken) {
      return NextResponse.json({ error: 'Google Drive not connected' }, { status: 400 });
    }

    // 30 gün önceki tarih
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const cutoffDate = thirtyDaysAgo.toISOString();

    console.log(`[Cleanup] Deleting Google Drive backups older than: ${cutoffDate}`);

    // STOK_YEDEK klasöründeki dosyaları listele
    const listResponse = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=parents in '${folderId}' and name contains 'backup' and createdTime < '${cutoffDate}'&fields=files(id,name,createdTime,size)`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      }
    );

    if (!listResponse.ok) {
      throw new Error(`Google API error: ${listResponse.status}`);
    }

    const listData = await listResponse.json();
    const oldFiles = listData.files || [];

    console.log(`[Cleanup] Found ${oldFiles.length} old backup files to delete`);

    let deletedCount = 0;
    let totalSizeFreed = 0;
    const deletedFiles = [];

    // Her dosyayı sil
    for (const file of oldFiles) {
      try {
        const deleteResponse = await fetch(
          `https://www.googleapis.com/drive/v3/files/${file.id}`,
          {
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
            },
          }
        );

        if (deleteResponse.ok) {
          deletedCount++;
          totalSizeFreed += parseInt(file.size || '0');
          deletedFiles.push({
            name: file.name,
            createdTime: file.createdTime,
            size: file.size,
          });
          console.log(`[Cleanup] Deleted: ${file.name} (${file.createdTime})`);
        } else {
          console.error(`[Cleanup] Failed to delete ${file.name}: ${deleteResponse.status}`);
        }
      } catch (error) {
        console.error(`[Cleanup] Error deleting ${file.name}:`, error);
      }
    }

    const sizeFreedMB = (totalSizeFreed / (1024 * 1024)).toFixed(2);

    return NextResponse.json({
      success: true,
      message: `Google Drive cleanup completed`,
      stats: {
        deletedCount,
        totalSizeFreed: `${sizeFreedMB} MB`,
        cutoffDate,
        deletedFiles,
      },
    });
  } catch (error: any) {
    console.error('Google Drive cleanup error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// GET - Temizlenecek dosyaları listele (silmeden önce önizleme)
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || (session.user as any).role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const accessToken = process.env.GOOGLE_ACCESS_TOKEN;
    const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID || 'root';

    if (!accessToken) {
      return NextResponse.json({ error: 'Google Drive not connected' }, { status: 400 });
    }

    // 30 gün önceki tarih
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const cutoffDate = thirtyDaysAgo.toISOString();

    // Eski dosyaları listele
    const listResponse = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=parents in '${folderId}' and name contains 'backup' and createdTime < '${cutoffDate}'&fields=files(id,name,createdTime,size)`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      }
    );

    if (!listResponse.ok) {
      throw new Error(`Google API error: ${listResponse.status}`);
    }

    const listData = await listResponse.json();
    const oldFiles = listData.files || [];

    const totalSize = oldFiles.reduce((sum: number, file: any) => sum + parseInt(file.size || '0'), 0);
    const totalSizeMB = (totalSize / (1024 * 1024)).toFixed(2);

    return NextResponse.json({
      cutoffDate,
      oldFiles: oldFiles.map((f: any) => ({
        name: f.name,
        createdTime: f.createdTime,
        size: f.size,
        sizeFormatted: formatBytes(parseInt(f.size || '0')),
      })),
      stats: {
        count: oldFiles.length,
        totalSize: `${totalSizeMB} MB`,
      },
    });
  } catch (error: any) {
    console.error('Google Drive cleanup preview error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
