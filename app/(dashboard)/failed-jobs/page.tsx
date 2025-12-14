'use client';

import { useState, useEffect } from 'react';

interface FailedJob {
  id: string;
  queue: string;
  name: string;
  data: any;
  failedReason: string;
  attemptsMade: number;
  timestamp: number;
  processedOn?: number;
  finishedOn?: number;
}

interface QueueStats {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
}

export default function FailedJobsPage() {
  const [failedJobs, setFailedJobs] = useState<FailedJob[]>([]);
  const [stats, setStats] = useState<Record<string, QueueStats>>({});
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [selectedQueue, setSelectedQueue] = useState('all');
  const [expandedJob, setExpandedJob] = useState<string | null>(null);

  useEffect(() => {
    fetchFailedJobs();
    const interval = setInterval(fetchFailedJobs, 10000);
    return () => clearInterval(interval);
  }, [selectedQueue]);

  const fetchFailedJobs = async () => {
    try {
      const response = await fetch(`/api/admin/failed-jobs?queue=${selectedQueue}`);
      if (response.ok) {
        const data = await response.json();
        setFailedJobs(data.failedJobs || []);
        setStats(data.stats || {});
      }
    } catch (error) {
      console.error('Failed to fetch jobs:', error);
    } finally {
      setLoading(false);
    }
  };

  const retryJob = async (jobId: string, queue: string) => {
    setActionLoading(true);
    try {
      const response = await fetch('/api/admin/failed-jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId, queue }),
      });
      if (response.ok) {
        setMessage('✅ İş tekrar kuyruğa alındı');
        fetchFailedJobs();
      } else {
        setMessage('❌ İşlem başarısız');
      }
    } catch (error) {
      setMessage('❌ Hata oluştu');
    } finally {
      setActionLoading(false);
      setTimeout(() => setMessage(''), 3000);
    }
  };

  const deleteJob = async (jobId: string, queue: string) => {
    if (!confirm('Bu işi silmek istediğinize emin misiniz?')) return;
    setActionLoading(true);
    try {
      const response = await fetch(`/api/admin/failed-jobs?jobId=${jobId}&queue=${queue}`, {
        method: 'DELETE',
      });
      if (response.ok) {
        setMessage('✅ İş silindi');
        fetchFailedJobs();
      } else {
        setMessage('❌ Silme başarısız');
      }
    } catch (error) {
      setMessage('❌ Hata oluştu');
    } finally {
      setActionLoading(false);
      setTimeout(() => setMessage(''), 3000);
    }
  };

  const bulkAction = async (action: 'retry-all' | 'delete-all') => {
    const confirmMsg = action === 'retry-all' 
      ? `Tüm hatalı işleri (${failedJobs.length} adet) tekrar denemek istediğinize emin misiniz?`
      : `Tüm hatalı işleri (${failedJobs.length} adet) silmek istediğinize emin misiniz? Bu işlem geri alınamaz!`;
    
    if (!confirm(confirmMsg)) return;
    
    setActionLoading(true);
    try {
      const response = await fetch('/api/admin/failed-jobs', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, queue: selectedQueue }),
      });
      const data = await response.json();
      if (response.ok) {
        setMessage(`✅ ${data.message}`);
        fetchFailedJobs();
      } else {
        setMessage(`❌ ${data.error}`);
      }
    } catch (error) {
      setMessage('❌ Hata oluştu');
    } finally {
      setActionLoading(false);
      setTimeout(() => setMessage(''), 5000);
    }
  };

  const totalFailed = Object.values(stats).reduce((sum, s) => sum + (s?.failed || 0), 0);

  const queueNames: Record<string, string> = {
    'stock-sync': '📦 Stok Senkronizasyonu',
    'order-process': '🛒 Sipariş İşleme',
    'notifications': '🔔 Bildirimler',
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString('tr-TR');
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">⚠️ Hatalı İşler (DLQ)</h1>
          <p className="text-gray-600">Dead Letter Queue - Başarısız olan işleri yönetin</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-2xl font-bold ${totalFailed > 0 ? 'text-red-600' : 'text-green-600'}`}>
            {totalFailed}
          </span>
          <span className="text-gray-500">hatalı iş</span>
        </div>
      </div>

      {message && (
        <div className={`mb-4 p-4 rounded-lg ${message.includes('✅') ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
          {message}
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {Object.entries(stats).map(([queue, counts]) => (
          <div key={queue} className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">{queueNames[queue] || queue}</h3>
              <span className={`px-2 py-1 rounded text-sm font-bold ${(counts?.failed || 0) > 0 ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                {counts?.failed || 0} hata
              </span>
            </div>
            <div className="mt-2 grid grid-cols-4 gap-2 text-center text-xs">
              <div>
                <div className="font-bold text-yellow-600">{counts?.waiting || 0}</div>
                <div className="text-gray-500">Bekleyen</div>
              </div>
              <div>
                <div className="font-bold text-blue-600">{counts?.active || 0}</div>
                <div className="text-gray-500">Aktif</div>
              </div>
              <div>
                <div className="font-bold text-green-600">{counts?.completed || 0}</div>
                <div className="text-gray-500">Tamam</div>
              </div>
              <div>
                <div className="font-bold text-gray-600">{counts?.delayed || 0}</div>
                <div className="text-gray-500">Ertelenen</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Filters and Actions */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700">Kuyruk:</label>
            <select
              value={selectedQueue}
              onChange={(e) => setSelectedQueue(e.target.value)}
              className="border rounded-lg px-3 py-2"
            >
              <option value="all">Tümü</option>
              <option value="stock-sync">Stok Senkronizasyonu</option>
              <option value="order-process">Sipariş İşleme</option>
              <option value="notifications">Bildirimler</option>
            </select>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={() => bulkAction('retry-all')}
              disabled={actionLoading || failedJobs.length === 0}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              🔄 Tümünü Tekrar Dene
            </button>
            <button
              onClick={() => bulkAction('delete-all')}
              disabled={actionLoading || failedJobs.length === 0}
              className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              🗑️ Tümünü Sil
            </button>
            <button
              onClick={fetchFailedJobs}
              disabled={loading}
              className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 disabled:opacity-50"
            >
              ↻ Yenile
            </button>
          </div>
        </div>
      </div>

      {/* Failed Jobs List */}
      {loading ? (
        <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
          Yükleniyor...
        </div>
      ) : failedJobs.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <div className="text-6xl mb-4">🎉</div>
          <h3 className="text-xl font-semibold text-green-600">Hatalı İş Yok!</h3>
          <p className="text-gray-500">Tüm işler başarıyla tamamlandı.</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Kuyruk</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">İş Adı</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Hata</th>
                <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">Deneme</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Tarih</th>
                <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">İşlemler</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {failedJobs.map((job) => (
                <>
                  <tr key={job.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <span className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded">
                        {queueNames[job.queue] || job.queue}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => setExpandedJob(expandedJob === job.id ? null : job.id)}
                        className="text-blue-600 hover:underline text-sm font-mono"
                      >
                        {job.name || job.id}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-red-600 truncate block max-w-xs" title={job.failedReason}>
                        {job.failedReason?.substring(0, 50)}...
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="text-sm font-medium">{job.attemptsMade}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-gray-500">{formatDate(job.timestamp)}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => retryJob(job.id, job.queue)}
                          disabled={actionLoading}
                          className="text-blue-600 hover:text-blue-800 disabled:opacity-50"
                          title="Tekrar Dene"
                        >
                          🔄
                        </button>
                        <button
                          onClick={() => deleteJob(job.id, job.queue)}
                          disabled={actionLoading}
                          className="text-red-600 hover:text-red-800 disabled:opacity-50"
                          title="Sil"
                        >
                          🗑️
                        </button>
                      </div>
                    </td>
                  </tr>
                  {expandedJob === job.id && (
                    <tr className="bg-gray-50">
                      <td colSpan={6} className="px-4 py-4">
                        <div className="space-y-3">
                          <div>
                            <h4 className="font-semibold text-sm text-gray-700 mb-1">Hata Mesajı:</h4>
                            <pre className="bg-red-50 text-red-700 p-3 rounded text-xs overflow-x-auto">
                              {job.failedReason}
                            </pre>
                          </div>
                          <div>
                            <h4 className="font-semibold text-sm text-gray-700 mb-1">İş Verisi:</h4>
                            <pre className="bg-gray-100 p-3 rounded text-xs overflow-x-auto">
                              {JSON.stringify(job.data, null, 2)}
                            </pre>
                          </div>
                          <div className="grid grid-cols-3 gap-4 text-sm">
                            <div>
                              <span className="text-gray-500">Job ID:</span>
                              <span className="ml-2 font-mono">{job.id}</span>
                            </div>
                            <div>
                              <span className="text-gray-500">İşlenme:</span>
                              <span className="ml-2">{job.processedOn ? formatDate(job.processedOn) : '-'}</span>
                            </div>
                            <div>
                              <span className="text-gray-500">Tamamlanma:</span>
                              <span className="ml-2">{job.finishedOn ? formatDate(job.finishedOn) : '-'}</span>
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Info Box */}
      <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-semibold text-blue-800 mb-2">💡 Dead Letter Queue (DLQ) Nedir?</h3>
        <p className="text-sm text-blue-700">
          Maksimum deneme sayısına ulaşan ve başarısız olan işler buraya düşer. Bu işler otomatik silinmez, 
          manuel olarak incelenip tekrar denenebilir veya silinebilir. Trendyol API'si geçici olarak çökerse, 
          birikenleri <strong>"Tümünü Tekrar Dene"</strong> butonu ile toplu olarak kuyruğa alabilirsiniz.
        </p>
      </div>
    </div>
  );
}
