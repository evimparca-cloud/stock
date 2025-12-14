/**
 * Bull Board - Queue Monitoring Dashboard API
 * GET /api/admin/queues - Dashboard data
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { 
  getStockSyncQueue, 
  getOrderProcessQueue, 
  getNotificationQueue,
  getQueueStats 
} from '@/lib/queue';

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || (session.user as any).role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get all queue stats
    const stats = await getQueueStats();

    // Get recent jobs from each queue
    const stockQueue = getStockSyncQueue();
    const orderQueue = getOrderProcessQueue();
    const notifyQueue = getNotificationQueue();

    const [
      stockWaiting,
      stockActive,
      stockCompleted,
      stockFailed,
      orderWaiting,
      orderActive,
      orderCompleted,
      orderFailed,
      notifyWaiting,
      notifyActive,
      notifyCompleted,
      notifyFailed,
    ] = await Promise.all([
      stockQueue?.getWaiting(0, 10) || Promise.resolve([]),
      stockQueue?.getActive(0, 10) || Promise.resolve([]),
      stockQueue?.getCompleted(0, 10) || Promise.resolve([]),
      stockQueue?.getFailed(0, 10) || Promise.resolve([]),
      orderQueue?.getWaiting(0, 10) || Promise.resolve([]),
      orderQueue?.getActive(0, 10) || Promise.resolve([]),
      orderQueue?.getCompleted(0, 10) || Promise.resolve([]),
      orderQueue?.getFailed(0, 10) || Promise.resolve([]),
      notifyQueue?.getWaiting(0, 10) || Promise.resolve([]),
      notifyQueue?.getActive(0, 10) || Promise.resolve([]),
      notifyQueue?.getCompleted(0, 10) || Promise.resolve([]),
      notifyQueue?.getFailed(0, 10) || Promise.resolve([]),
    ]);

    const formatJob = (job: any) => ({
      id: job.id,
      name: job.name,
      data: job.data,
      timestamp: job.timestamp,
      processedOn: job.processedOn,
      finishedOn: job.finishedOn,
      attemptsMade: job.attemptsMade,
      failedReason: job.failedReason,
    });

    return NextResponse.json({
      stats,
      queues: {
        'stock-sync': {
          counts: stats.stockSync,
          jobs: {
            waiting: stockWaiting.map(formatJob),
            active: stockActive.map(formatJob),
            completed: stockCompleted.map(formatJob),
            failed: stockFailed.map(formatJob),
          },
        },
        'order-process': {
          counts: stats.orderProcess,
          jobs: {
            waiting: orderWaiting.map(formatJob),
            active: orderActive.map(formatJob),
            completed: orderCompleted.map(formatJob),
            failed: orderFailed.map(formatJob),
          },
        },
        'notifications': {
          counts: stats.notifications,
          jobs: {
            waiting: notifyWaiting.map(formatJob),
            active: notifyActive.map(formatJob),
            completed: notifyCompleted.map(formatJob),
            failed: notifyFailed.map(formatJob),
          },
        },
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Queue stats error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch queue stats' },
      { status: 500 }
    );
  }
}
