import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { cache } from '@/lib/redis';

export async function POST() {
  try {
    const session = await getServerSession();
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const keys = await cache.getKeys('products:*');
    let deletedCount = 0;

    for (const key of keys) {
      const success = await cache.del(key);
      if (success) deletedCount++;
    }
    
    return NextResponse.json({ 
      success: true, 
      message: `${deletedCount} ürün cache'i temizlendi` 
    });
  } catch (error) {
    console.error('Cache clear products error:', error);
    return NextResponse.json(
      { error: 'Failed to clear products cache' },
      { status: 500 }
    );
  }
}
