import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { cache } from '@/lib/redis';

export async function GET() {
  try {
    const session = await getServerSession();
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get all rate limit keys
    const rateLimitKeys = await cache.getKeys('rate_limit:*');
    
    // Parse and categorize rate limits
    const stats = {
      totalActiveRateLimits: rateLimitKeys.length,
      loginAttempts: 0,
      apiRequests: 0,
      blockedIPs: [] as string[],
      recentActivity: [] as any[],
    };

    const blockedIPs = new Set<string>();
    const recentActivity: any[] = [];

    for (const key of rateLimitKeys) {
      const count = await cache.get<number>(key) || 0;
      
      // Parse key format: rate_limit:type:ip:email or rate_limit:ip
      const keyParts = key.split(':');
      
      if (keyParts[1] === 'login') {
        stats.loginAttempts += count;
        const ip = keyParts[2];
        const email = keyParts[3];
        
        if (count >= 5) { // Login limit threshold
          blockedIPs.add(ip);
        }
        
        recentActivity.push({
          type: 'login',
          ip,
          email,
          attempts: count,
          timestamp: Date.now(),
        });
      } else {
        stats.apiRequests += count;
        const ip = keyParts[1];
        
        if (count >= 100) { // API limit threshold
          blockedIPs.add(ip);
        }
        
        recentActivity.push({
          type: 'api',
          ip,
          requests: count,
          timestamp: Date.now(),
        });
      }
    }

    stats.blockedIPs = Array.from(blockedIPs);
    stats.recentActivity = recentActivity
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 20); // Last 20 activities

    return NextResponse.json(stats);
  } catch (error) {
    console.error('Rate limit stats error:', error);
    return NextResponse.json(
      { error: 'Failed to get rate limit stats' },
      { status: 500 }
    );
  }
}
