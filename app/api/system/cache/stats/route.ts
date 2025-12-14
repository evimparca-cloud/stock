import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { cache, isRedisConnected } from '@/lib/redis';

export async function GET() {
  try {
    const session = await getServerSession();
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const connected = await isRedisConnected();
    
    if (!connected) {
      return NextResponse.json({
        connected: false,
        totalKeys: 0,
        memoryUsage: 'N/A',
        hitRate: 'N/A',
        error: 'Redis connection failed'
      });
    }

    const keys = await cache.getKeys();
    const info = await cache.getInfo();
    
    // Parse memory info
    let memoryUsage = 'N/A';
    if (info.memory) {
      const memoryMatch = info.memory.match(/used_memory_human:([^\r\n]+)/);
      if (memoryMatch) {
        memoryUsage = memoryMatch[1].trim();
      }
    }

    // Parse hit rate
    let hitRate = 'N/A';
    if (info.stats) {
      const hitsMatch = info.stats.match(/keyspace_hits:(\d+)/);
      const missesMatch = info.stats.match(/keyspace_misses:(\d+)/);
      
      if (hitsMatch && missesMatch) {
        const hits = parseInt(hitsMatch[1]);
        const misses = parseInt(missesMatch[1]);
        const total = hits + misses;
        
        if (total > 0) {
          hitRate = `${((hits / total) * 100).toFixed(1)}%`;
        }
      }
    }

    return NextResponse.json({
      connected: true,
      totalKeys: keys.length,
      memoryUsage,
      hitRate,
    });
  } catch (error) {
    console.error('Cache stats error:', error);
    return NextResponse.json(
      { error: 'Failed to get cache stats' },
      { status: 500 }
    );
  }
}
