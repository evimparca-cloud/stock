import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import fs from 'fs/promises';
import path from 'path';

export const dynamic = 'force-dynamic';

const LOGS_FILE = path.join(process.cwd(), 'data', 'notification-logs.json');

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || (session.user as any).role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
      const data = await fs.readFile(LOGS_FILE, 'utf-8');
      const logs = JSON.parse(data);
      return NextResponse.json({ logs });
    } catch {
      return NextResponse.json({ logs: [] });
    }
  } catch (error) {
    console.error('Get notification logs error:', error);
    return NextResponse.json({ error: 'Failed to get logs' }, { status: 500 });
  }
}
