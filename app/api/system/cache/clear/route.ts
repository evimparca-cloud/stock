import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { cache } from '@/lib/redis';

export async function POST() {
  try {
    const session = await getServerSession();
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const success = await cache.flush();
    
    if (success) {
      return NextResponse.json({ 
        success: true, 
        message: 'Tüm cache temizlendi' 
      });
    } else {
      return NextResponse.json({ 
        error: 'Cache temizleme başarısız' 
      }, { status: 500 });
    }
  } catch (error) {
    console.error('Cache clear error:', error);
    return NextResponse.json(
      { error: 'Failed to clear cache' },
      { status: 500 }
    );
  }
}
