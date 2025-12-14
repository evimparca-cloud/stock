import { NextRequest, NextResponse } from 'next/server';
import { CronScheduler } from '@/lib/cron/scheduler';
import { requireAdmin } from '@/lib/auth-check';

// GET /api/cron - Aktif cron job'ları listele
export async function GET() {
  try {
    await requireAdmin();
  } catch (error) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const jobs = CronScheduler.listJobs();

    return NextResponse.json({
      jobs,
      count: jobs.length,
    });
  } catch (error) {
    console.error('Error listing cron jobs:', error);
    return NextResponse.json(
      { error: 'Failed to list cron jobs' },
      { status: 500 }
    );
  }
}

// POST /api/cron - Manuel olarak bir job'ı çalıştır
export async function POST(request: NextRequest) {
  try {
    await requireAdmin();
  } catch (error) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { jobId } = body;

    if (!jobId) {
      return NextResponse.json(
        { error: 'jobId is required' },
        { status: 400 }
      );
    }

    await CronScheduler.runManually(jobId);

    return NextResponse.json({
      success: true,
      message: `Job ${jobId} executed successfully`,
    });
  } catch (error) {
    console.error('Error running cron job:', error);
    return NextResponse.json(
      {
        error: 'Failed to run cron job',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
