'use client';

import { useEffect, useState } from 'react';
import LoadingSpinner from '@/components/LoadingSpinner';

interface Marketplace {
  id: string;
  name: string;
}

interface ShipmentPackage {
  id: number;
  // ✅ Trendyol API: id → shipmentPackageId (geriye uyumlu)
  shipmentPackageId?: number;
  orderNumber: string;
  grossAmount?: number;
  totalDiscount?: number;
  totalTyDiscount?: number;
  customerFirstName: string;
  customerLastName?: string;
  customerEmail: string;
  customerId?: number;
  identityNumber?: string;
  taxNumber?: string;
  city: string;
  district: string;
  totalPrice: number;
  currencyCode?: string;
  lines: any[];
  packageHistories: Array<{
    status: string;
    createdDate: number;
  }>;
  cargoTrackingNumber?: string;
  cargoTrackingLink?: string;
  cargoSenderNumber?: string;
  cargoProviderName?: string;
  cargoDeci?: number;
  shipmentAddress?: any;
  invoiceAddress?: any;
  shipmentPackageStatus?: string;
  status?: string;
  deliveryType?: string;
  estimatedDeliveryStartDate?: number;
  estimatedDeliveryEndDate?: number;
  agreedDeliveryDate?: number;
  agreedDeliveryDateExtendible?: boolean;
  extendedAgreedDeliveryDate?: number;
  orderDate?: number;
  originShipmentDate?: number;
  lastModifiedDate?: number;
  fastDelivery?: boolean;
  fastDeliveryType?: string;
  commercial?: boolean;
  deliveredByService?: boolean;
  micro?: boolean;
  giftBoxRequested?: boolean;
  etgbNo?: string;
  etgbDate?: number;
  containsDangerousProduct?: boolean;
  isCod?: boolean;
  whoPays?: number;
  deliveryAddressType?: string;
  invoiceLink?: string;
  hsCode?: string;
}

export default function ShipmentPackagesPage() {
  const [marketplaces, setMarketplaces] = useState<Marketplace[]>([]);
  const [selectedMarketplace, setSelectedMarketplace] = useState<string>('');
  const [status, setStatus] = useState<string>('Created');
  const [packages, setPackages] = useState<ShipmentPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetching, setFetching] = useState(false);
  const [selectedPackage, setSelectedPackage] = useState<ShipmentPackage | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [pagination, setPagination] = useState({
    page: 0,
    size: 50,
    totalPages: 0,
    totalElements: 0,
  });

  useEffect(() => {
    fetchMarketplaces();
  }, []);

  const fetchMarketplaces = async () => {
    try {
      const response = await fetch('/api/marketplaces');
      if (response.ok) {
        const data = await response.json();
        // Sadece aktif pazaryerlerini filtrele
        const activeMarketplaces = data.filter((m: any) => m.isActive);
        setMarketplaces(activeMarketplaces);
        if (activeMarketplaces.length > 0) {
          setSelectedMarketplace(activeMarketplaces[0].id);
        }
      }
    } catch (error) {
      console.error('Failed to fetch marketplaces:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchPackages = async (page: number = 0) => {
    if (!selectedMarketplace) return;

    setFetching(true);
    try {
      const params = new URLSearchParams({
        marketplaceId: selectedMarketplace,
        status,
        page: page.toString(),
        size: pagination.size.toString(),
      });

      console.log('📦 Paketler getiriliyor...', { status, page });

      const response = await fetch(`/api/trendyol/shipment-packages?${params}`);
      const result = await response.json();

      if (result.success) {
        setPackages(result.data.content || []);
        setPagination({
          page: result.data.page,
          size: result.data.size,
          totalPages: result.data.totalPages,
          totalElements: result.data.totalElements,
        });
        console.log('✅ Paketler alındı:', result.data.content?.length);
      } else {
        alert(result.error || 'Paketler alınamadı');
      }
    } catch (error) {
      console.error('Error fetching packages:', error);
      alert('Bir hata oluştu');
    } finally {
      setFetching(false);
    }
  };

  const handleProcessPackage = async () => {
    if (!selectedPackage || !selectedMarketplace) return;

    const confirmMessage = `Bu sipariş paketi işlenecek ve stoktan düşülecek:\n\n` +
      `Sipariş No: ${selectedPackage.orderNumber}\n` +
      `Ürün Sayısı: ${selectedPackage.lines?.length || 0}\n` +
      `Toplam: ₺${selectedPackage.totalPrice?.toFixed(2)}\n\n` +
      `Devam etmek istediğinize emin misiniz?`;

    if (!confirm(confirmMessage)) return;

    setFetching(true);
    try {
      console.log('📦 Sipariş paketi işleniyor:', {
        orderNumber: selectedPackage.orderNumber,
        itemCount: selectedPackage.lines?.length,
      });

      const response = await fetch('/api/trendyol/process-package', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          marketplaceId: selectedMarketplace,
          packageData: selectedPackage,
        }),
      });

      const result = await response.json();

      if (result.success) {
        let message = `✅ ${result.message}\n\n`;

        if (result.stockUpdates && result.stockUpdates.length > 0) {
          message += '📉 Stoktan Düşülen Ürünler:\n';
          result.stockUpdates.forEach((update: any) => {
            message += `• ${update.productName}: ${update.quantity} adet\n`;
          });
        }

        if (result.errors && result.errors.length > 0) {
          message += '\n⚠️ Uyarılar:\n';
          result.errors.forEach((error: string) => {
            message += `• ${error}\n`;
          });
        }

        alert(message);
        setShowDetailModal(false);
        // Paketleri yenile
        await fetchPackages(pagination.page);
      } else {
        alert(`❌ Hata: ${result.error || result.message}`);
      }
    } catch (error) {
      console.error('Error processing package:', error);
      alert('Bir hata oluştu!');
    } finally {
      setFetching(false);
    }
  };

  const handleUpdatePackageStatus = async (status: 'Picking' | 'Invoiced') => {
    if (!selectedPackage || !selectedMarketplace) return;

    let invoiceNumber = undefined;

    // Invoiced statüsü için fatura numarası iste
    if (status === 'Invoiced') {
      invoiceNumber = prompt('Fatura numarasını girin:');
      if (!invoiceNumber) {
        alert('Fatura numarası gerekli!');
        return;
      }
    }

    // Onay iste
    const confirmMessage = status === 'Picking'
      ? 'Paketi "Toplanıyor" statüsüne güncellemek istediğinize emin misiniz?'
      : `Paketi "Faturalandı" statüsüne güncellemek istediğinize emin misiniz?\nFatura No: ${invoiceNumber}`;

    if (!confirm(confirmMessage)) return;

    setFetching(true);
    try {
      // ✅ Trendyol API değişiklikleri (geriye uyumlu)
      // line.id → line.lineId, selectedPackage.id → selectedPackage.shipmentPackageId
      const lines = selectedPackage.lines?.map((line: any) => ({
        lineId: parseInt(line.lineId || line.id),
        quantity: parseInt(line.quantity),
      })) || [];

      const packageId = selectedPackage.shipmentPackageId || selectedPackage.id;

      console.log('📦 Paket durumu güncelleniyor:', {
        packageId,
        status,
        lines,
        invoiceNumber
      });

      const response = await fetch('/api/trendyol/update-package', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          marketplaceId: selectedMarketplace,
          packageId, // ✅ Artık shipmentPackageId veya id
          status,
          lines,
          invoiceNumber,
        }),
      });

      const result = await response.json();

      if (result.success) {
        alert(`✅ ${result.message}`);
        setShowDetailModal(false);
        // Paketleri yenile
        await fetchPackages(pagination.page);
      } else {
        alert(`❌ Hata: ${result.error || result.message}`);
      }
    } catch (error) {
      console.error('Error updating package:', error);
      alert('Bir hata oluştu!');
    } finally {
      setFetching(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; color: string }> = {
      'Created': { label: 'Oluşturuldu', color: 'bg-blue-100 text-blue-800' },
      'Picking': { label: 'Hazırlanıyor', color: 'bg-yellow-100 text-yellow-800' },
      'Invoiced': { label: 'Faturalandı', color: 'bg-purple-100 text-purple-800' },
      'Shipped': { label: 'Kargoya Verildi', color: 'bg-green-100 text-green-800' },
      'Delivered': { label: 'Teslim Edildi', color: 'bg-green-600 text-white' },
      'UnDelivered': { label: 'Teslim Edilemedi', color: 'bg-red-100 text-red-800' },
      'Cancelled': { label: 'İptal Edildi', color: 'bg-gray-100 text-gray-800' },
      'Returned': { label: 'İade Edildi', color: 'bg-orange-100 text-orange-800' },
    };

    const statusInfo = statusMap[status] || { label: status, color: 'bg-gray-100 text-gray-800' };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusInfo.color}`}>
        {statusInfo.label}
      </span>
    );
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="min-h-screen p-3 md:p-6 space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl p-6 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="bg-white p-3 rounded-xl shadow-md">
            <span className="text-3xl">📦</span>
          </div>
          <div>
            <h1 className="text-2xl md:text-4xl font-bold text-white">Sipariş Paketleri</h1>
            <p className="mt-1 text-blue-100">
              Trendyol sipariş paketlerini görüntüleyin ve yönetin
            </p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <span>🔍</span> Filtreler
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-1">
              <span>🏪</span> Pazaryeri
            </label>
            <select
              value={selectedMarketplace}
              onChange={(e) => setSelectedMarketplace(e.target.value)}
              className="w-full rounded-lg border-2 border-gray-300 px-4 py-2.5 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
            >
              {marketplaces.map((m: any) => (
                <option key={m.id} value={m.id}>
                  {m.storeName ? `${m.name} - ${m.storeName}` : m.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-1">
              <span>📊</span> Durum
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full rounded-lg border-2 border-gray-300 px-4 py-2.5 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
            >
              <option value="Created">Oluşturuldu</option>
              <option value="Picking">Hazırlanıyor</option>
              <option value="Invoiced">Faturalandı</option>
              <option value="Shipped">Kargoya Verildi</option>
              <option value="Delivered">Teslim Edildi</option>
              <option value="UnDelivered">Teslim Edilemedi</option>
              <option value="Cancelled">İptal Edildi</option>
              <option value="Returned">İade Edildi</option>
            </select>
          </div>

          <div className="flex items-end">
            <button
              onClick={() => fetchPackages(0)}
              disabled={fetching || !selectedMarketplace}
              className="w-full rounded-lg bg-gradient-to-r from-blue-600 to-purple-600 px-6 py-2.5 text-sm font-semibold text-white hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg transition-all"
            >
              {fetching ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></span>
                  Yükleniyor...
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <span>🔍</span> Paketleri Getir
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Results */}
      {packages.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="bg-gradient-to-r from-blue-50 to-purple-50 p-4 border-b border-gray-200">
            <p className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              <span>📊</span>
              Toplam <span className="text-blue-600">{pagination.totalElements}</span> paket bulundu.
              Sayfa <span className="text-purple-600">{pagination.page + 1}</span> / <span className="text-purple-600">{pagination.totalPages}</span>
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr className="text-left text-sm text-gray-600">
                  <th className="p-4 font-medium">Sipariş No</th>
                  <th className="p-4 font-medium">Müşteri</th>
                  <th className="p-4 font-medium">Ürünler</th>
                  <th className="p-4 font-medium">Tutar</th>
                  <th className="p-4 font-medium">Durum</th>
                  <th className="p-4 font-medium">Kargo</th>
                  <th className="p-4 font-medium">İşlemler</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {packages.map((pkg) => {
                  const latestStatus = pkg.packageHistories?.[0]?.status || 'Created';
                  return (
                    <tr key={pkg.id} className="hover:bg-gray-50">
                      <td className="p-4">
                        <span className="font-mono text-sm font-bold text-purple-600">
                          {pkg.orderNumber}
                        </span>
                      </td>
                      <td className="p-4 text-sm">
                        <div className="font-semibold text-gray-800">
                          {pkg.shipmentAddress?.fullName || `${pkg.customerFirstName} ${pkg.customerLastName || ''}`.trim()}
                        </div>
                      </td>
                      <td className="p-4 text-sm max-w-xs">
                        <div className="space-y-1">
                          {pkg.lines && pkg.lines.length > 0 ? (
                            <>
                              {pkg.lines.slice(0, 2).map((line: any, idx: number) => (
                                <div key={idx} className="text-xs">
                                  <span className="font-medium">{line.quantity}x</span>
                                  <span className="ml-1 text-gray-700">{line.productName?.substring(0, 40)}{line.productName?.length > 40 ? '...' : ''}</span>
                                  {line.productSize && <span className="ml-1 text-gray-500">({line.productSize})</span>}
                                </div>
                              ))}
                              {pkg.lines.length > 2 && (
                                <div className="text-xs text-blue-600 font-medium">
                                  +{pkg.lines.length - 2} ürün daha
                                </div>
                              )}
                            </>
                          ) : (
                            <span className="text-gray-400">Ürün bilgisi yok</span>
                          )}
                        </div>
                      </td>
                      <td className="p-4 text-sm font-semibold text-green-600">
                        ₺{pkg.totalPrice?.toFixed(2)}
                      </td>
                      <td className="p-4">
                        {getStatusBadge(latestStatus)}
                      </td>
                      <td className="p-4 text-sm">
                        {pkg.cargoProviderName && (
                          <div>
                            <div className="font-medium">{pkg.cargoProviderName}</div>
                            {pkg.cargoTrackingNumber && (
                              <div className="text-xs text-gray-500 font-mono">
                                {pkg.cargoTrackingNumber}
                              </div>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="p-4">
                        <button
                          onClick={() => {
                            setSelectedPackage(pkg);
                            setShowDetailModal(true);
                          }}
                          className="rounded bg-blue-600 px-3 py-1 text-xs text-white hover:bg-blue-700"
                        >
                          📋 Detaylar
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="p-4 border-t border-gray-200 flex justify-between items-center">
              <button
                onClick={() => fetchPackages(pagination.page - 1)}
                disabled={fetching || pagination.page === 0}
                className="px-4 py-2 rounded border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                ← Önceki
              </button>
              <span className="text-sm text-gray-600">
                Sayfa {pagination.page + 1} / {pagination.totalPages}
              </span>
              <button
                onClick={() => fetchPackages(pagination.page + 1)}
                disabled={fetching || pagination.page >= pagination.totalPages - 1}
                className="px-4 py-2 rounded border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Sonraki →
              </button>
            </div>
          )}
        </div>
      )}

      {/* Empty State */}
      {packages.length === 0 && !fetching && selectedMarketplace && (
        <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
          <p className="text-gray-500">
            Seçili kriterlere göre paket bulunamadı. Farklı bir durum seçin veya paketleri getirin.
          </p>
        </div>
      )}

      {/* Detail Modal */}
      {showDetailModal && selectedPackage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-2xl md:text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                📦 Sipariş Detayları #{selectedPackage.orderNumber}
              </h2>
              <button
                onClick={() => setShowDetailModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-6">
              {/* Müşteri Bilgileri */}
              <div className="bg-blue-50 rounded-lg p-4">
                <h3 className="font-semibold text-blue-900 mb-3">👤 Müşteri ve Teslimat Bilgileri</h3>
                <div className="space-y-3 text-sm">
                  <div>
                    <span className="text-gray-600 font-semibold">Ad Soyad:</span>
                    <span className="ml-2 font-medium">
                      {selectedPackage.shipmentAddress?.fullName || `${selectedPackage.customerFirstName} ${selectedPackage.customerLastName || ''}`.trim()}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-600 font-semibold">Teslimat Adresi:</span>
                    <p className="mt-1 text-gray-800 leading-relaxed">
                      {selectedPackage.shipmentAddress?.fullAddress || `${selectedPackage.district}, ${selectedPackage.city}`}
                    </p>
                  </div>
                  {selectedPackage.shipmentAddress?.phone && (
                    <div>
                      <span className="text-gray-600 font-semibold">Telefon:</span>
                      <span className="ml-2 font-medium">{selectedPackage.shipmentAddress.phone}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Sipariş Bilgileri */}
              <div className="bg-green-50 rounded-lg p-4">
                <h3 className="font-semibold text-green-900 mb-3">💰 Sipariş Bilgileri</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">Toplam Tutar:</span>
                    <span className="ml-2 font-medium text-lg">₺{selectedPackage.totalPrice?.toFixed(2)}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Ürün Sayısı:</span>
                    <span className="ml-2 font-medium">{selectedPackage.lines?.length || 0} adet</span>
                  </div>
                </div>
              </div>

              {/* Ürün Listesi */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="font-semibold text-gray-900 mb-3">📋 Ürünler ({selectedPackage.lines?.length || 0} adet)</h3>
                <div className="space-y-4">
                  {selectedPackage.lines?.map((line: any, index: number) => (
                    <div key={index} className="bg-white rounded-lg p-4 border border-gray-200 shadow-sm">
                      {/* Ürün Başlık */}
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex-1">
                          <div className="font-semibold text-gray-900 mb-1">{line.productName}</div>
                          <div className="flex flex-wrap gap-2 text-xs mt-2">
                            <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded">SKU: {line.merchantSku || line.sku}</span>
                            {line.barcode && <span className="bg-gray-100 text-gray-800 px-2 py-1 rounded">Barkod: {line.barcode}</span>}
                            {line.productSize && <span className="bg-purple-100 text-purple-800 px-2 py-1 rounded">Beden: {line.productSize}</span>}
                            {line.productColor && <span className="bg-pink-100 text-pink-800 px-2 py-1 rounded">Renk: {line.productColor}</span>}
                          </div>
                        </div>
                      </div>

                      {/* Fiyat Bilgileri */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3 text-sm">
                        <div className="bg-green-50 p-2 rounded">
                          <div className="text-gray-600 text-xs">Miktar</div>
                          <div className="font-bold text-green-700">{line.quantity} adet</div>
                        </div>
                        <div className="bg-blue-50 p-2 rounded">
                          <div className="text-gray-600 text-xs">Birim Fiyat</div>
                          <div className="font-bold text-blue-700">₺{line.price?.toFixed(2)}</div>
                        </div>
                        <div className="bg-purple-50 p-2 rounded">
                          <div className="text-gray-600 text-xs">Toplam</div>
                          <div className="font-bold text-purple-700">₺{line.amount?.toFixed(2)}</div>
                        </div>
                        <div className="bg-orange-50 p-2 rounded">
                          <div className="text-gray-600 text-xs">İndirim</div>
                          <div className="font-bold text-orange-700">₺{line.discount?.toFixed(2) || '0.00'}</div>
                        </div>
                      </div>

                      {/* Ek Bilgiler */}
                      <div className="grid grid-cols-2 gap-2 text-xs text-gray-600 border-t pt-3">
                        {line.commission && (
                          <div>
                            <span className="font-semibold">💰 Komisyon:</span> %{line.commission}
                          </div>
                        )}
                        {line.laborCost && (
                          <div>
                            <span className="font-semibold">🔧 İşçilik:</span> ₺{line.laborCost}
                          </div>
                        )}
                        {line.orderLineItemStatusName && (
                          <div className="col-span-2">
                            <span className="font-semibold">📊 Durum:</span>
                            <span className="ml-2 bg-yellow-100 text-yellow-800 px-2 py-1 rounded">
                              {line.orderLineItemStatusName}
                            </span>
                          </div>
                        )}
                        {line.fastDeliveryOptions && line.fastDeliveryOptions.length > 0 && (
                          <div className="col-span-2">
                            <span className="font-semibold">⚡ Hızlı Teslimat:</span>
                            {line.fastDeliveryOptions.map((opt: any, i: number) => (
                              <span key={i} className="ml-2 bg-red-100 text-red-800 px-2 py-1 rounded text-xs">
                                {opt.type}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Kargo Bilgileri */}
              {selectedPackage.cargoProviderName && (
                <div className="bg-orange-50 rounded-lg p-4">
                  <h3 className="font-semibold text-orange-900 mb-3">🚚 Kargo Bilgileri</h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-600">Kargo Firması:</span>
                      <span className="ml-2 font-medium">{selectedPackage.cargoProviderName}</span>
                    </div>
                    {selectedPackage.cargoTrackingNumber && (
                      <div>
                        <span className="text-gray-600">Takip No:</span>
                        <span className="ml-2 font-medium font-mono">{selectedPackage.cargoTrackingNumber}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Paket Geçmişi */}
              {selectedPackage.packageHistories && selectedPackage.packageHistories.length > 0 && (
                <div className="bg-purple-50 rounded-lg p-4">
                  <h3 className="font-semibold text-purple-900 mb-3">📅 Paket Geçmişi</h3>
                  <div className="space-y-2">
                    {selectedPackage.packageHistories.map((history: any, index: number) => (
                      <div key={index} className="flex items-center gap-3 text-sm">
                        <div className="flex-1">
                          {getStatusBadge(history.status)}
                        </div>
                        <div className="text-xs text-gray-500">
                          {new Date(history.createdDate).toLocaleString('tr-TR')}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex justify-between items-center gap-2 p-6 border-t border-gray-200">
              <div className="flex gap-2">
                {/* Stoktan Düş Butonu */}
                <button
                  onClick={handleProcessPackage}
                  disabled={fetching}
                  className="px-4 py-2 rounded bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 text-sm font-medium"
                >
                  📉 Stoktan Düş
                </button>

                {/* Picking Butonu */}
                <button
                  onClick={() => handleUpdatePackageStatus('Picking')}
                  disabled={fetching}
                  className="px-4 py-2 rounded bg-yellow-600 text-white hover:bg-yellow-700 disabled:opacity-50 text-sm"
                >
                  📦 Toplanıyor (Picking)
                </button>

                {/* Invoiced Butonu */}
                <button
                  onClick={() => handleUpdatePackageStatus('Invoiced')}
                  disabled={fetching}
                  className="px-4 py-2 rounded bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50 text-sm"
                >
                  📄 Faturalandı (Invoiced)
                </button>
              </div>

              <button
                onClick={() => setShowDetailModal(false)}
                className="px-4 py-2 rounded bg-gray-600 text-white hover:bg-gray-700"
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
