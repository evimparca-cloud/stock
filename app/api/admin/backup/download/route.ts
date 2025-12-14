/**
 * Backup Download API
 * Yedek dosyasını indir
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { promises as fs } from 'fs';
import path from 'path';

const BACKUP_DIR = process.env.BACKUP_DIR || './backups';

export async function GET(request: Request) {
    try {
        // Session kontrolü
        let isAdmin = false;
        try {
            const session = await getServerSession(authOptions);
            isAdmin = !!(session?.user && (session.user as any).role === 'admin');
        } catch (sessionError) {
            console.error('Session error:', sessionError);
        }

        if (!isAdmin) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const fileName = searchParams.get('file');

        if (!fileName) {
            return NextResponse.json({ error: 'File name required' }, { status: 400 });
        }

        // Güvenlik kontrolü - sadece backup dosyaları indirilebilir
        if (!fileName.match(/^(stock_backup_|manual_backup_).*\.(sql\.gz|sql\.gz\.enc)$/)) {
            return NextResponse.json({ error: 'Invalid file name' }, { status: 400 });
        }

        const filePath = path.join(BACKUP_DIR, fileName);

        // Dosya var mı kontrol et
        try {
            await fs.access(filePath);
        } catch {
            return NextResponse.json({ error: 'File not found' }, { status: 404 });
        }

        // Dosyayı oku
        const fileContent = await fs.readFile(filePath);
        const stats = await fs.stat(filePath);

        // Response headers
        const headers = new Headers();
        headers.set('Content-Type', 'application/octet-stream');
        headers.set('Content-Disposition', `attachment; filename="${fileName}"`);
        headers.set('Content-Length', stats.size.toString());

        return new Response(fileContent, {
            status: 200,
            headers,
        });
    } catch (error: any) {
        console.error('Backup download error:', error);
        return NextResponse.json({
            error: 'Download failed',
            details: error?.message || 'Unknown error'
        }, { status: 500 });
    }
}
