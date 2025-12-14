import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { cache } from '@/lib/redis';

export async function POST() {
  try {
    const session = await getServerSession();
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const keys = await cache.getKeys('rate_limit:*');
    let deletedCount = 0;

    for (const key of keys) {
      const success = await cache.del(key);
      if (success) deletedCount++;
    }

    return NextResponse.json({
      success: true,
      message: `${deletedCount} rate limit cleared`,
    });
  } catch (error) {
    console.error('Rate limit clear all error:', error);
    return NextResponse.json(
      { error: 'Failed to clear rate limits' },
      { status: 500 }
    );
  }
}
