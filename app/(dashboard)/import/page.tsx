'use client';

import { useEffect, useState } from 'react';
import LoadingSpinner from '@/components/LoadingSpinner';

interface Marketplace {
  id: string;
  name: string;
  supplierId: string | null;
}

interface TrendyolProduct {
  id: string;
  productMainId?: string;
  sku: string;
  barcode: string;
  title: string;
  price: number;
  listPrice?: number;
  stockQuantity: number;
  brand?: string;
  categoryId?: number;
  categoryName?: string;
  gender?: string;
  vatRate?: number;
  stockCode?: string;
  stockUnitType?: string;
  description?: string;
  images?: Array<{ url: string }>;
  attributes?: any[];
  dimensionalWeight?: number;
  deliveryDuration?: number;
  locationBasedDelivery?: string;
  lotNumber?: string;
  deliveryOption?: {
    deliveryDuration?: number;
    fastDeliveryType?: string;
  };
  cargoCompanyId?: number;
  shipmentAddressId?: number;
  returningAddressId?: number;
  approved?: boolean;
  onSale?: boolean;
}

interface LocalProduct {
  id: string;
  sku: string;
  name: string;
  stockQuantity: number;
  price: string;
  mappings: Array<{
    marketplace: { name: string };
    remoteSku: string;
  }>;
}

export default function ImportPage() {
  const [marketplaces, setMarketplaces] = useState<Marketplace[]>([]);
  const [selectedMarketplace, setSelectedMarketplace] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [products, setProducts] = useState<TrendyolProduct[]>([]);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState<string>('');
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());
  const [localProducts, setLocalProducts] = useState<LocalProduct[]>([]);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [mappings, setMappings] = useState<Record<string, string>>({});
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Helper function to get proxied image URL
  const getProxyImageUrl = (url: string) => {
    return `/api/proxy-image?url=${encodeURIComponent(url)}`;
  };

  // Filter products based on search query
  const filteredProducts = products.filter(p => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return (
      p.title?.toLowerCase().includes(query) ||
      p.sku?.toLowerCase().includes(query) ||
      p.barcode?.toLowerCase().includes(query) ||
      p.stockCode?.toLowerCase().includes(query) ||
      p.productMainId?.toLowerCase().includes(query) ||
      p.brand?.toLowerCase().includes(query)
    );
  });

  useEffect(() => {
    fetchMarketplaces();
    fetchLocalProducts();
  }, []);

  const fetchMarketplaces = async () => {
    try {
      const response = await fetch('/api/marketplaces');
      const data = await response.json();
      setMarketplaces(data.filter((m: Marketplace) => m.name === 'Trendyol'));
    } catch (error) {
      console.error('Error fetching marketplaces:', error);
    }
  };

  const fetchLocalProducts = async () => {
    try {
      const response = await fetch('/api/products?limit=500');
      const data = await response.json();
      setLocalProducts(data.data || []);
    } catch (error) {
      console.error('Error fetching local products:', error);
    }
  };

  const fetchProducts = async () => {
    if (!selectedMarketplace) {
      alert('Lütfen bir pazaryeri seçin');
      return;
    }

    setLoading(true);
    setProducts([]);
    setProgress('Trendyol\'dan ürünler çekiliyor...');

    try {
      const response = await fetch('/api/import/trendyol-products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          marketplaceId: selectedMarketplace,
          autoCreateProducts: false,
        }),
      });

      const result = await response.json();

      if (result.success) {
        setProducts(result.products || []);
        setSelectedProducts(new Set()); // Seçimleri sıfırla
        setProgress(`${result.total} ürün başarıyla yüklendi! 🎉`);
        setTimeout(() => setProgress(''), 3000);
      } else {
        alert(result.error || 'Ürünler yüklenemedi');
        setProgress('');
      }
    } catch (error) {
      console.error('Error fetching products:', error);
      alert('Ürünler yüklenirken hata oluştu');
      setProgress('');
    } finally {
      setLoading(false);
    }
  };

  const toggleProduct = (sku: string) => {
    const newSelected = new Set(selectedProducts);
    if (newSelected.has(sku)) {
      newSelected.delete(sku);
    } else {
      newSelected.add(sku);
    }
    setSelectedProducts(newSelected);
  };

  const toggleAll = () => {
    if (selectedProducts.size === filteredProducts.length) {
      setSelectedProducts(new Set());
    } else {
      setSelectedProducts(new Set(filteredProducts.map(p => p.sku)));
    }
  };

  const handleMapping = async (trendyolSku: string, localProductId: string) => {
    if (!selectedMarketplace) {
      alert('Lütfen bir pazaryeri seçin');
      return;
    }

    if (!localProductId) {
      // Eşleştirme kaldır
      setMappings(prev => {
        const newMappings = { ...prev };
        delete newMappings[trendyolSku];
        return newMappings;
      });
      return;
    }

    try {
      const trendyolProduct = products.find(p => p.sku === trendyolSku);
      if (!trendyolProduct) return;

      const response = await fetch(`/api/products/${localProductId}/mappings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          marketplaceId: selectedMarketplace,
          remoteSku: trendyolProduct.barcode || trendyolProduct.sku,
          remoteProductId: trendyolProduct.productMainId || trendyolProduct.id,
        }),
      });

      const result = await response.json();

      if (result.success) {
        setMappings(prev => ({ ...prev, [trendyolSku]: localProductId }));
        alert('✅ Eşleştirme başarılı!');
        fetchLocalProducts(); // Yerel ürünleri yenile
      } else {
        alert(result.error || 'Eşleştirme başarısız');
      }
    } catch (error) {
      console.error('Error creating mapping:', error);
      alert('Eşleştirme sırasında hata oluştu');
    }
  };

  const toggleRow = (sku: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(sku)) {
      newExpanded.delete(sku);
    } else {
      newExpanded.add(sku);
    }
    setExpandedRows(newExpanded);
  };

  const importSelectedProducts = async () => {
    if (!selectedMarketplace) {
      alert('Lütfen bir pazaryeri seçin');
      return;
    }

    if (selectedProducts.size === 0) {
      alert('Lütfen en az bir ürün seçin');
      return;
    }

    if (!confirm(`${selectedProducts.size} ürün sisteme aktarılacak ve otomatik mapping oluşturulacak. Onaylıyor musunuz?`)) {
      return;
    }

    setImporting(true);

    try {
      // Seçili ürünleri filtrele
      const selectedProductsList = products.filter(p => selectedProducts.has(p.sku));

      const response = await fetch('/api/import/trendyol-products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          marketplaceId: selectedMarketplace,
          autoCreateProducts: true,
          selectedProducts: selectedProductsList, // Seçili ürünleri gönder
          mappings: mappings, // Eşleştirme bilgilerini gönder
        }),
      });

      const result = await response.json();

      if (result.success) {
        const message = `✅ Başarılı!\n${result.created} yeni ürün oluşturuldu\n${result.existing} mevcut ürün bulundu${result.mapped ? `\n${result.mapped} ürün eşleştirildi` : ''}`;
        alert(message);
        // İmport edilen ürünleri listeden çıkar
        setProducts(products.filter(p => !selectedProducts.has(p.sku)));
        setSelectedProducts(new Set());
        setMappings({}); // Eşleştirmeleri temizle
        fetchLocalProducts(); // Yerel ürünleri yenile
      } else {
        alert(result.error || 'Import başarısız');
      }
    } catch (error) {
      console.error('Error importing products:', error);
      alert('Import sırasında hata oluştu');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-3 md:p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl md:text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">Trendyol Ürün İmport</h1>
        <p className="mt-2 text-gray-600">
          Trendyol'daki ürünlerinizi sisteme aktarın ve otomatik mapping oluşturun
        </p>
      </div>

      {/* Info Box */}
      <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
        <div className="flex items-start gap-3">
          <span className="text-2xl">ℹ️</span>
          <div className="text-sm text-blue-900">
            <p className="font-medium">Nasıl Çalışır?</p>
            <ol className="mt-2 list-decimal space-y-1 pl-5">
              <li>Trendyol pazaryerinizi seçin</li>
              <li>"Ürünleri Getir" ile Trendyol'daki ürünlerinizi görüntüleyin</li>
              <li>Her ürünün yanındaki ▶ butonuna tıklayarak detayları görün</li>
              <li><strong>Eşleştirme:</strong> Mevcut yerel ürünlerle eşleştirme yapabilirsiniz</li>
              <li>İstediğiniz ürünleri seçin ve "Import Et" butonuna tıklayın</li>
              <li>Eşleştirilen ürünler mapping oluşturur, diğerleri yeni ürün olarak eklenir</li>
            </ol>
            <div className="mt-3 rounded bg-blue-100 p-2">
              <p className="text-xs font-medium">💡 İpucu: Eşleştirme yaparak aynı ürünün tekrar oluşturulmasını engelleyebilirsiniz!</p>
            </div>
          </div>
        </div>
      </div>

      {/* Selection */}
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Pazaryeri Seçin
            </label>
            <select
              value={selectedMarketplace}
              onChange={(e) => setSelectedMarketplace(e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-blue-500 focus:outline-none"
            >
              <option value="">Seçiniz...</option>
              {marketplaces.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} {m.supplierId ? `(${m.supplierId})` : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <button
              onClick={fetchProducts}
              disabled={!selectedMarketplace || loading}
              className="w-full rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></span>
                  Ürünler Getiriliyor... (Tüm sayfalar)
                </span>
              ) : (
                '📦 Tüm Ürünleri Getir'
              )}
            </button>
            {progress && (
              <p className="text-center text-sm text-blue-600 font-medium">
                {progress}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Products List */}
      {products.length > 0 && (
        <div className="space-y-4">
          {/* Search and Header */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <h2 className="text-xl font-semibold text-gray-900">
                Bulunan Ürünler ({filteredProducts.length}/{products.length})
                {selectedProducts.size > 0 && (
                  <span className="ml-2 text-sm text-blue-600">
                    - {selectedProducts.size} seçili
                  </span>
                )}
              </h2>
            </div>
            <div className="flex items-center gap-3">
              {/* Search Input */}
              <div className="relative">
                <input
                  type="text"
                  placeholder="🔍 Ara (SKU, barkod, ad...)"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-64 rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    ✕
                  </button>
                )}
              </div>
              <button
                onClick={importSelectedProducts}
                disabled={importing || selectedProducts.size === 0}
                className="rounded-lg bg-green-600 px-6 py-2 text-white hover:bg-green-700 disabled:opacity-50"
              >
                {importing ? (
                  <span className="flex items-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></span>
                    Import Ediliyor...
                  </span>
                ) : (
                  `✅ Seçili Ürünleri Import Et (${selectedProducts.size})`
                )}
              </button>
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white shadow-lg">
            <div className="max-h-96 overflow-y-auto">
              <table className="w-full">
                <thead className="sticky top-0 border-b border-gray-200 bg-gray-50">
                  <tr className="text-left text-sm text-gray-600">
                    <th className="p-4 font-medium">
                      <input
                        type="checkbox"
                        checked={selectedProducts.size === products.length && products.length > 0}
                        onChange={toggleAll}
                        className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                    </th>
                    <th className="p-4 font-medium">ProductMainId</th>
                    <th className="p-4 font-medium">SKU</th>
                    <th className="p-4 font-medium">StockCode</th>
                    <th className="p-4 font-medium">Ürün Adı</th>
                    <th className="p-4 font-medium">Açıklama</th>
                    <th className="p-4 font-medium">Marka</th>
                    <th className="p-4 font-medium">Kategori ID</th>
                    <th className="p-4 font-medium">Kategori</th>
                    <th className="p-4 font-medium">Cinsiyet</th>
                    <th className="p-4 font-medium">Liste Fiyat</th>
                    <th className="p-4 font-medium">Satış Fiyat</th>
                    <th className="p-4 font-medium">KDV</th>
                    <th className="p-4 font-medium">Stok</th>
                    <th className="p-4 font-medium">Birim</th>
                    <th className="p-4 font-medium">Desi</th>
                    <th className="p-4 font-medium">Teslimat</th>
                    <th className="p-4 font-medium">Kargo ID</th>
                    <th className="p-4 font-medium">Onay</th>
                    <th className="p-4 font-medium">Görsel</th>
                  </tr>
                </thead>
                <tbody className="text-sm">
                  {filteredProducts.map((product, index) => (
                    <>
                      <tr
                        key={`${product.barcode}-${index}`}
                        className={`border-b border-gray-100 hover:bg-gray-50 ${expandedRows.has(product.sku) ? 'bg-blue-50' : ''
                          }`}
                      >
                        <td className="p-4">
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={selectedProducts.has(product.sku)}
                              onChange={() => toggleProduct(product.sku)}
                              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                            <button
                              onClick={() => toggleRow(product.sku)}
                              className="text-gray-400 hover:text-blue-600"
                            >
                              {expandedRows.has(product.sku) ? '▼' : '▶'}
                            </button>
                          </div>
                        </td>
                        <td className="p-4 font-mono text-xs text-blue-600">{product.productMainId || '-'}</td>
                        <td className="p-4 font-mono text-xs">{product.sku}</td>
                        <td className="p-4 font-mono text-xs text-gray-600">{product.stockCode || '-'}</td>
                        <td className="p-4 max-w-xs truncate" title={product.title}>
                          {product.title}
                          {mappings[product.sku] && (
                            <span className="ml-2 inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
                              Eşleşti
                            </span>
                          )}
                        </td>
                        <td className="p-4 max-w-xs truncate text-gray-500 text-xs" title={product.description}>
                          {product.description || '-'}
                        </td>
                        <td className="p-4 text-gray-600">{product.brand || '-'}</td>
                        <td className="p-4 text-gray-600 font-mono text-xs">{product.categoryId || '-'}</td>
                        <td className="p-4 text-gray-600">{product.categoryName || '-'}</td>
                        <td className="p-4">
                          <span className="rounded-full bg-purple-100 px-2 py-1 text-xs text-purple-800">
                            {product.gender || '-'}
                          </span>
                        </td>
                        <td className="p-4 text-gray-500">
                          {product.listPrice ? `₺${product.listPrice.toFixed(2)}` : '-'}
                        </td>
                        <td className="p-4 font-medium">₺{product.price.toFixed(2)}</td>
                        <td className="p-4 text-gray-600">%{product.vatRate || 0}</td>
                        <td className="p-4">
                          <span
                            className={`rounded-full px-2 py-1 text-xs font-medium ${product.stockQuantity > 10
                                ? 'bg-green-100 text-green-800'
                                : product.stockQuantity > 0
                                  ? 'bg-yellow-100 text-yellow-800'
                                  : 'bg-red-100 text-red-800'
                              }`}
                          >
                            {product.stockQuantity}
                          </span>
                        </td>
                        <td className="p-4 text-gray-600 text-xs">
                          {product.stockUnitType || '-'}
                        </td>
                        <td className="p-4 text-gray-600">
                          {product.dimensionalWeight || '-'}
                        </td>
                        <td className="p-4 text-gray-600">
                          {product.deliveryDuration ? `${product.deliveryDuration} gün` : '-'}
                          {product.deliveryOption?.fastDeliveryType && (
                            <div className="text-xs text-blue-600 mt-1">
                              {product.deliveryOption.fastDeliveryType}
                            </div>
                          )}
                        </td>
                        <td className="p-4 text-gray-600 font-mono text-xs">
                          {product.cargoCompanyId || '-'}
                        </td>
                        <td className="p-4">
                          <div className="flex flex-col gap-1">
                            {product.approved ? (
                              <span className="text-xs text-green-600">Onaylı</span>
                            ) : (
                              <span className="text-xs text-red-600">Onaysız</span>
                            )}
                            {product.onSale ? (
                              <span className="text-xs text-blue-600">Satışta</span>
                            ) : (
                              <span className="text-xs text-gray-500">Satış Dışı</span>
                            )}
                          </div>
                        </td>
                        <td className="p-4">
                          {product.images && product.images.length > 0 ? (
                            <div className="flex -space-x-2 overflow-hidden">
                              {product.images.slice(0, 3).map((img, i) => (
                                <img
                                  key={i}
                                  src={getProxyImageUrl(img.url)}
                                  alt=""
                                  className="inline-block h-8 w-8 rounded-full ring-2 ring-white object-cover"
                                  onError={(e) => {
                                    (e.target as HTMLImageElement).style.display = 'none';
                                  }}
                                />
                              ))}
                            </div>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                      </tr>

                      {/* Expanded Row Content */}
                      {expandedRows.has(product.sku) && (
                        <tr className="bg-gray-50">
                          <td colSpan={20} className="p-4">
                            <div className="rounded-lg border border-gray-200 bg-white p-4">
                              <h4 className="mb-4 text-sm font-bold text-gray-900">
                                Ürün Eşleştirme & Detaylar
                              </h4>

                              <div className="grid grid-cols-2 gap-6">
                                {/* Sol Taraf: Eşleştirme */}
                                <div>
                                  <label className="mb-2 block text-sm font-medium text-gray-700">
                                    Bu ürünü yerel bir ürünle eşleştir:
                                  </label>
                                  <div className="flex gap-2">
                                    <select
                                      className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                                      value={mappings[product.sku] || ''}
                                      onChange={(e) => handleMapping(product.sku, e.target.value)}
                                    >
                                      <option value="">Eşleştirme Yok (Yeni Ürün Olarak Ekle)</option>
                                      {localProducts.map(lp => (
                                        <option key={lp.id} value={lp.id}>
                                          {lp.name} (SKU: {lp.sku}) - Stok: {lp.stockQuantity}
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                  <p className="mt-2 text-xs text-gray-500">
                                    Eğer eşleştirme yapmazsanız, "Seçili Ürünleri Import Et" butonuna tıkladığınızda yeni ürün olarak oluşturulacaktır.
                                  </p>
                                </div>

                                {/* Sağ Taraf: Ekstra Bilgiler */}
                                <div className="space-y-2 text-sm">
                                  <div className="grid grid-cols-2 gap-2">
                                    <span className="text-gray-500">Lot Numarası:</span>
                                    <span className="font-mono">{product.lotNumber || '-'}</span>
                                  </div>
                                  <div className="grid grid-cols-2 gap-2">
                                    <span className="text-gray-500">Konum Bazlı Teslimat:</span>
                                    <span>{product.locationBasedDelivery ? 'Evet' : 'Hayır'}</span>
                                  </div>
                                  <div className="grid grid-cols-2 gap-2">
                                    <span className="text-gray-500">Sevkiyat Adres ID:</span>
                                    <span className="font-mono">{product.shipmentAddressId || '-'}</span>
                                  </div>
                                  <div className="grid grid-cols-2 gap-2">
                                    <span className="text-gray-500">İade Adres ID:</span>
                                    <span className="font-mono">{product.returningAddressId || '-'}</span>
                                  </div>
                                </div>
                              </div>

                              {/* Görseller */}
                              {product.images && product.images.length > 0 && (
                                <div className="mt-6">
                                  <h5 className="mb-2 text-sm font-medium text-gray-700">Ürün Görselleri ({product.images.length})</h5>
                                  <div className="flex gap-4 overflow-x-auto pb-2">
                                    {product.images.map((img, i) => (
                                      <a
                                        key={i}
                                        href={img.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="relative h-24 w-24 flex-shrink-0 overflow-hidden rounded-lg border border-gray-200 hover:opacity-75"
                                      >
                                        <img
                                          src={getProxyImageUrl(img.url)}
                                          alt=""
                                          className="h-full w-full object-cover"
                                          onError={(e) => {
                                            (e.target as HTMLImageElement).src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect fill="%23f3f4f6" width="100" height="100"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="%239ca3af">❌</text></svg>';
                                          }}
                                        />
                                      </a>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {loading && <LoadingSpinner />}
    </div>
  );
}
