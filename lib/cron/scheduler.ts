import cron from 'node-cron';

interface CronJob {
  id: string;
  name: string;
  schedule: string;
  enabled: boolean;
}

export class CronScheduler {
  private static jobs: Map<string, cron.ScheduledTask> = new Map();
  private static baseUrl = 'http://localhost:3000'; // Next.js server port

  /**
   * Internal API çağrısı yap
   */
  private static async callCronAPI(jobId: string) {
    try {
      console.log(`🔄 Running job via API: ${jobId}`);

      const response = await fetch(`${this.baseUrl}/api/cron/run`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': 'system-cron',
          'X-User-Email': 'system@localhost',
          'X-User-Role': 'admin'
        },
        body: JSON.stringify({ jobId }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`API Error: ${response.status} - ${error}`);
      }

      const result = await response.json();
      console.log(`✅ Job completed: ${jobId}`, result);
      return result;
    } catch (error) {
      console.error(`❌ Job failed: ${jobId}`, error);
      throw error;
    }
  }

  /**
   * Tüm cron job'ları başlat
   */
  static startAll() {
    console.log('🕐 Starting cron jobs...');
    console.log('📍 Base URL:', this.baseUrl);

    // Her 2 dakikada çalışacak job'lar
    const defaultSchedule = '*/2 * * * *'; // Her 2 dakikada

    // Tüm job tanımları
    const jobsToSchedule: CronJob[] = [
      {
        id: 'sync-stock',
        name: 'Stok Senkronizasyonu',
        schedule: defaultSchedule,
        enabled: true,
      },
      {
        id: 'sync-price',
        name: 'Fiyat Senkronizasyonu',
        schedule: defaultSchedule,
        enabled: true,
      },
      {
        id: 'sync-location',
        name: 'Lokasyon Senkronizasyonu',
        schedule: defaultSchedule,
        enabled: true,
      },
      {
        id: 'process-orders',
        name: 'Sipariş Çekme & İşleme & Stoktan Düş',
        schedule: defaultSchedule,
        enabled: true,
      },
      {
        id: 'process-cancelled-orders',
        name: 'İptal Siparişleri İşleme',
        schedule: defaultSchedule,
        enabled: true,
      },
      {
        id: 'sync-order-status',
        name: 'Sipariş Durumu Güncelleme',
        schedule: defaultSchedule,
        enabled: true,
      },
      {
        id: 'process-returns',
        name: 'İade Paketleri İşleme',
        schedule: defaultSchedule,
        enabled: true,
      },
      {
        id: 'daily-backup',
        name: 'Günlük Veritabanı Yedeği',
        schedule: '0 3 * * *', // Her gün 03:00'da
        enabled: true,
      },
      {
        id: 'cleanup-google-drive',
        name: 'Google Drive Yedek Temizliği',
        schedule: '0 4 * * 0', // Her Pazar 04:00'da
        enabled: true,
      },
    ];

    // Her bir job'ı schedule et
    jobsToSchedule.forEach((job) => {
      if (job.enabled) {
        this.schedule(job.id, job.schedule, async () => {
          await this.callCronAPI(job.id);
        }, {
          name: job.name,
          description: `Otomatik ${job.name}`,
        });
      }
    });

    console.log(`✅ ${this.jobs.size} cron jobs started (her 2 dakikada çalışacak)`);
    console.log('⏰ İlk çalıştırma 2 dakika sonra başlayacak');
  }

  /**
   * Belirli bir job'ı schedule et
   */
  private static schedule(
    id: string,
    schedule: string,
    task: () => Promise<void>,
    metadata?: { name: string; description: string }
  ) {
    if (this.jobs.has(id)) {
      console.warn(`⚠️  Job ${id} already scheduled`);
      return;
    }

    const job = cron.schedule(schedule, async () => {
      const startTime = Date.now();
      console.log(`🔄 Running job: ${metadata?.name || id}`);

      try {
        await task();
        const duration = Date.now() - startTime;
        console.log(`✅ Job completed: ${metadata?.name || id} (${duration}ms)`);
      } catch (error) {
        console.error(`❌ Job failed: ${metadata?.name || id}`, error);
      }
    });

    this.jobs.set(id, job);
    console.log(`📅 Scheduled: ${metadata?.name || id} (${schedule})`);
  }

  /**
   * Belirli bir job'ı durdur
   */
  static stop(id: string) {
    const job = this.jobs.get(id);
    if (job) {
      job.stop();
      this.jobs.delete(id);
      console.log(`⏹️  Stopped job: ${id}`);
    }
  }

  /**
   * Tüm job'ları durdur
   */
  static stopAll() {
    this.jobs.forEach((job, id) => {
      job.stop();
      console.log(`⏹️  Stopped job: ${id}`);
    });
    this.jobs.clear();
    console.log('⏹️  All cron jobs stopped');
  }

  /**
   * Aktif job'ları listele
   */
  static listJobs() {
    return Array.from(this.jobs.keys());
  }

  /**
   * Manuel olarak bir job'ı çalıştır
   */
  static async runManually(id: string) {
    console.log(`🔄 Manually running job: ${id}`);
    return await this.callCronAPI(id);
  }
}
