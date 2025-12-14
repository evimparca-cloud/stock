'use client';

import { useEffect, useState } from 'react';
import LoadingSpinner from '@/components/LoadingSpinner';

interface StockLog {
  id: string;
  type: string;
  quantity: number;
  oldStock: number;
  newStock: number;
  reason: string | null;
  reference: string | null;
  createdBy: string | null;
  createdAt: string;
  product: {
    name: string;
    sku: string;
  };
}

export default function StockLogsPage() {
  const [logs, setLogs] = useState<StockLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');

  useEffect(() => {
    fetchLogs();
  }, [filter]);

  const fetchLogs = async () => {
    try {
      const url = filter === 'all' 
        ? '/api/stock-logs'
        : `/api/stock-logs?type=${filter}`;
      
      const response = await fetch(url);
      const data = await response.json();
      setLogs(data);
    } catch (error) {
      console.error('Error fetching logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const getTypeInfo = (type: string) => {
    const types: Record<string, { label: string; color: string; icon: string }> = {
      'SALE': { label: 'Satış', color: 'bg-red-100 text-red-800', icon: '📉' },
      'CANCEL': { label: 'İptal', color: 'bg-green-100 text-green-800', icon: '🔙' },
      'RETURN': { label: 'İade', color: 'bg-blue-100 text-blue-800', icon: '↩️' },
      'ENTRY': { label: 'Giriş', color: 'bg-green-100 text-green-800', icon: '📥' },
      'EXIT': { label: 'Çıkış', color: 'bg-orange-100 text-orange-800', icon: '📤' },
      'ADJUSTMENT': { label: 'Düzeltme', color: 'bg-purple-100 text-purple-800', icon: '🔧' },
    };
    return types[type] || { label: type, color: 'bg-gray-100 text-gray-800', icon: '📋' };
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-3 md:p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl md:text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">Stok Hareketleri</h1>
        <p className="mt-2 text-gray-600">
          Tüm stok giriş/çıkış hareketlerini takip edin
        </p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex gap-2">
          {['all', 'SALE', 'CANCEL', 'RETURN', 'ENTRY', 'EXIT'].map(type => (
            <button
              key={type}
              onClick={() => setFilter(type)}
              className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
                filter === type
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {type === 'all' ? 'Tümü' : getTypeInfo(type).label}
            </button>
          ))}
        </div>
      </div>

      {/* Logs Table */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr className="text-left text-sm text-gray-600">
                <th className="p-4 font-medium">Tarih/Saat</th>
                <th className="p-4 font-medium">Ürün</th>
                <th className="p-4 font-medium">Tip</th>
                <th className="p-4 font-medium">Miktar</th>
                <th className="p-4 font-medium">Stok Değişimi</th>
                <th className="p-4 font-medium">Açıklama</th>
                <th className="p-4 font-medium">Referans</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {logs.map((log) => {
                const typeInfo = getTypeInfo(log.type);
                return (
                  <tr key={log.id} className="hover:bg-gray-50">
                    <td className="p-4 text-sm text-gray-600">
                      {new Date(log.createdAt).toLocaleString('tr-TR')}
                    </td>
                    <td className="p-4">
                      <div className="font-medium text-gray-900">{log.product.name}</div>
                      <div className="text-xs text-gray-500">{log.product.sku}</div>
                    </td>
                    <td className="p-4">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${typeInfo.color}`}>
                        <span>{typeInfo.icon}</span>
                        {typeInfo.label}
                      </span>
                    </td>
                    <td className="p-4">
                      <span className={`font-mono font-medium ${log.quantity > 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {log.quantity > 0 ? '+' : ''}{log.quantity}
                      </span>
                    </td>
                    <td className="p-4 font-mono text-sm">
                      <span className="text-gray-500">{log.oldStock}</span>
                      <span className="mx-2">→</span>
                      <span className="font-medium text-gray-900">{log.newStock}</span>
                    </td>
                    <td className="p-4 text-sm text-gray-600">
                      {log.reason || '-'}
                    </td>
                    <td className="p-4">
                      {log.reference ? (
                        <span className="font-mono text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded">
                          {log.reference}
                        </span>
                      ) : (
                        '-'
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {logs.length === 0 && (
          <div className="p-8 text-center text-gray-500">
            Henüz stok hareketi yok
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-sm text-gray-600">Toplam Hareket</div>
          <div className="text-2xl font-bold text-gray-900">{logs.length}</div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-sm text-gray-600">Satış Hareketleri</div>
          <div className="text-2xl font-bold text-red-600">
            {logs.filter(l => l.type === 'SALE').length}
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-sm text-gray-600">İptal/İade</div>
          <div className="text-2xl font-bold text-green-600">
            {logs.filter(l => ['CANCEL', 'RETURN'].includes(l.type)).length}
          </div>
        </div>
      </div>
    </div>
  );
}
