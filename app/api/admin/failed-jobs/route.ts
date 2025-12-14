/**
 * Admin API - Failed Jobs (Dead Letter Queue)
 * GET: Hatalı işleri listele
 * POST: İşi tekrar dene
 * DELETE: İşi sil
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getStockSyncQueue, getOrderProcessQueue, getNotificationQueue } from '@/lib/queue';

// GET - Hatalı işleri listele
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || (session.user as any).role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const queueName = searchParams.get('queue') || 'all';
    const limit = parseInt(searchParams.get('limit') || '50');

    const failedJobs: any[] = [];

    // Stock Sync Queue
    if (queueName === 'all' || queueName === 'stock-sync') {
      const stockQueue = getStockSyncQueue();
      if (stockQueue) {
        const stockFailed = await stockQueue.getFailed(0, limit);
        failedJobs.push(...stockFailed.map((job: any) => ({
          id: job.id,
          queue: 'stock-sync',
          name: job.name,
          data: job.data,
          failedReason: job.failedReason,
          attemptsMade: job.attemptsMade,
          timestamp: job.timestamp,
          processedOn: job.processedOn,
          finishedOn: job.finishedOn,
        })));
      }
    }

    // Order Process Queue
    if (queueName === 'all' || queueName === 'order-process') {
      const orderQueue = getOrderProcessQueue();
      if (orderQueue) {
        const orderFailed = await orderQueue.getFailed(0, limit);
        failedJobs.push(...orderFailed.map((job: any) => ({
          id: job.id,
          queue: 'order-process',
          name: job.name,
          data: job.data,
          failedReason: job.failedReason,
          attemptsMade: job.attemptsMade,
          timestamp: job.timestamp,
          processedOn: job.processedOn,
          finishedOn: job.finishedOn,
        })));
      }
    }

    // Notification Queue
    if (queueName === 'all' || queueName === 'notifications') {
      const notifyQueue = getNotificationQueue();
      if (notifyQueue) {
        const notifyFailed = await notifyQueue.getFailed(0, limit);
        failedJobs.push(...notifyFailed.map((job: any) => ({
          id: job.id,
          queue: 'notifications',
          name: job.name,
          data: job.data,
          failedReason: job.failedReason,
          attemptsMade: job.attemptsMade,
          timestamp: job.timestamp,
          processedOn: job.processedOn,
          finishedOn: job.finishedOn,
        })));
      }
    }

    // Queue stats
    const stockQueueStats = getStockSyncQueue();
    const orderQueueStats = getOrderProcessQueue();
    const notifyQueueStats = getNotificationQueue();

    const [stockCounts, orderCounts, notifyCounts] = await Promise.all([
      stockQueueStats?.getJobCounts() || Promise.resolve({}),
      orderQueueStats?.getJobCounts() || Promise.resolve({}),
      notifyQueueStats?.getJobCounts() || Promise.resolve({}),
    ]);

    return NextResponse.json({
      failedJobs,
      stats: {
        'stock-sync': stockCounts,
        'order-process': orderCounts,
        'notifications': notifyCounts,
      },
      total: failedJobs.length,
    });
  } catch (error) {
    console.error('Failed jobs fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch failed jobs' },
      { status: 500 }
    );
  }
}

// POST - İşi tekrar dene
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || (session.user as any).role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { jobId, queue } = body;

    if (!jobId || !queue) {
      return NextResponse.json(
        { error: 'jobId and queue are required' },
        { status: 400 }
      );
    }

    let targetQueue;
    switch (queue) {
      case 'stock-sync':
        targetQueue = getStockSyncQueue();
        break;
      case 'order-process':
        targetQueue = getOrderProcessQueue();
        break;
      case 'notifications':
        targetQueue = getNotificationQueue();
        break;
      default:
        return NextResponse.json({ error: 'Invalid queue name' }, { status: 400 });
    }

    if (!targetQueue) {
      return NextResponse.json({ error: 'Queue not available' }, { status: 503 });
    }

    const job = await targetQueue.getJob(jobId);
    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    // Retry the job
    await job.retry();

    return NextResponse.json({
      success: true,
      message: `Job ${jobId} queued for retry`,
      jobId,
    });
  } catch (error) {
    console.error('Job retry error:', error);
    return NextResponse.json(
      { error: 'Failed to retry job' },
      { status: 500 }
    );
  }
}

// PUT - Toplu işlem (Retry All / Delete All)
export async function PUT(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || (session.user as any).role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { action, queue } = body; // action: 'retry-all' | 'delete-all'

    if (!action || !['retry-all', 'delete-all'].includes(action)) {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    const queues = queue && queue !== 'all' 
      ? [queue] 
      : ['stock-sync', 'order-process', 'notifications'];

    let totalProcessed = 0;
    let errors: string[] = [];

    for (const queueName of queues) {
      let targetQueue;
      switch (queueName) {
        case 'stock-sync':
          targetQueue = getStockSyncQueue();
          break;
        case 'order-process':
          targetQueue = getOrderProcessQueue();
          break;
        case 'notifications':
          targetQueue = getNotificationQueue();
          break;
        default:
          continue;
      }

      if (!targetQueue) {
        errors.push(`Queue ${queueName} not available`);
        continue;
      }

      try {
        const failedJobs = await targetQueue.getFailed(0, 1000);
        
        for (const job of failedJobs) {
          try {
            if (action === 'retry-all') {
              await job.retry();
            } else {
              await job.remove();
            }
            totalProcessed++;
          } catch (err) {
            errors.push(`${queueName}:${job.id}`);
          }
        }
      } catch (err) {
        errors.push(`Queue ${queueName} error`);
      }
    }

    return NextResponse.json({
      success: true,
      action,
      totalProcessed,
      errors: errors.length > 0 ? errors : undefined,
      message: action === 'retry-all' 
        ? `${totalProcessed} iş tekrar kuyruğa alındı`
        : `${totalProcessed} iş silindi`,
    });
  } catch (error) {
    console.error('Bulk action error:', error);
    return NextResponse.json(
      { error: 'Failed to perform bulk action' },
      { status: 500 }
    );
  }
}

// DELETE - İşi sil
export async function DELETE(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || (session.user as any).role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const jobId = searchParams.get('jobId');
    const queue = searchParams.get('queue');

    if (!jobId || !queue) {
      return NextResponse.json(
        { error: 'jobId and queue are required' },
        { status: 400 }
      );
    }

    let targetQueue;
    switch (queue) {
      case 'stock-sync':
        targetQueue = getStockSyncQueue();
        break;
      case 'order-process':
        targetQueue = getOrderProcessQueue();
        break;
      case 'notifications':
        targetQueue = getNotificationQueue();
        break;
      default:
        return NextResponse.json({ error: 'Invalid queue name' }, { status: 400 });
    }

    if (!targetQueue) {
      return NextResponse.json({ error: 'Queue not available' }, { status: 503 });
    }

    const job = await targetQueue.getJob(jobId);
    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    await job.remove();

    return NextResponse.json({
      success: true,
      message: `Job ${jobId} deleted`,
    });
  } catch (error) {
    console.error('Job delete error:', error);
    return NextResponse.json(
      { error: 'Failed to delete job' },
      { status: 500 }
    );
  }
}
