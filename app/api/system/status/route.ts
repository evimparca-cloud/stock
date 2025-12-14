import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth-helper';
import { prisma } from '@/lib/prisma';
import { isRedisConnected } from '@/lib/redis';
import { getActiveRequestCount, isServerShuttingDown } from '@/lib/graceful-shutdown';
import os from 'os';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await requireAdmin();
    const startTime = Date.now();

    // 1. Database Health
    let databaseHealth = { status: 'error', latency: 0 };
    try {
      const dbStart = Date.now();
      await prisma.$queryRaw`SELECT 1`;
      databaseHealth = { status: 'healthy', latency: Date.now() - dbStart };
    } catch (error) {
      databaseHealth = { status: 'error', latency: 0 };
    }

    // 2. Redis Health
    let redisHealth = { status: 'disconnected', latency: 0 };
    try {
      const redisStart = Date.now();
      const connected = await isRedisConnected();
      redisHealth = {
        status: connected ? 'healthy' : 'disconnected',
        latency: Date.now() - redisStart
      };
    } catch {
      redisHealth = { status: 'error', latency: 0 };
    }

    // 3. System Resources
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemory = totalMemory - freeMemory;
    const memoryUsagePercent = Math.round((usedMemory / totalMemory) * 100);

    const cpuLoad = os.loadavg();
    const cpuCount = os.cpus().length;

    // 4. Process Info
    const processMemory = process.memoryUsage();
    const processUptime = process.uptime();

    // 5. Application Stats
    const [
      totalProducts,
      totalOrders,
      pendingOrders,
      totalMarketplaces,
      activeMarketplaces,
    ] = await Promise.all([
      prisma.product.count(),
      prisma.order.count(),
      prisma.order.count({ where: { status: 'PENDING' } }),
      prisma.marketplace.count(),
      prisma.marketplace.count({ where: { isActive: true } }),
    ]);

    // 6. Server Info
    const serverInfo = {
      hostname: os.hostname(),
      platform: os.platform(),
      arch: os.arch(),
      nodeVersion: process.version,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      serverTime: new Date().toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul' }),
    };

    // 7. Graceful Shutdown Status
    const shutdownStatus = {
      isShuttingDown: isServerShuttingDown(),
      activeRequests: getActiveRequestCount(),
    };

    const responseTime = Date.now() - startTime;

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      responseTime,

      health: {
        overall: databaseHealth.status === 'healthy' ? 'healthy' : 'degraded',
        database: databaseHealth,
        redis: redisHealth,
      },

      system: {
        memory: {
          total: formatBytes(totalMemory),
          used: formatBytes(usedMemory),
          free: formatBytes(freeMemory),
          usagePercent: memoryUsagePercent,
        },
        cpu: {
          count: cpuCount,
          load1m: cpuLoad[0].toFixed(2),
          load5m: cpuLoad[1].toFixed(2),
          load15m: cpuLoad[2].toFixed(2),
        },
      },

      process: {
        uptime: formatUptime(processUptime),
        uptimeSeconds: Math.floor(processUptime),
        memory: {
          heapUsed: formatBytes(processMemory.heapUsed),
          heapTotal: formatBytes(processMemory.heapTotal),
          rss: formatBytes(processMemory.rss),
        },
      },

      application: {
        totalProducts,
        totalOrders,
        pendingOrders,
        totalMarketplaces,
        activeMarketplaces,
      },

      server: serverInfo,
      shutdown: shutdownStatus,
    });
  } catch (error: any) {
    console.error('System status error:', error);

    // Check if it's an authentication error
    if (error.message === 'Authentication required' || error.message === 'Admin access required') {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }

    return NextResponse.json(
      { error: 'System status check failed' },
      { status: 500 }
    );
  }
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  const parts = [];
  if (days > 0) parts.push(`${days} gun`);
  if (hours > 0) parts.push(`${hours} saat`);
  if (minutes > 0) parts.push(`${minutes} dakika`);

  return parts.length > 0 ? parts.join(' ') : '< 1 dakika';
}
