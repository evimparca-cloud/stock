'use client';

import { useEffect, useState } from 'react';
import LoadingSpinner from '@/components/LoadingSpinner';

interface WebhookLog {
  id: string;
  eventType: string;
  status: string;
  processedAt: string | null;
  error: string | null;
  createdAt: string;
  marketplace: {
    name: string;
  };
  payload: any;
}

const statusColors: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-800',
  PROCESSING: 'bg-blue-100 text-blue-800',
  SUCCESS: 'bg-green-100 text-green-800',
  FAILED: 'bg-red-100 text-red-800',
  IGNORED: 'bg-gray-100 text-gray-800',
};

const statusLabels: Record<string, string> = {
  PENDING: 'Beklemede',
  PROCESSING: 'İşleniyor',
  SUCCESS: 'Başarılı',
  FAILED: 'Başarısız',
  IGNORED: 'Göz ardı edildi',
};

export default function WebhooksPage() {
  const [logs, setLogs] = useState<WebhookLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLog, setSelectedLog] = useState<WebhookLog | null>(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    fetchLogs();
  }, [statusFilter, page]);

  const fetchLogs = async () => {
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
      });
      
      if (statusFilter) {
        params.append('status', statusFilter);
      }

      const response = await fetch(`/api/webhooks/logs?${params}`);
      const data = await response.json();
      setLogs(data.data);
      setTotalPages(data.pagination.totalPages);
    } catch (error) {
      console.error('Error fetching webhook logs:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-3 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">Webhook Logları</h1>
          <p className="mt-2 text-gray-600">
            Pazaryerlerinden gelen webhook bildirimlerini görüntüleyin
          </p>
        </div>
        <button
          onClick={() => fetchLogs()}
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          🔄 Yenile
        </button>
      </div>

      {/* Info Box */}
      <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
        <div className="flex items-start gap-3">
          <span className="text-2xl">📡</span>
          <div className="text-sm text-blue-900">
            <p className="font-medium">Webhook Endpoint'leri</p>
            <ul className="mt-2 space-y-1">
              <li><strong>Trendyol:</strong> <code className="rounded bg-blue-100 px-2 py-1">POST /api/webhooks/trendyol</code></li>
              <li><strong>Hepsiburada:</strong> <code className="rounded bg-blue-100 px-2 py-1">POST /api/webhooks/hepsiburada</code></li>
            </ul>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-4">
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          className="rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none"
        >
          <option value="">Tüm Durumlar</option>
          {Object.entries(statusLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {/* Logs Table */}
      <div className="rounded-2xl border border-gray-200 bg-white shadow-lg">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-gray-200 bg-gray-50">
              <tr className="text-left text-sm text-gray-600">
                <th className="p-4 font-medium">Tarih</th>
                <th className="p-4 font-medium">Pazaryeri</th>
                <th className="p-4 font-medium">Event Type</th>
                <th className="p-4 font-medium">Durum</th>
                <th className="p-4 font-medium">İşlenme Süresi</th>
                <th className="p-4 font-medium">İşlemler</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-gray-500">
                    Webhook logu bulunamadı
                  </td>
                </tr>
              ) : (
                logs.map((log) => {
                  const processingTime = log.processedAt
                    ? Math.round(
                        (new Date(log.processedAt).getTime() -
                          new Date(log.createdAt).getTime()) /
                          1000
                      )
                    : null;

                  return (
                    <tr key={log.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="p-4 text-gray-600">
                        {new Date(log.createdAt).toLocaleString('tr-TR')}
                      </td>
                      <td className="p-4">
                        <span className="rounded-full bg-blue-100 px-2 py-1 text-xs font-medium text-blue-800">
                          {log.marketplace.name}
                        </span>
                      </td>
                      <td className="p-4 font-mono text-xs text-gray-600">
                        {log.eventType}
                      </td>
                      <td className="p-4">
                        <span className={`rounded-full px-3 py-1 text-xs font-medium ${statusColors[log.status]}`}>
                          {statusLabels[log.status] || log.status}
                        </span>
                      </td>
                      <td className="p-4 text-gray-600">
                        {processingTime !== null ? `${processingTime}s` : '-'}
                      </td>
                      <td className="p-4">
                        <button
                          onClick={() => setSelectedLog(log)}
                          className="text-blue-600 hover:text-blue-800"
                        >
                          Detay
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-gray-200 px-4 py-3">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="rounded-lg border border-gray-300 px-3 py-1 text-sm disabled:opacity-50"
            >
              Önceki
            </button>
            <span className="text-sm text-gray-600">
              Sayfa {page} / {totalPages}
            </span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="rounded-lg border border-gray-300 px-3 py-1 text-sm disabled:opacity-50"
            >
              Sonraki
            </button>
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="w-full max-w-3xl rounded-lg bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-start justify-between">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Webhook Detayı</h2>
                <p className="mt-1 text-sm text-gray-600">
                  {new Date(selectedLog.createdAt).toLocaleString('tr-TR')}
                </p>
              </div>
              <button
                onClick={() => setSelectedLog(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              {/* Info Grid */}
              <div className="grid grid-cols-2 gap-4 rounded-lg border border-gray-200 p-4">
                <div>
                  <p className="text-sm text-gray-600">Pazaryeri</p>
                  <p className="font-medium text-gray-900">{selectedLog.marketplace.name}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Event Type</p>
                  <p className="font-mono text-sm text-gray-900">{selectedLog.eventType}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Durum</p>
                  <span className={`inline-block rounded-full px-3 py-1 text-xs font-medium ${statusColors[selectedLog.status]}`}>
                    {statusLabels[selectedLog.status]}
                  </span>
                </div>
                <div>
                  <p className="text-sm text-gray-600">İşlenme Zamanı</p>
                  <p className="font-medium text-gray-900">
                    {selectedLog.processedAt
                      ? new Date(selectedLog.processedAt).toLocaleString('tr-TR')
                      : 'Henüz işlenmedi'}
                  </p>
                </div>
              </div>

              {/* Error */}
              {selectedLog.error && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-4">
                  <p className="text-sm font-medium text-red-900">Hata</p>
                  <p className="mt-1 text-sm text-red-800">{selectedLog.error}</p>
                </div>
              )}

              {/* Payload */}
              <div>
                <h3 className="mb-2 font-semibold text-gray-900">Payload</h3>
                <div className="max-h-96 overflow-auto rounded-lg border border-gray-200 bg-gray-50 p-4">
                  <pre className="text-xs text-gray-800">
                    {JSON.stringify(selectedLog.payload, null, 2)}
                  </pre>
                </div>
              </div>
            </div>

            <div className="mt-4 flex justify-end">
              <button
                onClick={() => setSelectedLog(null)}
                className="rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50"
              >
                Kapat
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
