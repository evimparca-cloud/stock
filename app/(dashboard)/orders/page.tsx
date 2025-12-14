'use client';

import { useEffect, useState, useMemo } from 'react';
import { Package, Clock, Cog, Truck, CheckCircle, XCircle, DollarSign, ArrowUpDown, X, ExternalLink, Search, Store, MapPin, MoreVertical, Printer, CheckSquare, Square } from 'lucide-react';
import StickerLabel from '@/components/StickerLabel';

interface Order {
  id: string;
  marketplaceOrderId: string;
  marketplaceId: string;
  shipmentPackageId?: string;
  totalAmount: string;
  status: string;
  orderDate: string;
  marketplace: {
    name: string;
    storeName?: string;
  };
  customerFirstName?: string;
  customerLastName?: string;
  customerEmail?: string;
  cargoTrackingNumber?: string;
  cargoTrackingLink?: string;
  cargoProviderName?: string;
  shipmentPackageStatus?: string;
  shipmentAddress?: {
    fullName?: string;
    city?: string;
    district?: string;
    fullAddress?: string;
    address1?: string;
    neighborhood?: string;
    phone?: string;
  };
  items: Array<{
    id: string;
    quantity: number;
    price: string;
    orderLineId?: string;
    productName?: string;
    productColor?: string;
    productSize?: string;
    barcode?: string;
    productMapping?: {
      product: {
        name: string;
        sku: string;
        location?: string;
        images?: Array<{ url: string }>;
      };
    };
  }>;
}

// Trendyol Package Status Configuration
const trendyolStatusConfig: { [key: string]: { emoji: string; label: string; color: string } } = {
  'Created': { emoji: '🆕', label: 'Hazır', color: 'bg-blue-100 text-blue-700' },
  'Picking': { emoji: '📦', label: 'Toplanıyor', color: 'bg-orange-100 text-orange-700' },
  'Invoiced': { emoji: '🧾', label: 'Faturalandı', color: 'bg-indigo-100 text-indigo-700' },
  'Shipped': { emoji: '🚚', label: 'Kargoda', color: 'bg-purple-100 text-purple-700' },
  'Delivered': { emoji: '✅', label: 'Teslim', color: 'bg-green-100 text-green-700' },
  'Cancelled': { emoji: '❌', label: 'İptal', color: 'bg-red-100 text-red-700' },
  'UnDelivered': { emoji: '⚠️', label: 'Teslim Edilemedi', color: 'bg-yellow-100 text-yellow-700' },
  'Returned': { emoji: '↩️', label: 'İade', color: 'bg-gray-100 text-gray-700' },
};

type TabKey = 'all' | 'PENDING' | 'PROCESSING' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED';

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>('PENDING');
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');
  const [searchQuery, setSearchQuery] = useState('');

  // New States
  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(new Set());
  const [printingOrder, setPrintingOrder] = useState<Order | null>(null);
  const [openActionMenuId, setOpenActionMenuId] = useState<string | null>(null);

  useEffect(() => {
    fetchOrders();
  }, []);

  // Close action menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      // Only close if click is not on the menu itself
      const target = e.target as HTMLElement;
      if (!target.closest('[data-action-menu]')) {
        setOpenActionMenuId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchOrders = async () => {
    try {
      const response = await fetch('/api/orders?limit=500');
      const data = await response.json();

      if (response.ok && data.data) {
        setOrders(data.data);
      } else {
        setOrders([]);
      }
    } catch (error) {
      console.error('Error fetching orders:', error);
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };

  const orderCounts = useMemo(() => ({
    all: orders.length,
    PENDING: orders.filter(o => o.status === 'PENDING').length,
    PROCESSING: orders.filter(o => o.status === 'PROCESSING').length,
    SHIPPED: orders.filter(o => o.status === 'SHIPPED').length,
    DELIVERED: orders.filter(o => o.status === 'DELIVERED').length,
    CANCELLED: orders.filter(o => o.status === 'CANCELLED').length,
  }), [orders]);

  const filteredOrders = useMemo(() => {
    let result = activeTab === 'all' ? orders : orders.filter(o => o.status === activeTab);

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(o =>
        o.marketplaceOrderId.toLowerCase().includes(query) ||
        `${o.customerFirstName || ''} ${o.customerLastName || ''}`.toLowerCase().includes(query) ||
        o.marketplace.name.toLowerCase().includes(query) ||
        o.shipmentAddress?.city?.toLowerCase().includes(query) ||
        o.items.some(item => item.productName?.toLowerCase().includes(query) || item.barcode?.toLowerCase().includes(query))
      );
    }

    return result.sort((a, b) => {
      const dateA = new Date(a.orderDate).getTime();
      const dateB = new Date(b.orderDate).getTime();
      return sortOrder === 'newest' ? dateB - dateA : dateA - dateB;
    });
  }, [orders, activeTab, sortOrder, searchQuery]);

  const tabs = [
    { key: 'all' as TabKey, label: 'Tümü', count: orderCounts.all },
    { key: 'PENDING' as TabKey, label: 'Yeni', count: orderCounts.PENDING },
    { key: 'PROCESSING' as TabKey, label: 'İşlemde', count: orderCounts.PROCESSING },
    { key: 'SHIPPED' as TabKey, label: 'Kargoda', count: orderCounts.SHIPPED },
    { key: 'DELIVERED' as TabKey, label: 'Teslim', count: orderCounts.DELIVERED },
    { key: 'CANCELLED' as TabKey, label: 'İptal', count: orderCounts.CANCELLED },
  ];

  // Selection Logic
  const toggleSelectOrder = (id: string) => {
    const newSelected = new Set(selectedOrderIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedOrderIds(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedOrderIds.size === filteredOrders.length) {
      setSelectedOrderIds(new Set());
    } else {
      setSelectedOrderIds(new Set(filteredOrders.map(o => o.id)));
    }
  };

  // Actions
  const handleProcessOrder = async (order: Order) => {
    if (order.marketplace.name === 'Trendyol') {
      if (!order.shipmentPackageId) {
        alert('⚠️ Bu sipariş için Trendyol paket ID\'si bulunamadı.');
        return;
      }

      const lines = order.items
        .filter(item => item.orderLineId)
        .map(item => ({
          lineId: parseInt(item.orderLineId!),
          quantity: item.quantity,
        }));

      if (lines.length === 0) {
        alert('⚠️ Bu sipariş için Trendyol kalem ID\'leri bulunamadı.');
        return;
      }

      try {
        const response = await fetch('/api/trendyol/update-package', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            marketplaceId: order.marketplaceId,
            packageId: parseInt(order.shipmentPackageId),
            status: 'Picking',
            lines,
          }),
        });

        const data = await response.json();

        if (data.success) {
          // Update local state
          setOrders(prev => prev.map(o => o.id === order.id ? { ...o, status: 'PROCESSING', shipmentPackageStatus: 'Picking' } : o));
          return true;
        } else {
          alert(`❌ Hata (${order.marketplaceOrderId}): ` + (data.error || 'Bilinmeyen hata'));
          return false;
        }
      } catch (error) {
        console.error('Error:', error);
        alert(`❌ İşlem sırasında hata oluştu (${order.marketplaceOrderId}).`);
        return false;
      }
    }
    return false;
  };

  const handleBulkProcess = async () => {
    if (!confirm(`${selectedOrderIds.size} adet siparişi "Toplanıyor" olarak işaretlemek istediğinize emin misiniz?`)) return;

    let successCount = 0;
    const selectedOrders = orders.filter(o => selectedOrderIds.has(o.id));

    for (const order of selectedOrders) {
      // Only process new orders
      if (order.shipmentPackageStatus === 'Created' || order.status === 'PENDING') {
        const success = await handleProcessOrder(order);
        if (success) successCount++;
      }
    }

    if (successCount > 0) {
      alert(`✅ ${successCount} sipariş başarıyla işleme alındı!`);
      setSelectedOrderIds(new Set());
    }
  };

  const handlePrintLabel = (order: Order) => {
    setPrintingOrder(order);
  };

  const handleBulkPrint = async () => {
    const selectedOrders = orders.filter(o => selectedOrderIds.has(o.id));
    // For now, simple alert as bulk printing requires PDF generation or sequential printing
    // Implementing sequential printing for now
    if (selectedOrders.length > 0) {
      // Print first one for now, or loop? Browser print dialog blocks loop.
      // Best approach: Show modal with all labels or just alert limitation
      alert('⚠️ Toplu yazdırma için lütfen tek tek yazdırın veya PDF oluşturma özelliği bekleyin.');
    }
  };

  const deleteOrder = async (id: string, marketplaceOrderId: string) => {
    if (!confirm(`"${marketplaceOrderId}" siparişini silmek istediğinize emin misiniz?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/orders/${id}`, { method: 'DELETE' });
      if (response.ok) {
        setOrders(orders.filter(o => o.id !== id));
        setShowModal(false);
      } else {
        alert('Sipariş silinirken hata oluştu');
      }
    } catch (error) {
      console.error('Error deleting order:', error);
      alert('Sipariş silinirken hata oluştu');
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="text-xl">Yükleniyor...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-3 md:p-6 space-y-6">
      {/* Sticker Label Print Component */}
      {printingOrder && (
        <StickerLabel
          order={printingOrder}
          onClose={() => setPrintingOrder(null)}
        />
      )}

      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl p-6 shadow-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-white p-3 rounded-xl shadow-md">
              <span className="text-3xl">📦</span>
            </div>
            <div>
              <h1 className="text-2xl md:text-4xl font-bold text-white">Siparişler</h1>
              <p className="mt-1 text-blue-100">
                Gelen siparişleri görüntüleyin ve yönetin
              </p>
            </div>
          </div>
          <button
            onClick={() => setSortOrder(sortOrder === 'newest' ? 'oldest' : 'newest')}
            className="flex items-center gap-2 bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-lg transition-colors"
          >
            <ArrowUpDown size={18} />
            <span className="hidden md:inline">{sortOrder === 'newest' ? 'En Yeni' : 'En Eski'}</span>
          </button>
        </div>
      </div>

      {/* Search and Tabs */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 space-y-4">
        {/* Search Input */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            placeholder="Sipariş no, müşteri adı, şehir veya barkod ile ara..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X size={18} />
            </button>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-shrink-0 px-3 md:px-4 py-2 rounded-lg text-xs md:text-sm font-semibold transition-all ${activeTab === tab.key
                ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-md'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
            >
              {tab.label}
              <span className={`ml-1 md:ml-2 px-1.5 md:px-2 py-0.5 rounded-full text-xs ${activeTab === tab.key ? 'bg-white/20' : 'bg-gray-200'
                }`}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Bulk Actions Bar */}
      {selectedOrderIds.size > 0 && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 flex items-center justify-between animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-2 text-indigo-900 font-medium">
            <CheckSquare className="text-indigo-600" />
            <span>{selectedOrderIds.size} sipariş seçildi</span>
          </div>
          <div className="flex gap-2">
            {activeTab !== 'PROCESSING' && (
              <button
                onClick={handleBulkProcess}
                className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors text-sm font-medium"
              >
                <Package size={16} />
                Tümünü Toplanıyor Yap
              </button>
            )}
            <button
              onClick={() => {
                // For bulk print, we just print the first one for now as a demo or alert
                // Ideally this would generate a PDF with all labels
                const firstId = Array.from(selectedOrderIds)[0];
                const order = orders.find(o => o.id === firstId);
                if (order) handlePrintLabel(order);
              }}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
            >
              <Printer size={16} />
              Etiket Yazdır (İlk Seçili)
            </button>
            <button
              onClick={() => setSelectedOrderIds(new Set())}
              className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium"
            >
              İptal
            </button>
          </div>
        </div>
      )}

      {/* Results Table */}
      {filteredOrders.length > 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="bg-gradient-to-r from-blue-50 to-purple-50 p-4 border-b border-gray-200">
            <p className="text-sm font-semibold text-gray-700 flex items-center gap-2">
              📊 Toplam <span className="text-blue-600">{filteredOrders.length}</span> sipariş bulundu
            </p>
          </div>

          {/* Desktop Table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr className="text-left text-sm text-gray-600">
                  <th className="p-4 w-10">
                    <button onClick={toggleSelectAll} className="text-gray-500 hover:text-gray-700">
                      {selectedOrderIds.size === filteredOrders.length && filteredOrders.length > 0 ? (
                        <CheckSquare size={20} className="text-blue-600" />
                      ) : (
                        <Square size={20} />
                      )}
                    </button>
                  </th>
                  <th className="p-4 font-medium">Sipariş No / Mağaza</th>
                  <th className="p-4 font-medium">Müşteri</th>
                  <th className="p-4 font-medium">Ürünler</th>
                  <th className="p-4 font-medium">Tutar</th>
                  <th className="p-4 font-medium">Durum</th>
                  <th className="p-4 font-medium">Tarih</th>
                  <th className="p-4 font-medium text-right">İşlemler</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredOrders.map((order) => {
                  const customerName = `${order.customerFirstName || ''} ${order.customerLastName || ''}`.trim() || 'Müşteri';
                  const totalItems = order.items.reduce((sum, item) => sum + item.quantity, 0);
                  const trendyolStatus = order.shipmentPackageStatus && trendyolStatusConfig[order.shipmentPackageStatus];
                  const isSelected = selectedOrderIds.has(order.id);

                  return (
                    <tr key={order.id} className={`hover:bg-gray-50 transition-colors ${isSelected ? 'bg-blue-50/50' : ''}`}>
                      <td className="p-4">
                        <button onClick={() => toggleSelectOrder(order.id)} className="text-gray-500 hover:text-gray-700">
                          {isSelected ? (
                            <CheckSquare size={20} className="text-blue-600" />
                          ) : (
                            <Square size={20} />
                          )}
                        </button>
                      </td>
                      <td className="p-4">
                        <div className="font-semibold text-gray-900">#{order.marketplaceOrderId}</div>
                        <div className="flex items-center gap-1 mt-1">
                          <Store size={12} className="text-orange-500" />
                          <span className="text-xs font-medium text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full">
                            {order.marketplace.name}
                          </span>
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="font-medium text-gray-900">{customerName}</div>
                        {order.shipmentAddress?.city && (
                          <div className="flex items-center gap-1 text-xs text-gray-500">
                            <MapPin size={12} />
                            {order.shipmentAddress.city}
                          </div>
                        )}
                      </td>
                      <td className="p-4">
                        <div className="text-sm text-gray-700">{totalItems} ürün</div>
                        {order.items[0] && (
                          <div className="text-xs text-gray-500 truncate max-w-[150px]">
                            {order.items[0].productName || order.items[0].productMapping?.product?.name || '-'}
                          </div>
                        )}
                      </td>
                      <td className="p-4">
                        <div className="font-bold text-lg text-gray-900">₺{parseFloat(order.totalAmount).toFixed(2)}</div>
                      </td>
                      <td className="p-4">
                        {trendyolStatus && (
                          <span className={`inline-flex items-center px-2 py-1 rounded-lg text-xs font-medium ${trendyolStatus.color}`}>
                            {trendyolStatus.emoji} {trendyolStatus.label}
                          </span>
                        )}
                      </td>
                      <td className="p-4">
                        <div className="text-sm text-gray-700">
                          {new Date(new Date(order.orderDate).getTime() - 3 * 60 * 60 * 1000).toLocaleDateString('tr-TR')}
                        </div>
                        <div className="text-xs text-gray-500">
                          {new Date(new Date(order.orderDate).getTime() - 3 * 60 * 60 * 1000).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </td>
                      <td className="p-4 text-right relative">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedOrder(order);
                              setShowModal(true);
                            }}
                            className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Detaylar"
                          >
                            <ExternalLink size={18} />
                          </button>

                          <div className="relative" data-action-menu>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setOpenActionMenuId(openActionMenuId === order.id ? null : order.id);
                              }}
                              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                            >
                              <MoreVertical size={18} />
                            </button>

                            {/* Dropdown Menu */}
                            {openActionMenuId === order.id && (
                              <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-xl border border-gray-100 z-50 py-1 animate-in fade-in zoom-in-95 duration-100">
                                {(order.shipmentPackageStatus === 'Created' || order.status === 'PENDING') && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleProcessOrder(order);
                                      setOpenActionMenuId(null);
                                    }}
                                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-orange-50 hover:text-orange-700 flex items-center gap-2"
                                  >
                                    <Package size={16} />
                                    📦 Toplanıyor Yap
                                  </button>
                                )}
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handlePrintLabel(order);
                                    setOpenActionMenuId(null);
                                  }}
                                  className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-700 flex items-center gap-2"
                                >
                                  <Printer size={16} />
                                  🏷️ Etiket Yazdır
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="md:hidden divide-y divide-gray-100">
            {filteredOrders.map((order) => {
              const customerName = `${order.customerFirstName || ''} ${order.customerLastName || ''}`.trim() || 'Müşteri';
              const totalItems = order.items.reduce((sum, item) => sum + item.quantity, 0);
              const trendyolStatus = order.shipmentPackageStatus && trendyolStatusConfig[order.shipmentPackageStatus];
              const isSelected = selectedOrderIds.has(order.id);

              return (
                <div
                  key={order.id}
                  className={`p-4 hover:bg-gray-50 transition-colors cursor-pointer ${isSelected ? 'bg-blue-50/50' : ''}`}
                  onClick={() => {
                    setSelectedOrder(order);
                    setShowModal(true);
                  }}
                >
                  {/* Header Row */}
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-start gap-3">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleSelectOrder(order.id);
                        }}
                        className="mt-1 text-gray-500"
                      >
                        {isSelected ? <CheckSquare size={20} className="text-blue-600" /> : <Square size={20} />}
                      </button>
                      <div>
                        <div className="font-bold text-gray-900">#{order.marketplaceOrderId}</div>
                        <div className="flex items-center gap-1 mt-1">
                          <Store size={12} className="text-orange-500" />
                          <span className="text-xs font-medium text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full">
                            {order.marketplace.name}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-lg text-gray-900">₺{parseFloat(order.totalAmount).toFixed(2)}</div>
                      {trendyolStatus && (
                        <span className={`inline-flex items-center px-2 py-1 rounded-lg text-xs font-medium ${trendyolStatus.color} mt-1`}>
                          {trendyolStatus.emoji} {trendyolStatus.label}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Customer & Products */}
                  <div className="flex items-center justify-between text-sm text-gray-600 mt-3 pl-8">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{customerName}</span>
                      {order.shipmentAddress?.city && (
                        <span className="text-xs text-gray-400 flex items-center gap-0.5">
                          <MapPin size={10} />
                          {order.shipmentAddress.city}
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-gray-500">{totalItems} ürün</span>
                  </div>

                  {/* Actions Row */}
                  <div className="flex justify-end gap-2 mt-3 pt-3 border-t border-gray-100 pl-8">
                    {(order.shipmentPackageStatus === 'Created' || order.status === 'PENDING') && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleProcessOrder(order);
                        }}
                        className="px-3 py-1.5 bg-orange-100 text-orange-700 rounded text-xs font-medium flex items-center gap-1"
                      >
                        <Package size={14} />
                        Toplanıyor
                      </button>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handlePrintLabel(order);
                      }}
                      className="px-3 py-1.5 bg-blue-100 text-blue-700 rounded text-xs font-medium flex items-center gap-1"
                    >
                      <Printer size={14} />
                      Etiket
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <Package className="mx-auto text-gray-300 mb-4" size={64} />
          <p className="text-lg text-gray-500">Bu kategoride sipariş yok</p>
        </div>
      )}

      {/* Detail Modal */}
      {showModal && selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-xl md:text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                📦 Sipariş Detayları #{selectedOrder.marketplaceOrderId}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-gray-600 p-2"
              >
                <X size={24} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-6">
              {/* Müşteri Bilgileri */}
              <div className="bg-blue-50 rounded-lg p-4">
                <h3 className="font-semibold text-blue-900 mb-3">👤 Müşteri ve Teslimat Bilgileri</h3>
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="text-gray-600 font-medium">Ad Soyad:</span>
                    <span className="ml-2">
                      {selectedOrder.shipmentAddress?.fullName || `${selectedOrder.customerFirstName || ''} ${selectedOrder.customerLastName || ''}`.trim() || 'Belirtilmemiş'}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-600 font-medium">Teslimat Adresi:</span>
                    <p className="mt-1 text-gray-800">
                      {selectedOrder.shipmentAddress?.fullAddress ||
                        [selectedOrder.shipmentAddress?.address1, selectedOrder.shipmentAddress?.neighborhood, selectedOrder.shipmentAddress?.district, selectedOrder.shipmentAddress?.city].filter(Boolean).join(', ') ||
                        'Adres bilgisi yok'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Sipariş Bilgileri */}
              <div className="bg-purple-50 rounded-lg p-4">
                <h3 className="font-semibold text-purple-900 mb-3">📋 Sipariş Bilgileri</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">Toplam Tutar:</span>
                    <p className="font-bold text-lg">₺{parseFloat(selectedOrder.totalAmount).toFixed(2)}</p>
                  </div>
                  <div>
                    <span className="text-gray-600">Ürün Sayısı:</span>
                    <p className="font-semibold">{selectedOrder.items.reduce((sum, item) => sum + item.quantity, 0)} adet</p>
                  </div>
                  <div>
                    <span className="text-gray-600">Pazaryeri:</span>
                    <p className="font-semibold">{selectedOrder.marketplace.name}</p>
                  </div>
                  <div>
                    <span className="text-gray-600">Tarih:</span>
                    <p className="font-semibold">{new Date(new Date(selectedOrder.orderDate).getTime() - 3 * 60 * 60 * 1000).toLocaleString('tr-TR')}</p>
                  </div>
                </div>
              </div>

              {/* Ürünler */}
              <div className="border border-gray-200 rounded-lg p-4">
                <h3 className="font-semibold text-gray-900 mb-3">📦 Ürünler ({selectedOrder.items.length} adet)</h3>
                <div className="space-y-3">
                  {selectedOrder.items.map((item, idx) => {
                    // Öncelik: item.productImageUrl (Trendyol'dan direkt), sonra productMapping
                    const productImage = (item as any).productImageUrl || item.productMapping?.product?.images?.[0]?.url;
                    const productName = item.productName || item.productMapping?.product?.name || 'Ürün';
                    // Lokasyon: item.merchantSku (Trendyol stockCode), sonra productMapping
                    const productLocation = (item as any).merchantSku || item.productMapping?.product?.location;

                    return (
                      <div key={item.id || idx} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                        {productImage ? (
                          <img
                            src={`/api/proxy-image?url=${encodeURIComponent(productImage)}`}
                            alt={productName}
                            className="h-14 w-14 rounded-lg object-cover border border-gray-200"
                            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                          />
                        ) : (
                          <div className="h-14 w-14 rounded-lg bg-gray-200 flex items-center justify-center">
                            <Package size={20} className="text-gray-400" />
                          </div>
                        )}
                        <div className="flex-1">
                          <p className="font-medium text-gray-900">{productName}</p>
                          <div className="flex flex-wrap gap-2 mt-1">
                            {item.productColor && (
                              <span className="px-2 py-0.5 rounded-full text-xs bg-purple-100 text-purple-700">
                                🎨 {item.productColor}
                              </span>
                            )}
                            {item.productSize && (
                              <span className="px-2 py-0.5 rounded-full text-xs bg-blue-100 text-blue-700">
                                📏 {item.productSize}
                              </span>
                            )}
                            {item.barcode && (
                              <span className="px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-600 font-mono">
                                {item.barcode}
                              </span>
                            )}
                            {productLocation && (
                              <span className="px-2 py-0.5 rounded-full text-xs bg-green-100 text-green-700 font-semibold">
                                📍 {productLocation}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold">₺{parseFloat(item.price).toFixed(2)}</p>
                          <p className="text-xs text-gray-500">x{item.quantity}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Kargo Bilgileri */}
              {(selectedOrder.cargoProviderName || selectedOrder.cargoTrackingNumber) && (
                <div className="bg-green-50 rounded-lg p-4">
                  <h3 className="font-semibold text-green-900 mb-3">🚚 Kargo Bilgileri</h3>
                  <div className="flex items-center justify-between text-sm">
                    <div>
                      <span className="text-gray-600">Kargo Firması:</span>
                      <span className="ml-2 font-medium">{selectedOrder.cargoProviderName || '-'}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Takip No:</span>
                      <span className="ml-2 font-mono font-medium">{selectedOrder.cargoTrackingNumber || '-'}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer - Action Buttons */}
            <div className="p-6 border-t border-gray-200 bg-gray-50 flex flex-wrap gap-3 justify-between">
              <div className="flex gap-2">
                <button
                  onClick={() => deleteOrder(selectedOrder.id, selectedOrder.marketplaceOrderId)}
                  className="px-4 py-2 rounded-lg text-sm font-medium bg-red-100 text-red-700 hover:bg-red-200 transition-colors"
                >
                  🗑️ Teslimat Dışı
                </button>

                {/* Toplanıyor Butonu - Sadece Created/PENDING durumunda */}
                {(selectedOrder.shipmentPackageStatus === 'Created' || selectedOrder.status === 'PENDING') && (
                  <button
                    onClick={() => handleProcessOrder(selectedOrder)}
                    className="px-4 py-2 rounded-lg text-sm font-medium bg-orange-500 text-white hover:bg-orange-600 transition-colors"
                  >
                    📦 Toplamaya (Picking)
                  </button>
                )}

                {/* Etiket Yazdır */}
                <button
                  onClick={() => handlePrintLabel(selectedOrder)}
                  className="px-4 py-2 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors flex items-center gap-2"
                >
                  <Printer size={16} />
                  Etiket Yazdır
                </button>

                {/* Kargo Takip - Shipped durumunda */}
                {selectedOrder.cargoTrackingLink && selectedOrder.shipmentPackageStatus === 'Shipped' && (
                  <button
                    onClick={() => window.open(selectedOrder.cargoTrackingLink, '_blank')}
                    className="px-4 py-2 rounded-lg text-sm font-medium bg-emerald-500 text-white hover:bg-emerald-600 transition-colors flex items-center gap-2"
                  >
                    <ExternalLink size={16} />
                    Kargo Takip
                  </button>
                )}
              </div>

              <button
                onClick={() => setShowModal(false)}
                className="px-6 py-2 rounded-lg text-sm font-medium bg-gray-200 text-gray-700 hover:bg-gray-300 transition-colors"
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
