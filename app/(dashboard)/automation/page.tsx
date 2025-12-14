'use client';

import { useState } from 'react';

interface CronJob {
  id: string;
  name: string;
  schedule: string;
  description: string;
  lastRun?: string;
}

const cronJobs: CronJob[] = [
  {
    id: 'sync-stocks-daily',
    name: 'Günlük Stok Senkronizasyonu',
    schedule: '0 2 * * * (Her gün saat 02:00)',
    description: 'Tüm pazaryerlerine stok miktarlarını senkronize eder',
  },
  {
    id: 'sync-orders-hourly',
    name: 'Saatlik Sipariş Çekme',
    schedule: '0 * * * * (Her saat başı)',
    description: 'Pazaryerlerinden yeni siparişleri çeker',
  },
  {
    id: 'check-low-stock',
    name: 'Düşük Stok Kontrolü',
    schedule: '0 9 * * * (Her gün saat 09:00)',
    description: 'Düşük stoklu ürünleri kontrol eder ve uyarı verir',
  },
  {
    id: 'cleanup-logs',
    name: 'Log Temizleme',
    schedule: '0 3 * * * (Her gün saat 03:00)',
    description: '30 günden eski webhook loglarını temizler',
  },
  {
    id: 'daily-report',
    name: 'Günlük Rapor',
    schedule: '0 23 * * * (Her gün saat 23:00)',
    description: 'Günlük özet rapor oluşturur',
  },
];

export default function AutomationPage() {
  const [running, setRunning] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, any>>({});

  const runJob = async (jobId: string) => {
    setRunning(jobId);
    try {
      const response = await fetch('/api/cron', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId }),
      });

      const result = await response.json();
      setResults(prev => ({ ...prev, [jobId]: result }));

      setTimeout(() => {
        setResults(prev => {
          const newResults = { ...prev };
          delete newResults[jobId];
          return newResults;
        });
      }, 5000);
    } catch (error) {
      console.error('Error running job:', error);
      setResults(prev => ({
        ...prev,
        [jobId]: { success: false, error: 'Failed to run job' },
      }));
    } finally {
      setRunning(null);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-3 md:p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl md:text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">Otomasyon & Zamanlanmış Görevler</h1>
        <p className="mt-2 text-gray-600">
          Otomatik çalışan görevleri yönetin ve manuel olarak çalıştırın
        </p>
      </div>

      {/* Info Box */}
      <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
        <div className="flex items-start gap-3">
          <span className="text-2xl">⏰</span>
          <div className="text-sm text-blue-900">
            <p className="font-medium">Cron Job'lar Hakkında</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>Tüm görevler otomatik olarak zamanında çalışır</li>
              <li>Manuel olarak da çalıştırabilirsiniz</li>
              <li>Görevler arka planda sessizce çalışır</li>
              <li>Hata durumunda loglar kaydedilir</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Cron Jobs Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {cronJobs.map((job) => (
          <div
            key={job.id}
            className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm"
          >
            <div className="mb-4">
              <h3 className="text-lg font-semibold text-gray-900">{job.name}</h3>
              <p className="mt-1 text-sm text-gray-600">{job.description}</p>
            </div>

            <div className="mb-4 space-y-2 rounded-lg bg-gray-50 p-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Zamanlama:</span>
                <span className="font-mono text-xs text-gray-900">{job.schedule}</span>
              </div>
              {job.lastRun && (
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Son Çalışma:</span>
                  <span className="text-gray-900">{job.lastRun}</span>
                </div>
              )}
            </div>

            {/* Result Message */}
            {results[job.id] && (
              <div
                className={`mb-4 rounded-lg p-3 text-sm ${
                  results[job.id].success
                    ? 'bg-green-50 text-green-800'
                    : 'bg-red-50 text-red-800'
                }`}
              >
                <p className="font-medium">
                  {results[job.id].success ? '✅ Başarılı' : '❌ Başarısız'}
                </p>
                <p className="mt-1 text-xs">{results[job.id].message || results[job.id].error}</p>
              </div>
            )}

            <button
              onClick={() => runJob(job.id)}
              disabled={running !== null}
              className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {running === job.id ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></span>
                  Çalıştırılıyor...
                </span>
              ) : (
                '▶️ Manuel Çalıştır'
              )}
            </button>
          </div>
        ))}
      </div>

      {/* Schedule Reference */}
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h3 className="mb-4 text-lg font-semibold text-gray-900">Cron Schedule Referansı</h3>
        <div className="space-y-2 text-sm">
          <div className="flex items-center gap-4">
            <code className="rounded bg-gray-100 px-2 py-1 font-mono">* * * * *</code>
            <span className="text-gray-600">Dakika Saat Gün Ay Haftanın günü</span>
          </div>
          <div className="ml-4 space-y-1 text-gray-600">
            <p>• <code className="rounded bg-gray-100 px-1">0 2 * * *</code> - Her gün saat 02:00</p>
            <p>• <code className="rounded bg-gray-100 px-1">0 * * * *</code> - Her saat başı</p>
            <p>• <code className="rounded bg-gray-100 px-1">*/15 * * * *</code> - Her 15 dakikada</p>
            <p>• <code className="rounded bg-gray-100 px-1">0 0 * * 0</code> - Her Pazar saat 00:00</p>
          </div>
        </div>
      </div>
    </div>
  );
}
