'use client';

import { useEffect, useState } from 'react';
import LoadingSpinner from '@/components/LoadingSpinner';

interface Marketplace {
  id: string;
  name: string;
  storeName?: string;
  isActive: boolean;
  _count: {
    mappings: number;
    orders: number;
  };
}

export default function SyncPage() {
  const [marketplaces, setMarketplaces] = useState<Marketplace[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, any>>({});

  useEffect(() => {
    fetchMarketplaces();
  }, []);

  const fetchMarketplaces = async () => {
    try {
      const response = await fetch('/api/marketplaces');
      const data = await response.json();
      setMarketplaces(data.filter((m: Marketplace) => m.isActive));
    } catch (error) {
      console.error('Error fetching marketplaces:', error);
    } finally {
      setLoading(false);
    }
  };

  const testConnection = async (marketplaceId: string) => {
    setSyncing(`test-${marketplaceId}`);
    try {
      const response = await fetch('/api/sync/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ marketplaceId }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        setResults(prev => ({ 
          ...prev, 
          [`test-${marketplaceId}`]: {
            success: false,
            message: 'Bağlantı testi başarısız',
            error: error.error || error.details || 'Bilinmeyen hata'
          }
        }));
      } else {
        const result = await response.json();
        setResults(prev => ({ ...prev, [`test-${marketplaceId}`]: result }));
      }
      
      setTimeout(() => {
        setResults(prev => {
          const newResults = { ...prev };
          delete newResults[`test-${marketplaceId}`];
          return newResults;
        });
      }, 8000);
    } catch (error) {
      console.error('Error testing connection:', error);
      setResults(prev => ({ 
        ...prev, 
        [`test-${marketplaceId}`]: {
          success: false,
          message: 'Bağlantı hatası',
          error: error instanceof Error ? error.message : 'Network hatası'
        }
      }));
    } finally {
      setSyncing(null);
    }
  };

  const syncStock = async (marketplaceId: string) => {
    setSyncing(`stock-${marketplaceId}`);
    try {
      const response = await fetch('/api/sync/stock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ marketplaceId }),
      });
      const result = await response.json();
      setResults(prev => ({ ...prev, [`stock-${marketplaceId}`]: result }));
      
      setTimeout(() => {
        setResults(prev => {
          const newResults = { ...prev };
          delete newResults[`stock-${marketplaceId}`];
          return newResults;
        });
      }, 5000);
    } catch (error) {
      console.error('Error syncing stock:', error);
    } finally {
      setSyncing(null);
    }
  };

  const syncPrice = async (marketplaceId: string) => {
    setSyncing(`price-${marketplaceId}`);
    try {
      const response = await fetch('/api/sync/price', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ marketplaceId }),
      });
      const result = await response.json();
      setResults(prev => ({ ...prev, [`price-${marketplaceId}`]: result }));
      
      setTimeout(() => {
        setResults(prev => {
          const newResults = { ...prev };
          delete newResults[`price-${marketplaceId}`];
          return newResults;
        });
      }, 5000);
    } catch (error) {
      console.error('Error syncing price:', error);
    } finally {
      setSyncing(null);
    }
  };

  const syncLocation = async (marketplaceId: string) => {
    setSyncing(`location-${marketplaceId}`);
    try {
      const response = await fetch('/api/sync/location', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ marketplaceId }),
      });
      const result = await response.json();
      setResults(prev => ({ ...prev, [`location-${marketplaceId}`]: result }));
      
      setTimeout(() => {
        setResults(prev => {
          const newResults = { ...prev };
          delete newResults[`location-${marketplaceId}`];
          return newResults;
        });
      }, 5000);
    } catch (error) {
      console.error('Error syncing location:', error);
    } finally {
      setSyncing(null);
    }
  };

  const syncOrders = async (marketplaceId: string) => {
    setSyncing(`orders-${marketplaceId}`);
    try {
      const response = await fetch('/api/sync/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ marketplaceId }),
      });
      const result = await response.json();
      setResults(prev => ({ ...prev, [`orders-${marketplaceId}`]: result }));
      
      setTimeout(() => {
        setResults(prev => {
          const newResults = { ...prev };
          delete newResults[`orders-${marketplaceId}`];
          return newResults;
        });
      }, 5000);
    } catch (error) {
      console.error('Error syncing orders:', error);
    } finally {
      setSyncing(null);
    }
  };

  const syncOrdersSimple = async (marketplaceId: string, status: string = 'Created') => {
    setSyncing(`orders-simple-${marketplaceId}`);
    try {
      const response = await fetch('/api/orders/sync-simple', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ marketplaceId, status }),
      });
      const result = await response.json();
      setResults(prev => ({ ...prev, [`orders-simple-${marketplaceId}`]: result }));
      
      setTimeout(() => {
        setResults(prev => {
          const newResults = { ...prev };
          delete newResults[`orders-simple-${marketplaceId}`];
          return newResults;
        });
      }, 5000);
    } catch (error) {
      console.error('Error syncing orders:', error);
    } finally {
      setSyncing(null);
    }
  };

  const syncCancelledOrders = async (marketplaceId: string) => {
    setSyncing(`cancelled-${marketplaceId}`);
    try {
      const response = await fetch('/api/orders/sync-cancelled', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ marketplaceId }),
      });
      const result = await response.json();
      setResults(prev => ({ ...prev, [`cancelled-${marketplaceId}`]: result }));
      
      setTimeout(() => {
        setResults(prev => {
          const newResults = { ...prev };
          delete newResults[`cancelled-${marketplaceId}`];
          return newResults;
        });
      }, 5000);
    } catch (error) {
      console.error('Error syncing cancelled orders:', error);
    } finally {
      setSyncing(null);
    }
  };

  const syncOrderStatus = async (marketplaceId: string) => {
    setSyncing(`status-${marketplaceId}`);
    try {
      const response = await fetch('/api/orders/sync-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ marketplaceId }),
      });
      const result = await response.json();
      setResults(prev => ({ ...prev, [`status-${marketplaceId}`]: result }));
      
      setTimeout(() => {
        setResults(prev => {
          const newResults = { ...prev };
          delete newResults[`status-${marketplaceId}`];
          return newResults;
        });
      }, 5000);
    } catch (error) {
      console.error('Error syncing order status:', error);
    } finally {
      setSyncing(null);
    }
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="min-h-screen p-3 md:p-6 space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl p-6 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="bg-white p-3 rounded-xl shadow-md">
            <span className="text-3xl">🔄</span>
          </div>
          <div>
            <h1 className="text-2xl md:text-4xl font-bold text-white">Senkronizasyon</h1>
            <p className="mt-1 text-indigo-100">
              Stok, fiyat ve siparişleri pazaryerleriyle senkronize edin
            </p>
          </div>
        </div>
      </div>

      {/* Info Box */}
      <div className="rounded-xl border border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50 p-6 shadow-sm">
        <div className="flex items-start gap-4">
          <div className="bg-blue-500 p-2 rounded-lg shadow">
            <span className="text-2xl">ℹ️</span>
          </div>
          <div className="text-sm text-blue-900">
            <p className="font-bold text-base mb-3">Senkronizasyon Hakkında</p>
            <ul className="space-y-2">
              <li className="flex items-start gap-2">
                <span className="text-blue-500 mt-0.5">•</span>
                <span><strong>Stok Senkronizasyonu:</strong> Yerel stok miktarlarını pazaryerlerine gönderir</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-purple-500 mt-0.5">•</span>
                <span><strong>Fiyat Senkronizasyonu:</strong> Ürün fiyatlarını pazaryerlerinde günceller</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-orange-500 mt-0.5">•</span>
                <span><strong>Lokasyon Senkronizasyonu:</strong> Yerel lokasyon bilgilerini pazaryerlerine gönderir</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-red-500 mt-0.5">•</span>
                <span><strong>Sipariş İşleme:</strong> Siparişleri çeker, barkod ile eşleştirir, stoktan düşer</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-yellow-500 mt-0.5">•</span>
                <span><strong>İptal İşleme:</strong> İptal edilen siparişlerin stoklarını geri ekler</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-500 mt-0.5">•</span>
                <span><strong>Durum Güncelleme:</strong> Siparişlerin durumlarını kontrol eder</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-gray-500 mt-0.5">•</span>
                <span><strong>Bağlantı Testi:</strong> API bilgilerinin doğruluğunu kontrol eder</span>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Marketplaces */}
      {marketplaces.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-white p-8 text-center">
          <p className="text-gray-500">Aktif pazaryeri bulunamadı</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {marketplaces.map((marketplace) => (
            <div
              key={marketplace.id}
              className="rounded-xl border border-gray-200 bg-white p-6 shadow-md hover:shadow-xl transition-all duration-300"
            >
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                    {marketplace.name}
                    {marketplace.storeName && (
                      <span className="text-sm font-normal text-blue-600 bg-blue-50 px-2 py-1 rounded">
                        🏬 {marketplace.storeName}
                      </span>
                    )}
                  </h3>
                  <p className="mt-1 text-sm text-gray-600">
                    {marketplace._count.mappings} eşleşme • {marketplace._count.orders} sipariş
                  </p>
                </div>
                <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-800">
                  ✓ Aktif
                </span>
              </div>

              {/* Result Message */}
              {Object.entries(results).map(([key, result]) => {
                if (!key.includes(marketplace.id)) return null;
                return (
                  <div
                    key={key}
                    className={`mb-4 rounded-lg p-3 text-sm ${
                      result.success
                        ? 'bg-green-50 text-green-800'
                        : 'bg-red-50 text-red-800'
                    }`}
                  >
                    <p className="font-medium">{result.message}</p>
                    {result.error && (
                      <p className="mt-1 text-xs opacity-75">{result.error}</p>
                    )}
                    {result.synced !== undefined && (
                      <p className="mt-1 text-xs opacity-75">
                        Senkronize edilen: {result.synced}
                      </p>
                    )}
                    {result.imported !== undefined && (
                      <p className="mt-1 text-xs opacity-75">
                        İçe aktarılan: {result.imported} / {result.total}
                      </p>
                    )}
                  </div>
                );
              })}

              {/* Actions */}
              <div className="space-y-2">
                <button
                  onClick={() => testConnection(marketplace.id)}
                  disabled={syncing !== null}
                  className="w-full rounded-lg border-2 border-gray-300 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 hover:border-gray-400 disabled:opacity-50 transition-all"
                >
                  {syncing === `test-${marketplace.id}` ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-gray-700"></span>
                      Test ediliyor...
                    </span>
                  ) : (
                    '🔌 Bağlantıyı Test Et'
                  )}
                </button>

                <button
                  onClick={() => syncStock(marketplace.id)}
                  disabled={syncing !== null}
                  className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 shadow-md hover:shadow-lg transition-all"
                >
                  {syncing === `stock-${marketplace.id}` ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></span>
                      Senkronize ediliyor...
                    </span>
                  ) : (
                    '📦 Stok Senkronize Et'
                  )}
                </button>

                <button
                  onClick={() => syncPrice(marketplace.id)}
                  disabled={syncing !== null}
                  className="w-full rounded-lg bg-purple-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-purple-700 disabled:opacity-50 shadow-md hover:shadow-lg transition-all"
                >
                  {syncing === `price-${marketplace.id}` ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></span>
                      Senkronize ediliyor...
                    </span>
                  ) : (
                    '💰 Fiyat Senkronize Et'
                  )}
                </button>

                <button
                  onClick={() => syncLocation(marketplace.id)}
                  disabled={syncing !== null}
                  className="w-full rounded-lg bg-orange-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-50 shadow-md hover:shadow-lg transition-all"
                >
                  {syncing === `location-${marketplace.id}` ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></span>
                      Senkronize ediliyor...
                    </span>
                  ) : (
                    '📍 Lokasyon Senkronize Et'
                  )}
                </button>

                <button
                  onClick={() => syncOrdersSimple(marketplace.id)}
                  disabled={syncing !== null}
                  className="w-full rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50 shadow-md hover:shadow-lg transition-all"
                >
                  {syncing === `orders-simple-${marketplace.id}` ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></span>
                      İşleniyor...
                    </span>
                  ) : (
                    '📦 Siparişleri İşle & Stoktan Düş'
                  )}
                </button>

                <button
                  onClick={() => syncCancelledOrders(marketplace.id)}
                  disabled={syncing !== null}
                  className="w-full rounded-lg bg-yellow-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-yellow-700 disabled:opacity-50 shadow-md hover:shadow-lg transition-all"
                >
                  {syncing === `cancelled-${marketplace.id}` ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></span>
                      İşleniyor...
                    </span>
                  ) : (
                    '🔙 İptal Siparişleri İşle'
                  )}
                </button>

                <button
                  onClick={() => syncOrderStatus(marketplace.id)}
                  disabled={syncing !== null}
                  className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 shadow-md hover:shadow-lg transition-all"
                >
                  {syncing === `status-${marketplace.id}` ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></span>
                      Kontrol ediliyor...
                    </span>
                  ) : (
                    '🔄 Sipariş Durumlarını Güncelle'
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
