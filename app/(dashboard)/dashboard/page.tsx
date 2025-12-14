'use client';

import { useEffect, useState } from 'react';
import StatCard from '@/components/StatCard';
import LoadingSpinner from '@/components/LoadingSpinner';

interface Stats {
  summary: {
    totalProducts: number;
    totalMarketplaces: number;
    totalOrders: number;
    totalMappings: number;
    totalRevenue: number;
  };
  lowStockProducts: Array<{
    id: string;
    sku: string;
    name: string;
    stockQuantity: number;
  }>;
  recentOrders: Array<{
    id: string;
    marketplaceOrderId: string;
    totalAmount: number;
    status: string;
    orderDate: string;
    marketplace: {
      name: string;
    };
    _count: {
      items: number;
    };
  }>;
  ordersByStatus: Record<string, number>;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const response = await fetch('/api/stats');
      const data = await response.json();
      setStats(data);
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  if (!stats) {
    return <div>Veri yüklenemedi</div>;
  }

  const statusColors: Record<string, string> = {
    PENDING: 'bg-yellow-100 text-yellow-800',
    PROCESSING: 'bg-blue-100 text-blue-800',
    SHIPPED: 'bg-purple-100 text-purple-800',
    DELIVERED: 'bg-green-100 text-green-800',
    CANCELLED: 'bg-red-100 text-red-800',
    REFUNDED: 'bg-gray-100 text-gray-800',
  };

  const statusLabels: Record<string, string> = {
    PENDING: 'Beklemede',
    PROCESSING: 'İşleniyor',
    SHIPPED: 'Kargoda',
    DELIVERED: 'Teslim Edildi',
    CANCELLED: 'İptal',
    REFUNDED: 'İade',
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50/30 to-purple-50/30 p-3 md:p-8 space-y-8 animate-fade-in">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-3xl md:text-5xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent animate-slide-in">
          Dashboard
        </h1>
        <p className="text-base md:text-lg text-gray-600 font-medium">Stok ve sipariş yönetim sistemi özeti</p>
        <div className="h-1 w-24 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full"></div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Toplam Ürün"
          value={stats?.summary?.totalProducts || 0}
          icon="📦"
          gradientFrom="from-purple-500"
          gradientTo="to-pink-600"
        />
        <StatCard
          title="Pazaryerleri"
          value={stats?.summary?.totalMarketplaces || 0}
          icon="🏪"
          gradientFrom="from-orange-500"
          gradientTo="to-red-600"
        />
        <StatCard
          title="Toplam Sipariş"
          value={stats?.summary?.totalOrders || 0}
          icon="🛒"
          gradientFrom="from-green-500"
          gradientTo="to-emerald-600"
        />
        <StatCard
          title="Toplam Gelir"
          value={`₺${(stats?.summary?.totalRevenue || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}`}
          icon="💰"
          gradientFrom="from-yellow-500"
          gradientTo="to-orange-600"
        />
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Low Stock Products */}
        <div className="group relative overflow-hidden rounded-2xl border border-gray-200 bg-white p-6 shadow-lg hover:shadow-2xl transition-all duration-300">
          <div className="absolute top-0 right-0 h-32 w-32 bg-gradient-to-br from-red-500 to-orange-600 opacity-5 blur-2xl"></div>
          <div className="relative">
            <h2 className="mb-6 text-xl font-bold text-gray-900 flex items-center gap-2">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-red-500 to-orange-600 text-xl">⚠️</span>
              Düşük Stoklu Ürünler
            </h2>
          {(stats?.lowStockProducts?.length || 0) === 0 ? (
            <p className="text-sm text-gray-500">Tüm ürünler yeterli stokta</p>
          ) : (
            <div className="space-y-3">
              {stats?.lowStockProducts?.map((product) => (
                <div
                  key={product.id}
                  className="group flex items-center justify-between rounded-xl border border-gray-200 bg-gradient-to-r from-white to-gray-50 p-4 hover:shadow-md hover:border-red-200 transition-all duration-200"
                >
                  <div>
                    <p className="font-semibold text-gray-900 group-hover:text-red-600 transition-colors">{product.name}</p>
                    <p className="text-sm text-gray-500 font-mono">SKU: {product.sku}</p>
                  </div>
                  <span className="flex items-center gap-1 rounded-full bg-gradient-to-r from-red-500 to-orange-600 px-3 py-1.5 text-sm font-bold text-white shadow-md">
                    <span>📦</span>
                    {product.stockQuantity}
                  </span>
                </div>
              ))}
            </div>
          )}
          </div>
        </div>

        {/* Order Status Summary */}
        <div className="group relative overflow-hidden rounded-2xl border border-gray-200 bg-white p-6 shadow-lg hover:shadow-2xl transition-all duration-300">
          <div className="absolute top-0 right-0 h-32 w-32 bg-gradient-to-br from-blue-500 to-indigo-600 opacity-5 blur-2xl"></div>
          <div className="relative">
            <h2 className="mb-6 text-xl font-bold text-gray-900 flex items-center gap-2">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-xl">📊</span>
              Sipariş Durumları
            </h2>
          <div className="space-y-3">
            {Object.entries(stats?.ordersByStatus || {}).map(([status, count]) => (
              <div
                key={status}
                className="flex items-center justify-between rounded-xl border border-gray-200 bg-gradient-to-r from-white to-gray-50 p-4 hover:shadow-md hover:border-indigo-200 transition-all duration-200"
              >
                <span className={`rounded-full px-3 py-1.5 text-sm font-semibold shadow-sm ${statusColors[status]}`}>
                  {statusLabels[status] || status}
                </span>
                <span className="text-2xl font-bold bg-gradient-to-r from-gray-700 to-gray-900 bg-clip-text text-transparent">{count}</span>
              </div>
            ))}
          </div>
          </div>
        </div>
      </div>

      {/* Recent Orders */}
      <div className="group relative overflow-hidden rounded-2xl border border-gray-200 bg-white p-6 shadow-lg hover:shadow-2xl transition-all duration-300">
        <div className="absolute top-0 right-0 h-32 w-32 bg-gradient-to-br from-purple-500 to-pink-600 opacity-5 blur-2xl"></div>
        <div className="relative">
          <h2 className="mb-6 text-xl font-bold text-gray-900 flex items-center gap-2">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500 to-pink-600 text-xl">🛒</span>
            Son Siparişler
          </h2>
        {(stats?.recentOrders?.length || 0) === 0 ? (
          <p className="text-sm text-gray-500">Henüz sipariş yok</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="table-modern">
              <thead>
                <tr className="text-left">
                  <th>Sipariş No</th>
                  <th>Pazaryeri</th>
                  <th>Ürün Sayısı</th>
                  <th>Tutar</th>
                  <th>Durum</th>
                  <th>Tarih</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {stats?.recentOrders?.map((order) => (
                  <tr key={order.id}>
                    <td className="py-3 font-medium text-gray-900">
                      {order.marketplaceOrderId}
                    </td>
                    <td className="py-3 text-gray-600">{order.marketplace.name}</td>
                    <td className="py-3 text-gray-600">{order._count.items} ürün</td>
                    <td className="py-3 font-medium text-gray-900">
                      ₺{parseFloat(order.totalAmount.toString()).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-3">
                      <span className={`rounded-full px-2 py-1 text-xs font-medium ${statusColors[order.status]}`}>
                        {statusLabels[order.status] || order.status}
                      </span>
                    </td>
                    <td className="py-3 text-gray-600">
                      {new Date(order.orderDate).toLocaleDateString('tr-TR')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        </div>
      </div>
    </div>
  );
}
