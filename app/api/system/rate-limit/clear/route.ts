import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { cache } from '@/lib/redis';

export async function POST(request: Request) {
  try {
    const session = await getServerSession();
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { ip, type } = await request.json();

    if (!ip) {
      return NextResponse.json({ error: 'IP address required' }, { status: 400 });
    }

    let deletedCount = 0;
    let pattern = '';

    if (type === 'login') {
      pattern = `rate_limit:login:${ip}:*`;
    } else if (type === 'api') {
      pattern = `rate_limit:${ip}`;
    } else {
      // Clear all rate limits for this IP
      const loginKeys = await cache.getKeys(`rate_limit:login:${ip}:*`);
      const apiKeys = await cache.getKeys(`rate_limit:${ip}`);
      const allKeys = [...loginKeys, ...apiKeys];
      
      for (const key of allKeys) {
        const success = await cache.del(key);
        if (success) deletedCount++;
      }
      
      return NextResponse.json({
        success: true,
        message: `${deletedCount} rate limit cleared for IP ${ip}`,
      });
    }

    const keys = await cache.getKeys(pattern);
    
    for (const key of keys) {
      const success = await cache.del(key);
      if (success) deletedCount++;
    }

    return NextResponse.json({
      success: true,
      message: `${deletedCount} ${type} rate limit cleared for IP ${ip}`,
    });
  } catch (error) {
    console.error('Rate limit clear error:', error);
    return NextResponse.json(
      { error: 'Failed to clear rate limit' },
      { status: 500 }
    );
  }
}
