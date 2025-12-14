'use client';

import { useEffect, useState } from 'react';

interface CronJob {
  id: string;
  name: string;
  description: string;
  schedule: string;
  enabled: boolean;
  lastRun?: string;
  nextRun?: string;
}

export default function CronPage() {
  // Default jobs
  const defaultJobs: CronJob[] = [
    {
      id: 'sync-stock',
      name: 'Stok Senkronizasyonu',
      description: 'Tüm pazaryerlerinde stok bilgilerini günceller',
      schedule: '0 */6 * * *', // Her 6 saatte bir
      enabled: true,
    },
    {
      id: 'sync-price',
      name: 'Fiyat Senkronizasyonu',
      description: 'Tüm pazaryerlerinde fiyat bilgilerini günceller',
      schedule: '0 2 * * *', // Her gün saat 02:00
      enabled: true,
    },
    {
      id: 'sync-location',
      name: 'Lokasyon Senkronizasyonu',
      description: 'Yerel lokasyon bilgilerini pazaryerlerine gönderir',
      schedule: '0 4 * * *', // Her gün saat 04:00
      enabled: true,
    },
    {
      id: 'process-orders',
      name: 'Sipariş Çekme & İşleme & Stoktan Düş',
      description: 'Yeni siparişleri çeker, işler ve stoktan düşer',
      schedule: '*/15 * * * *', // Her 15 dakikada bir
      enabled: true,
    },
    {
      id: 'process-cancelled-orders',
      name: 'İptal Siparişleri İşleme',
      description: 'İptal edilen siparişlerin stoklarını geri ekler',
      schedule: '*/30 * * * *', // Her 30 dakikada bir
      enabled: true,
    },
    {
      id: 'sync-order-status',
      name: 'Sipariş Durumu Güncelleme',
      description: 'Mevcut siparişlerin durumlarını günceller',
      schedule: '0 */2 * * *', // Her 2 saatte bir
      enabled: true,
    },
  ];

  // İlk render'da her zaman defaultJobs kullan (SSR ve client ilk render aynı olsun)
  const [jobs, setJobs] = useState<CronJob[]>(defaultJobs);
  const [isLoaded, setIsLoaded] = useState(false);

  const [running, setRunning] = useState<string | null>(null);
  const [editingJob, setEditingJob] = useState<CronJob | null>(null);
  const [newSchedule, setNewSchedule] = useState<string>('');

  // Client tarafında localStorage'dan ayarları yükle
  useEffect(() => {
    console.log('🚀 useEffect çalıştı - window var mı?', typeof window !== 'undefined');
    
    if (typeof window === 'undefined') {
      console.log('⚠️ Window yok, server tarafındayız');
      return;
    }
    
    console.log('🔍 localStorage kontrol ediliyor...');
    const saved = localStorage.getItem('cronJobs');
    console.log('📦 localStorage içeriği:', saved ? saved.substring(0, 100) + '...' : 'null/boş');
    
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as CronJob[];
        console.log('✅ Parsed jobs sayısı:', parsed.length);
        console.log('✅ İlk job:', parsed[0]);
        
        if (Array.isArray(parsed) && parsed.length > 0) {
          console.log('🔄 Jobs state güncelleniyor...');
          setJobs(parsed);
        }
      } catch (error) {
        console.error('❌ localStorage parse hatası:', error);
      }
    } else {
      console.log('ℹ️ localStorage boş, defaultJobs kullanılıyor');
    }
    
    setIsLoaded(true);
    console.log('✅ Yükleme tamamlandı');
  }, []);

  // Jobs değiştiğinde localStorage'a kaydet (ama sadece yüklendikten sonra)
  useEffect(() => {
    if (!isLoaded) return; // İlk yüklemede kaydetme
    if (typeof window !== 'undefined') {
      console.log('💾 localStorage\'a kaydediliyor:', jobs);
      localStorage.setItem('cronJobs', JSON.stringify(jobs));
    }
  }, [jobs, isLoaded]);

  const toggleJob = (jobId: string) => {
    setJobs(jobs.map(job => 
      job.id === jobId ? { ...job, enabled: !job.enabled } : job
    ));
  };

  const openEditModal = (job: CronJob) => {
    setEditingJob(job);
    setNewSchedule(job.schedule);
  };

  const saveSchedule = () => {
    if (!editingJob) return;
    
    const updatedJobs = jobs.map(job =>
      job.id === editingJob.id ? { ...job, schedule: newSchedule } : job
    );
    
    setJobs(updatedJobs);
    
    // Show success message
    alert(`✅ Zamanlama kaydedildi!\n\n${editingJob.name}\nYeni zamanlama: ${getCronDescription(newSchedule)}`);
    
    setEditingJob(null);
    setNewSchedule('');
  };

  const resetToDefaults = () => {
    if (confirm('⚠️ Tüm zamanlamaları varsayılan ayarlara sıfırlamak istediğinizden emin misiniz?')) {
      setJobs(defaultJobs);
      if (typeof window !== 'undefined') {
        localStorage.setItem('cronJobs', JSON.stringify(defaultJobs));
      }
      alert('✅ Tüm zamanlamalar varsayılan ayarlara sıfırlandı!');
    }
  };

  const runJobNow = async (jobId: string) => {
    setRunning(jobId);
    try {
      console.log('🚀 Starting job:', jobId);
      
      // Manuel olarak job'u tetikle
      const response = await fetch(`/api/cron/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('API Error:', response.status, errorText);
        alert(`❌ API Hatası (${response.status}): ${errorText}`);
        return;
      }

      const result = await response.json();
      console.log('Job result:', result);
      
      if (result.success) {
        alert(`✅ ${result.message}`);
      } else {
        alert(`❌ Hata: ${result.error || 'Bilinmeyen hata'}\n\nDetay: ${JSON.stringify(result, null, 2)}`);
      }
    } catch (error) {
      console.error('Error running job:', error);
      alert(`❌ İşlem başarısız!\n\n${error instanceof Error ? error.message : 'Bilinmeyen hata'}`);
    } finally {
      setRunning(null);
    }
  };

  const getCronDescription = (schedule?: string) => {
    if (!schedule) return 'Belirlenmemiş';
    
    const descriptions: Record<string, string> = {
      '*/5 * * * *': 'Her 5 dakikada bir',
      '*/15 * * * *': 'Her 15 dakikada bir',
      '*/20 * * * *': 'Her 20 dakikada bir',
      '*/30 * * * *': 'Her 30 dakikada bir',
      '0 * * * *': 'Her saatte bir',
      '0 */1 * * *': 'Her saatte bir',
      '0 */2 * * *': 'Her 2 saatte bir',
      '0 */6 * * *': 'Her 6 saatte bir',
      '0 2 * * *': 'Her gün saat 02:00',
      '0 4 * * *': 'Her gün saat 04:00',
      '0 0 * * *': 'Her gün gece yarısı',
      '0 0 * * 0': 'Her Pazar 00:00',
      '0 0 1 * *': 'Her ayın 1\'i',
    };
    return descriptions[schedule] || schedule;
  };

  return (
    <div className="min-h-screen p-3 md:p-6 space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-green-600 to-teal-600 rounded-2xl p-6 shadow-lg">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="bg-white p-3 rounded-xl shadow-md">
              <span className="text-3xl">⏰</span>
            </div>
            <div>
              <h1 className="text-2xl md:text-4xl font-bold text-white">Zamanlanmış Görevler</h1>
              <p className="mt-1 text-green-100">
                Otomatik senkronizasyon ve görev yönetimi
              </p>
            </div>
          </div>
          <button
            onClick={resetToDefaults}
            className="px-4 py-2 rounded-lg bg-white/20 hover:bg-white/30 text-white font-semibold transition-all shadow-md hover:shadow-lg backdrop-blur-sm"
          >
            🔄 Varsayılana Sıfırla
          </button>
        </div>
      </div>

      {/* Info Box */}
      <div className="rounded-xl border border-green-200 bg-gradient-to-br from-green-50 to-teal-50 p-6 shadow-sm">
        <div className="flex items-start gap-4">
          <div className="bg-green-500 p-2 rounded-lg shadow">
            <span className="text-2xl">ℹ️</span>
          </div>
          <div className="text-sm text-green-900">
            <p className="font-bold text-base mb-3">Zamanlanmış Görevler Hakkında</p>
            <ul className="space-y-2">
              <li className="flex items-start gap-2">
                <span className="text-green-500 mt-0.5">•</span>
                <span><strong>Otomatik Çalışma:</strong> Belirtilen zamanlarda otomatik olarak çalışır</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-teal-500 mt-0.5">•</span>
                <span><strong>Manuel Tetikleme:</strong> "Şimdi Çalıştır" butonu ile istediğiniz zaman çalıştırabilirsiniz</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-500 mt-0.5">•</span>
                <span><strong>Aktif/Pasif:</strong> Görevleri aktif veya pasif hale getirebilirsiniz</span>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Jobs List */}
      <div className="grid grid-cols-1 gap-6">
        {jobs.map((job) => (
          <div
            key={job.id}
            className={`rounded-xl border-2 p-6 shadow-md transition-all ${
              job.enabled
                ? 'border-green-200 bg-white hover:shadow-xl'
                : 'border-gray-200 bg-gray-50 opacity-60'
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h3 className="text-lg font-bold text-gray-900">{job.name}</h3>
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-semibold ${
                      job.enabled
                        ? 'bg-green-100 text-green-800'
                        : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {job.enabled ? '✓ Aktif' : '○ Pasif'}
                  </span>
                </div>
                <p className="text-sm text-gray-600 mb-3">{job.description}</p>
                <div className="flex items-center gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-gray-500">📅 Zamanlama:</span>
                    <span className="font-mono text-xs bg-gray-100 px-2 py-1 rounded">
                      {job.schedule}
                    </span>
                    <span className="text-gray-600">({getCronDescription(job.schedule)})</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 ml-4">
                <button
                  onClick={() => openEditModal(job)}
                  className="px-4 py-2 rounded-lg bg-purple-600 text-white text-sm font-semibold hover:bg-purple-700 transition-all shadow-md hover:shadow-lg"
                  title="Zamanlamayı Düzenle"
                >
                  ⚙️ Düzenle
                </button>
                <button
                  onClick={() => toggleJob(job.id)}
                  className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                    job.enabled
                      ? 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                      : 'bg-green-600 text-white hover:bg-green-700'
                  }`}
                >
                  {job.enabled ? 'Pasif Yap' : 'Aktif Yap'}
                </button>
                <button
                  onClick={() => runJobNow(job.id)}
                  disabled={running === job.id}
                  className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md hover:shadow-lg"
                >
                  {running === job.id ? (
                    <span className="flex items-center gap-2">
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></span>
                      Çalışıyor...
                    </span>
                  ) : (
                    '▶️ Şimdi Çalıştır'
                  )}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Cron Syntax Help */}
      <div className="rounded-xl border border-blue-200 bg-blue-50 p-6">
        <h3 className="font-bold text-blue-900 mb-3">📚 Cron Zamanlama Rehberi</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
          <div className="bg-white p-3 rounded-lg">
            <code className="font-mono text-xs text-blue-600">*/15 * * * *</code>
            <p className="text-gray-600 mt-1">Her 15 dakikada</p>
          </div>
          <div className="bg-white p-3 rounded-lg">
            <code className="font-mono text-xs text-blue-600">0 */1 * * *</code>
            <p className="text-gray-600 mt-1">Her saatte bir</p>
          </div>
          <div className="bg-white p-3 rounded-lg">
            <code className="font-mono text-xs text-blue-600">0 2 * * *</code>
            <p className="text-gray-600 mt-1">Her gün 02:00</p>
          </div>
          <div className="bg-white p-3 rounded-lg">
            <code className="font-mono text-xs text-blue-600">0 0 * * 0</code>
            <p className="text-gray-600 mt-1">Her Pazar 00:00</p>
          </div>
          <div className="bg-white p-3 rounded-lg">
            <code className="font-mono text-xs text-blue-600">0 */6 * * *</code>
            <p className="text-gray-600 mt-1">Her 6 saatte bir</p>
          </div>
          <div className="bg-white p-3 rounded-lg">
            <code className="font-mono text-xs text-blue-600">0 0 1 * *</code>
            <p className="text-gray-600 mt-1">Her ayın 1'i</p>
          </div>
        </div>
      </div>

      {/* Edit Schedule Modal */}
      {editingJob && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="w-full max-w-2xl rounded-xl bg-white p-6 shadow-2xl">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              ⚙️ Zamanlamayı Düzenle: {editingJob.name}
            </h2>

            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Cron İfadesi
                </label>
                <input
                  type="text"
                  value={newSchedule}
                  onChange={(e) => setNewSchedule(e.target.value)}
                  className="w-full rounded-lg border-2 border-gray-300 px-4 py-2 font-mono text-sm focus:border-purple-500 focus:outline-none"
                  placeholder="*/15 * * * *"
                />
                <p className="mt-2 text-sm text-gray-600">
                  Mevcut: <span className="font-semibold">{getCronDescription(newSchedule)}</span>
                </p>
              </div>

              {/* Quick Presets */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3">
                  Hızlı Seçenekler:
                </label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {[
                    { label: 'Her 5 dakikada', value: '*/5 * * * *' },
                    { label: 'Her 15 dakikada', value: '*/15 * * * *' },
                    { label: 'Her 30 dakikada', value: '*/30 * * * *' },
                    { label: 'Her saatte', value: '0 * * * *' },
                    { label: 'Her 6 saatte', value: '0 */6 * * *' },
                    { label: 'Her gün 02:00', value: '0 2 * * *' },
                  ].map((preset) => (
                    <button
                      key={preset.value}
                      onClick={() => setNewSchedule(preset.value)}
                      className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                        newSchedule === preset.value
                          ? 'bg-purple-600 text-white shadow-md'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Cron Help */}
              <div className="rounded-lg bg-blue-50 border border-blue-200 p-4">
                <p className="font-semibold text-blue-900 mb-2">📚 Cron Format:</p>
                <div className="grid grid-cols-5 gap-2 font-mono text-xs text-blue-800">
                  <div className="text-center">
                    <div className="font-bold">*</div>
                    <div className="text-[10px]">dakika</div>
                  </div>
                  <div className="text-center">
                    <div className="font-bold">*</div>
                    <div className="text-[10px]">saat</div>
                  </div>
                  <div className="text-center">
                    <div className="font-bold">*</div>
                    <div className="text-[10px]">gün</div>
                  </div>
                  <div className="text-center">
                    <div className="font-bold">*</div>
                    <div className="text-[10px]">ay</div>
                  </div>
                  <div className="text-center">
                    <div className="font-bold">*</div>
                    <div className="text-[10px]">hafta günü</div>
                  </div>
                </div>
                <div className="mt-2 text-xs text-blue-700">
                  <span className="font-semibold">Örnekler:</span> * (her), */5 (her 5'te bir), 0 (sıfırda), 1-5 (1'den 5'e)
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setEditingJob(null)}
                className="px-4 py-2 rounded-lg bg-gray-200 text-gray-700 font-semibold hover:bg-gray-300 transition-all"
              >
                İptal
              </button>
              <button
                onClick={saveSchedule}
                className="px-4 py-2 rounded-lg bg-purple-600 text-white font-semibold hover:bg-purple-700 transition-all shadow-md hover:shadow-lg"
              >
                💾 Kaydet
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
