import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { PrismaClient } from '@prisma/client';
import { isRedisConnected } from '@/lib/redis';

const prisma = new PrismaClient();

export async function GET() {
  try {
    // Health check session gerektirmez (Docker health check için)
    const startTime = Date.now();
    
    // Database health check
    let databaseHealth = false;
    try {
      await prisma.$queryRaw`SELECT 1`;
      databaseHealth = true;
    } catch (error) {
      console.error('Database health check failed:', error);
    }

    // Redis health check
    const redisHealth = await isRedisConnected();

    // API response time
    const apiResponseTime = Date.now() - startTime;

    // System uptime (process uptime)
    const uptimeSeconds = process.uptime();
    const uptimeHours = Math.floor(uptimeSeconds / 3600);
    const uptimeMinutes = Math.floor((uptimeSeconds % 3600) / 60);
    const uptime = `${uptimeHours}h ${uptimeMinutes}m`;

    return NextResponse.json({
      database: databaseHealth,
      redis: redisHealth,
      apiResponseTime,
      uptime,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Health check error:', error);
    return NextResponse.json(
      { error: 'Failed to get system health' },
      { status: 500 }
    );
  }
}
