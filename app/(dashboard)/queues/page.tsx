'use client';

import { useState, useEffect } from 'react';

interface JobData {
  id: string;
  name: string;
  data: any;
  timestamp: number;
  processedOn?: number;
  finishedOn?: number;
  attemptsMade: number;
  failedReason?: string;
}

interface QueueData {
  counts: {
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
    paused: number;
  };
  jobs: {
    waiting: JobData[];
    active: JobData[];
    completed: JobData[];
    failed: JobData[];
  };
}

interface QueueStats {
  queues: {
    'stock-sync': QueueData;
    'order-process': QueueData;
    'notifications': QueueData;
  };
  timestamp: string;
}

export default function QueueDashboard() {
  const [data, setData] = useState<QueueStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedQueue, setSelectedQueue] = useState<string>('stock-sync');
  const [selectedTab, setSelectedTab] = useState<string>('failed');
  const [retrying, setRetrying] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      const response = await fetch('/api/admin/queues');
      if (response.ok) {
        setData(await response.json());
        setError('');
      } else {
        setError('Kuyruk verileri alinamadi');
      }
    } catch (err) {
      setError('Baglanti hatasi');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5000); // Her 5 saniyede güncelle
    return () => clearInterval(interval);
  }, []);

  const retryJob = async (jobId: string, queue: string) => {
    setRetrying(jobId);
    try {
      const response = await fetch('/api/admin/failed-jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId, queue }),
      });
      if (response.ok) {
        fetchData();
      }
    } catch (err) {
      console.error('Retry failed:', err);
    } finally {
      setRetrying(null);
    }
  };

  const deleteJob = async (jobId: string, queue: string) => {
    if (!confirm('Bu isi silmek istediginizden emin misiniz?')) return;
    try {
      const response = await fetch(`/api/admin/failed-jobs?jobId=${jobId}&queue=${queue}`, {
        method: 'DELETE',
      });
      if (response.ok) {
        fetchData();
      }
    } catch (err) {
      console.error('Delete failed:', err);
    }
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-screen">
        <div className="text-xl">Yukleniyor...</div>
      </div>
    );
  }

  const queues = [
    { id: 'stock-sync', name: 'Stok Senkronizasyonu', icon: '📦' },
    { id: 'order-process', name: 'Siparis Isleme', icon: '🛒' },
    { id: 'notifications', name: 'Bildirimler', icon: '🔔' },
  ];

  const tabs = [
    { id: 'failed', name: 'Hatali', color: 'red' },
    { id: 'active', name: 'Aktif', color: 'blue' },
    { id: 'waiting', name: 'Bekleyen', color: 'yellow' },
    { id: 'completed', name: 'Tamamlanan', color: 'green' },
  ];

  const currentQueue = data?.queues[selectedQueue as keyof typeof data.queues];

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">📊 Kuyruk Yonetimi</h1>
        <button onClick={fetchData} className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600">
          🔄 Yenile
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      {/* Queue Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {queues.map((queue) => {
          const queueData = data?.queues[queue.id as keyof typeof data.queues];
          const counts = queueData?.counts || { waiting: 0, active: 0, completed: 0, failed: 0 };
          const hasErrors = counts.failed > 0;
          
          return (
            <div
              key={queue.id}
              onClick={() => setSelectedQueue(queue.id)}
              className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                selectedQueue === queue.id
                  ? 'border-blue-500 bg-blue-50'
                  : hasErrors
                  ? 'border-red-300 bg-red-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center gap-3 mb-3">
                <span className="text-2xl">{queue.icon}</span>
                <h3 className="font-semibold">{queue.name}</h3>
              </div>
              <div className="grid grid-cols-4 gap-2 text-center text-sm">
                <div>
                  <div className="text-yellow-600 font-bold">{counts.waiting}</div>
                  <div className="text-gray-500">Bekleyen</div>
                </div>
                <div>
                  <div className="text-blue-600 font-bold">{counts.active}</div>
                  <div className="text-gray-500">Aktif</div>
                </div>
                <div>
                  <div className="text-green-600 font-bold">{counts.completed}</div>
                  <div className="text-gray-500">Tamam</div>
                </div>
                <div>
                  <div className={`font-bold ${counts.failed > 0 ? 'text-red-600' : 'text-gray-400'}`}>
                    {counts.failed}
                  </div>
                  <div className="text-gray-500">Hata</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Job Tabs */}
      <div className="bg-white rounded-lg shadow-lg">
        <div className="flex border-b">
          {tabs.map((tab) => {
            const count = currentQueue?.counts[tab.id as keyof typeof currentQueue.counts] || 0;
            return (
              <button
                key={tab.id}
                onClick={() => setSelectedTab(tab.id)}
                className={`px-4 py-3 font-medium flex items-center gap-2 ${
                  selectedTab === tab.id
                    ? `border-b-2 border-${tab.color}-500 text-${tab.color}-600`
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab.name}
                {count > 0 && (
                  <span className={`px-2 py-0.5 text-xs rounded-full bg-${tab.color}-100 text-${tab.color}-600`}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Job List */}
        <div className="p-4">
          {currentQueue?.jobs[selectedTab as keyof typeof currentQueue.jobs]?.length === 0 ? (
            <div className="text-center text-gray-500 py-8">
              Bu kategoride is yok
            </div>
          ) : (
            <div className="space-y-3">
              {currentQueue?.jobs[selectedTab as keyof typeof currentQueue.jobs]?.map((job) => (
                <div
                  key={job.id}
                  className={`p-4 rounded-lg border ${
                    job.failedReason ? 'border-red-200 bg-red-50' : 'border-gray-200'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="font-mono text-sm bg-gray-100 px-2 py-0.5 rounded">
                          {job.id}
                        </span>
                        <span className="text-sm text-gray-500">{job.name}</span>
                        {job.attemptsMade > 0 && (
                          <span className="text-xs bg-orange-100 text-orange-600 px-2 py-0.5 rounded">
                            {job.attemptsMade} deneme
                          </span>
                        )}
                      </div>
                      
                      {job.failedReason && (
                        <div className="text-sm text-red-600 mb-2 font-mono bg-red-100 p-2 rounded">
                          ❌ {job.failedReason}
                        </div>
                      )}
                      
                      <div className="text-sm text-gray-600">
                        <pre className="bg-gray-50 p-2 rounded overflow-x-auto text-xs">
                          {JSON.stringify(job.data, null, 2)}
                        </pre>
                      </div>
                      
                      <div className="text-xs text-gray-400 mt-2">
                        {job.timestamp && `Olusturulma: ${new Date(job.timestamp).toLocaleString('tr-TR')}`}
                        {job.finishedOn && ` | Bitis: ${new Date(job.finishedOn).toLocaleString('tr-TR')}`}
                      </div>
                    </div>
                    
                    {selectedTab === 'failed' && (
                      <div className="flex gap-2 ml-4">
                        <button
                          onClick={() => retryJob(job.id, selectedQueue)}
                          disabled={retrying === job.id}
                          className="bg-blue-500 text-white px-3 py-1 rounded text-sm hover:bg-blue-600 disabled:opacity-50"
                        >
                          {retrying === job.id ? '...' : '🔄 Tekrar Dene'}
                        </button>
                        <button
                          onClick={() => deleteJob(job.id, selectedQueue)}
                          className="bg-red-500 text-white px-3 py-1 rounded text-sm hover:bg-red-600"
                        >
                          🗑️ Sil
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Last Update */}
      <div className="text-center text-sm text-gray-400 mt-4">
        Son guncelleme: {data?.timestamp ? new Date(data.timestamp).toLocaleString('tr-TR') : '-'}
      </div>
    </div>
  );
}
