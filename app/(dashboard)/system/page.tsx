'use client';
import { useState, useEffect } from 'react';

interface QueueJob {
  id: string;
  name: string;
  data: any;
  timestamp: number;
  attemptsMade: number;
  failedReason?: string;
}

interface QueueStats {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
}

export default function SystemManagementPage() {
  const [activeTab, setActiveTab] = useState('server');
  const [cacheStats, setCacheStats] = useState<any>(null);
  const [systemHealth, setSystemHealth] = useState<any>(null);
  const [systemStatus, setSystemStatus] = useState<any>(null);
  const [rateLimitStats, setRateLimitStats] = useState<any>(null);
  const [queueData, setQueueData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    loadSystemData();
    const interval = setInterval(loadSystemData, 5000); // Queue i�in daha s�k g�ncelle
    return () => clearInterval(interval);
  }, []);

  const loadSystemData = async () => {
    try {
      const responses = await Promise.all([
        fetch('/api/system/cache/stats'),
        fetch('/api/system/health'),
        fetch('/api/system/rate-limit/stats'),
        fetch('/api/admin/queues'),
        fetch('/api/system/status'),
      ]);

      if (responses[0].ok) setCacheStats(await responses[0].json());
      if (responses[1].ok) setSystemHealth(await responses[1].json());
      if (responses[2].ok) setRateLimitStats(await responses[2].json());
      if (responses[3].ok) setQueueData(await responses[3].json());
      if (responses[4].ok) setSystemStatus(await responses[4].json());
    } catch (error) {
      console.error('Failed to load system data:', error);
    }
  };

  const handleCacheAction = async (action: string) => {
    setLoading(true);
    setMessage('');
    try {
      const response = await fetch('/api/system/cache/' + action, { method: 'POST' });
      const data = await response.json();
      if (response.ok) {
        setMessage('? ' + data.message);
        loadSystemData();
      } else {
        setMessage('? ' + data.error);
      }
    } catch (error) {
      setMessage('? ��lem ba�ar�s�z oldu');
    } finally {
      setLoading(false);
    }
  };

  const handleRateLimitAction = async (action: string) => {
    setLoading(true);
    setMessage('');
    try {
      const response = await fetch('/api/system/rate-limit/' + action, { method: 'POST' });
      const data = await response.json();
      if (response.ok) {
        setMessage('? ' + data.message);
        loadSystemData();
      } else {
        setMessage('? ' + data.error);
      }
    } catch (error) {
      setMessage('? ��lem ba�ar�s�z oldu');
    } finally {
      setLoading(false);
    }
  };

  const handleQueueAction = async (action: string, queue: string, jobId?: string) => {
    setLoading(true);
    setMessage('');
    try {
      let response;
      if (action === 'retry' && jobId) {
        response = await fetch('/api/admin/failed-jobs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jobId, queue }),
        });
      } else if (action === 'delete' && jobId) {
        response = await fetch(`/api/admin/failed-jobs?jobId=${jobId}&queue=${queue}`, {
          method: 'DELETE',
        });
      }
      if (response?.ok) {
        setMessage('İşlem başarılı');
        loadSystemData();
      } else {
        setMessage('İşlem başarısız');
      }
    } catch (error) {
      setMessage('İşlem başarısız oldu');
    } finally {
      setLoading(false);
    }
  };

  const tabs = [
    { id: 'server', name: 'Sunucu', icon: '' },
    { id: 'queues', name: 'Kuyruklar', icon: '' },
    { id: 'cache', name: 'Cache', icon: '' },
    { id: 'rate', name: 'Rate Limiting', icon: '' },
    { id: 'health', name: 'System Health', icon: '' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Sistem Yönetimi</h1>
        <p className="text-gray-600">Cache, performans ve güvenlik ayarlarını yönetin</p>
      </div>

      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={'py-2 px-1 border-b-2 font-medium text-sm ' + (
                activeTab === tab.id
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              )}
            >
              <span className="mr-2">{tab.icon}</span>
              {tab.name}
            </button>
          ))}
        </nav>
      </div>

      {message && (
        <div className={'p-4 rounded-lg ' + (message.includes('') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700')}>
          {message}
        </div>
      )}

      {activeTab === 'server' && (
        <div className="space-y-6">
          {/* Server Overview */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-lg shadow p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-2xl"></span>
                <h3 className="font-semibold">Uptime</h3>
              </div>
              <p className="text-2xl font-bold text-green-600">
                {systemStatus?.process?.uptime || 'Yükleniyor...'}
              </p>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-2xl"></span>
                <h3 className="font-semibold">Bellek</h3>
              </div>
              <p className="text-2xl font-bold">
                {systemStatus?.system?.memory?.usagePercent || 0}%
              </p>
              <p className="text-xs text-gray-500">
                {systemStatus?.system?.memory?.used} / {systemStatus?.system?.memory?.total}
              </p>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-2xl"></span>
                <h3 className="font-semibold">CPU Yükü</h3>
              </div>
              <p className="text-2xl font-bold">
                {systemStatus?.system?.cpu?.load1m || '0'}
              </p>
              <p className="text-xs text-gray-500">
                {systemStatus?.system?.cpu?.count || 0} çekirdek
              </p>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-2xl"></span>
                <h3 className="font-semibold">Saat Dilimi</h3>
              </div>
              <p className="text-lg font-bold">
                {systemStatus?.server?.timezone || 'UTC'}
              </p>
              <p className="text-xs text-gray-500">
                {systemStatus?.server?.serverTime}
              </p>
            </div>
          </div>

          {/* Health Status */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">Servis Durumları</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className={`p-4 rounded-lg border-2 ${systemStatus?.health?.database?.status === 'healthy' ? 'border-green-500 bg-green-50' : 'border-red-500 bg-red-50'}`}>
                <div className="flex items-center justify-between">
                  <span className="font-semibold"> PostgreSQL</span>
                  <span className={`px-2 py-1 rounded text-sm font-medium ${systemStatus?.health?.database?.status === 'healthy' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}`}>
                    {systemStatus?.health?.database?.status === 'healthy' ? 'Çalışıyor' : 'Hata'}
                  </span>
                </div>
                <p className="text-sm text-gray-600 mt-2">Latency: {systemStatus?.health?.database?.latency || 0}ms</p>
              </div>
              <div className={`p-4 rounded-lg border-2 ${systemStatus?.health?.redis?.status === 'healthy' ? 'border-green-500 bg-green-50' : 'border-yellow-500 bg-yellow-50'}`}>
                <div className="flex items-center justify-between">
                  <span className="font-semibold"> Redis</span>
                  <span className={`px-2 py-1 rounded text-sm font-medium ${systemStatus?.health?.redis?.status === 'healthy' ? 'bg-green-500 text-white' : 'bg-yellow-500 text-white'}`}>
                    {systemStatus?.health?.redis?.status === 'healthy' ? 'Çalışıyor' : systemStatus?.health?.redis?.status || 'Kapalı'}
                  </span>
                </div>
                <p className="text-sm text-gray-600 mt-2">Latency: {systemStatus?.health?.redis?.latency || 0}ms</p>
              </div>
              <div className={`p-4 rounded-lg border-2 ${!systemStatus?.shutdown?.isShuttingDown ? 'border-green-500 bg-green-50' : 'border-red-500 bg-red-50'}`}>
                <div className="flex items-center justify-between">
                  <span className="font-semibold"> Uygulama</span>
                  <span className={`px-2 py-1 rounded text-sm font-medium ${!systemStatus?.shutdown?.isShuttingDown ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}`}>
                    {!systemStatus?.shutdown?.isShuttingDown ? 'Çalışıyor' : 'Kapanıyor'}
                  </span>
                </div>
                <p className="text-sm text-gray-600 mt-2">Aktif İstek: {systemStatus?.shutdown?.activeRequests || 0}</p>
              </div>
            </div>
          </div>

          {/* Application Stats */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">Uygulama İstatistikleri</h2>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <p className="text-3xl font-bold text-blue-600">{systemStatus?.application?.totalProducts || 0}</p>
                <p className="text-sm text-gray-600">Toplam Ürün</p>
              </div>
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <p className="text-3xl font-bold text-green-600">{systemStatus?.application?.totalOrders || 0}</p>
                <p className="text-sm text-gray-600">Toplam Sipariş</p>
              </div>
              <div className="text-center p-4 bg-yellow-50 rounded-lg">
                <p className="text-3xl font-bold text-yellow-600">{systemStatus?.application?.pendingOrders || 0}</p>
                <p className="text-sm text-gray-600">Bekleyen Sipariş</p>
              </div>
              <div className="text-center p-4 bg-purple-50 rounded-lg">
                <p className="text-3xl font-bold text-purple-600">{systemStatus?.application?.activeMarketplaces || 0}</p>
                <p className="text-sm text-gray-600">Aktif Pazaryeri</p>
              </div>
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <p className="text-3xl font-bold text-gray-600">{systemStatus?.responseTime || 0}ms</p>
                <p className="text-sm text-gray-600">API Yanıt Süresi</p>
              </div>
            </div>
          </div>

          {/* Server Info */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4"> Sunucu Bilgileri</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-gray-500">Hostname</p>
                <p className="font-mono font-semibold">{systemStatus?.server?.hostname || '-'}</p>
              </div>
              <div>
                <p className="text-gray-500">Platform</p>
                <p className="font-mono font-semibold">{systemStatus?.server?.platform || '-'}</p>
              </div>
              <div>
                <p className="text-gray-500">Node.js</p>
                <p className="font-mono font-semibold">{systemStatus?.server?.nodeVersion || '-'}</p>
              </div>
              <div>
                <p className="text-gray-500">Son Güncelleme</p>
                <p className="font-mono font-semibold">{systemStatus?.timestamp ? new Date(systemStatus.timestamp).toLocaleTimeString('tr-TR') : '-'}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'queues' && (
        <div className="space-y-6">
          {/* Queue Overview */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {['stock-sync', 'order-process', 'notifications'].map((queueName) => {
              const queueInfo = queueData?.queues?.[queueName];
              const counts = queueInfo?.counts || { waiting: 0, active: 0, completed: 0, failed: 0 };
              const icons: Record<string, string> = { 'stock-sync': '', 'order-process': '', 'notifications': '' };
              const titles: Record<string, string> = { 'stock-sync': 'Stok Senkronizasyonu', 'order-process': 'Sipariş İşleme', 'notifications': 'Bildirimler' };
              
              return (
                <div key={queueName} className="bg-white rounded-lg shadow p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-2xl">{icons[queueName]}</span>
                    <h3 className="font-semibold">{titles[queueName]}</h3>
                  </div>
                  <div className="grid grid-cols-4 gap-2 text-center text-sm">
                    <div>
                      <div className="text-yellow-600 font-bold text-lg">{counts.waiting || 0}</div>
                      <div className="text-gray-500 text-xs">Bekleyen</div>
                    </div>
                    <div>
                      <div className="text-blue-600 font-bold text-lg">{counts.active || 0}</div>
                      <div className="text-gray-500 text-xs">Aktif</div>
                    </div>
                    <div>
                      <div className="text-green-600 font-bold text-lg">{counts.completed || 0}</div>
                      <div className="text-gray-500 text-xs">Tamam</div>
                    </div>
                    <div>
                      <div className={`font-bold text-lg ${(counts.failed || 0) > 0 ? 'text-red-600' : 'text-gray-400'}`}>
                        {counts.failed || 0}
                      </div>
                      <div className="text-gray-500 text-xs">Hata</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Failed Jobs */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <span className="text-red-500">??</span>
              Hatal� ��ler (Dead Letter Queue)
            </h2>
            
            {!queueData ? (
              <p className="text-gray-500">Redis ba�lant�s� yok - Kuyruklar devre d���</p>
            ) : (
              <div className="space-y-3">
                {Object.entries(queueData?.queues || {}).map(([queueName, queueInfo]: [string, any]) => {
                  const failedJobs = queueInfo?.jobs?.failed || [];
                  if (failedJobs.length === 0) return null;
                  
                  return (
                    <div key={queueName} className="border-l-4 border-red-500 pl-4">
                      <h3 className="font-medium text-gray-700 mb-2">{queueName}</h3>
                      {failedJobs.map((job: any) => (
                        <div key={job.id} className="bg-red-50 p-3 rounded mb-2">
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-mono text-sm bg-white px-2 py-0.5 rounded">{job.id}</span>
                                <span className="text-xs text-gray-500">{job.attemptsMade} deneme</span>
                              </div>
                              {job.failedReason && (
                                <p className="text-sm text-red-600 font-mono">{job.failedReason}</p>
                              )}
                            </div>
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleQueueAction('retry', queueName, job.id)}
                                disabled={loading}
                                className="bg-blue-500 text-white px-2 py-1 rounded text-xs hover:bg-blue-600"
                              >
                                ?? Tekrar
                              </button>
                              <button
                                onClick={() => handleQueueAction('delete', queueName, job.id)}
                                disabled={loading}
                                className="bg-red-500 text-white px-2 py-1 rounded text-xs hover:bg-red-600"
                              >
                                ???
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })}
                
                {Object.values(queueData?.queues || {}).every((q: any) => !q?.jobs?.failed?.length) && (
                  <div className="text-center py-8 text-gray-500">
                    <span className="text-4xl mb-2 block">?</span>
                    Hatal� i� yok - T�m kuyruklar sa�l�kl�
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Queue Info */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800">
            <strong>?? Bilgi:</strong> Kuyruklar Redis gerektirir. Production ortam�nda Redis aktif oldu�unda kuyruklar otomatik �al���r.
            Geli�tirme ortam�nda kuyruklar devre d���d�r ve i�lemler senkron yap�l�r.
          </div>
        </div>
      )}

      {activeTab === 'cache' && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Redis Cache Durumu</h2>
          {cacheStats ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600 mb-1">Ba�lant�</p>
                <p className={cacheStats.connected ? 'text-green-600 font-semibold' : 'text-red-600 font-semibold'}>
                  {cacheStats.connected ? '?? Ba�l�' : '?? Ba�lant�s�z'}
                </p>
              </div>
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600 mb-1">Toplam Key</p>
                <p className="text-2xl font-bold">{cacheStats.totalKeys}</p>
              </div>
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600 mb-1">Bellek</p>
                <p className="text-2xl font-bold">{cacheStats.memoryUsage}</p>
              </div>
            </div>
          ) : (
            <p className="text-gray-500 mb-6">Y�kleniyor...</p>
          )}
          <button 
            onClick={() => handleCacheAction('clear')} 
            disabled={loading} 
            className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 disabled:opacity-50"
          >
            ??? Cache Temizle
          </button>
        </div>
      )}

      {activeTab === 'rate' && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Rate Limiting �statistikleri</h2>
          {rateLimitStats ? (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600 mb-1">Aktif Limitler</p>
                <p className="text-2xl font-bold">{rateLimitStats.totalActiveRateLimits}</p>
              </div>
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600 mb-1">Login Denemeleri</p>
                <p className="text-2xl font-bold">{rateLimitStats.loginAttempts}</p>
              </div>
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600 mb-1">API �stekleri</p>
                <p className="text-2xl font-bold">{rateLimitStats.apiRequests}</p>
              </div>
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600 mb-1">Bloklu IP</p>
                <p className={'text-2xl font-bold ' + (rateLimitStats.blockedIPs.length > 0 ? 'text-red-600' : 'text-green-600')}>
                  {rateLimitStats.blockedIPs.length}
                </p>
              </div>
            </div>
          ) : (
            <p className="text-gray-500 mb-6">Y�kleniyor...</p>
          )}
          <button 
            onClick={() => handleRateLimitAction('clear-all')} 
            disabled={loading} 
            className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 disabled:opacity-50"
          >
            ??? T�m Rate Limitlari Temizle
          </button>
        </div>
      )}

      {activeTab === 'health' && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Sistem Sa�l���</h2>
          {systemHealth ? (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600 mb-1">Veritaban�</p>
                <p className={systemHealth.database ? 'text-green-600 font-semibold' : 'text-red-600 font-semibold'}>
                  {systemHealth.database ? '?? Sa�l�kl�' : '?? Hata'}
                </p>
              </div>
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600 mb-1">Redis</p>
                <p className={systemHealth.redis ? 'text-green-600 font-semibold' : 'text-red-600 font-semibold'}>
                  {systemHealth.redis ? '?? Sa�l�kl�' : '?? Hata'}
                </p>
              </div>
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600 mb-1">API Yan�t S�resi</p>
                <p className="text-2xl font-bold">{systemHealth.apiResponseTime}ms</p>
              </div>
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-sm text-gray-600 mb-1">Uptime</p>
                <p className="text-xl font-bold">{systemHealth.uptime}</p>
              </div>
            </div>
          ) : (
            <p className="text-gray-500">Y�kleniyor...</p>
          )}
        </div>
      )}
    </div>
  );
}
