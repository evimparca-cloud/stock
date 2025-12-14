'use client';

import { useState, useEffect } from 'react';

interface ReturnPackage {
  id: string;
  claimId: string;
  orderNumber: string;
  customerName: string;
  customerAddress?: string;
  claimDate: string;
  status: string;
  marketplace: string;
  cargoTrackingNumber?: string;
  cargoProvider?: string;
  totalAmount?: number;
  items: ReturnItem[];
}

interface ReturnItem {
  id: string;
  productName: string;
  barcode?: string;
  productColor?: string;
  productSize?: string;
  price?: number;
  customerReason?: string;
  status: string;
  customerNote?: string;
  sku?: string;
  image?: string;
}

const statusTabs = [
  { key: 'all', name: 'Tüm İadeler', description: 'Tüm iade talepleri' },
  { key: 'Created', name: 'İadesi Oluşturulan', description: 'Müşteri iade butonuna bastığında oluşan ilk statü' },
  { key: 'WaitingInAction', name: 'Aksiyon Bekleyen', description: 'İade paketi tedarikçiye ulaştığında bu statüye geçer' },
  { key: 'Accepted', name: 'Onaylanan', description: 'İade talebi onaylandı' },
  { key: 'Rejected', name: 'Reddedilen', description: 'İade talebi reddedildi' },
  { key: 'Cancelled', name: 'İptal Edilen', description: 'İade talebi iptal edildi' },
  { key: 'InAnalysis', name: 'Analiz', description: 'İade talebi inceleniyor' },
  { key: 'Unresolved', name: 'İhtilaflı', description: 'İade talebi çözümsüz' },
];

const returnReasons = [
  'Bedeni/Ebatı Büyük Geldi',
  'Bedeni/Ebatı Küçük Geldi', 
  'Teslim edilemeyen gönderi',
  'Diğer',
  'Hasarlı/Kusurlu Ürün',
  'Yanlış Ürün Gönderimi',
  'Beğenmeme',
];

export default function TrendyolStyleReturnsPage() {
  const [returns, setReturns] = useState<ReturnPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState('');
  const [selectedTab, setSelectedTab] = useState<string>('all');
  
  // Sayfalama
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [totalItems, setTotalItems] = useState(0);
  const itemsPerPage = 20;
  
  // İade Onay Modal
  const [approveModal, setApproveModal] = useState<{
    isOpen: boolean;
    returnPkg: ReturnPackage | null;
    loading: boolean;
    result: any;
  }>({ isOpen: false, returnPkg: null, loading: false, result: null });
  
  // Toplu Onay
  const [selectedReturns, setSelectedReturns] = useState<Set<string>>(new Set());
  const [bulkApproving, setBulkApproving] = useState(false);
  const [bulkResult, setBulkResult] = useState<any>(null);
  
  // Filtreler
  const [filters, setFilters] = useState({
    customerName: '',
    orderNumber: '',
    returnCode: '',
    barcode: '',
    returnReason: '',
    startDate: '',
    endDate: ''
  });

  useEffect(() => {
    loadReturns(currentPage);
  }, [currentPage, selectedTab]);

  const loadReturns = async (page: number = 0) => {
    try {
      setLoading(true);
      const statusParam = selectedTab !== 'all' ? `&status=${selectedTab}` : '';
      const response = await fetch(`/api/admin/returns?page=${page}&limit=${itemsPerPage}${statusParam}`);
      if (response.ok) {
        const data = await response.json();
        setReturns(data.returns || []);
        setTotalPages(data.pagination?.pages || 0);
        setTotalItems(data.pagination?.total || 0);
      } else {
        setMessage('❌ İadeler yüklenemedi');
      }
    } catch (error) {
      setMessage('❌ Bağlantı hatası');
    } finally {
      setLoading(false);
    }
  };

  const syncReturns = async () => {
    setSyncing(true);
    setMessage('⏳ Trendyol\'dan iade paketleri çekiliyor...');
    
    try {
      const response = await fetch('/api/cron/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId: 'process-returns' }),
      });
      
      if (response.ok) {
        setMessage('✅ İade paketleri güncellendi');
        loadReturns();
      } else {
        setMessage('❌ Senkronizasyon başarısız');
      }
    } catch (error) {
      setMessage('❌ Senkronizasyon hatası');
    } finally {
      setSyncing(false);
    }
  };

  const clearFilters = () => {
    setFilters({
      customerName: '',
      orderNumber: '',
      returnCode: '',
      barcode: '',
      returnReason: '',
      startDate: '',
      endDate: ''
    });
  };

  // İade onay modalını aç
  const openApproveModal = (returnPkg: ReturnPackage) => {
    setApproveModal({ isOpen: true, returnPkg, loading: false, result: null });
  };

  // İade onayla
  const approveReturn = async () => {
    if (!approveModal.returnPkg) return;
    
    const returnPkg = approveModal.returnPkg;
    setApproveModal(prev => ({ ...prev, loading: true }));
    
    try {
      // claimLineItemIdList'i oluştur
      const claimLineItemIdList = returnPkg.items.map(item => item.id);
      
      const response = await fetch('/api/admin/returns/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          claimId: returnPkg.claimId,
          claimLineItemIdList,
          orderNumber: returnPkg.orderNumber,
          items: returnPkg.items.map(item => ({
            id: item.id,
            barcode: item.barcode,
            sku: item.sku,
            productName: item.productName
          }))
        })
      });
      
      const result = await response.json();
      
      if (response.ok) {
        setApproveModal(prev => ({ ...prev, loading: false, result }));
        setMessage(`✅ İade onaylandı! ${result.stockUpdates?.length || 0} ürün stoğu güncellendi.`);
        // Listeyi yenile
        setTimeout(() => {
          loadReturns(currentPage);
        }, 2000);
      } else {
        setApproveModal(prev => ({ ...prev, loading: false, result: { error: result.error } }));
        setMessage(`❌ Hata: ${result.error}`);
      }
    } catch (error) {
      setApproveModal(prev => ({ ...prev, loading: false, result: { error: 'Bağlantı hatası' } }));
      setMessage('❌ Bağlantı hatası');
    }
  };

  // Checkbox seçimi
  const toggleSelectReturn = (claimId: string) => {
    const newSelected = new Set(selectedReturns);
    if (newSelected.has(claimId)) {
      newSelected.delete(claimId);
    } else {
      newSelected.add(claimId);
    }
    setSelectedReturns(newSelected);
  };

  // Tümünü seç/seçme
  const toggleSelectAll = () => {
    const waitingReturns = displayReturns.filter(r => r.status === 'WaitingInAction');
    if (selectedReturns.size === waitingReturns.length) {
      setSelectedReturns(new Set());
    } else {
      setSelectedReturns(new Set(waitingReturns.map(r => r.claimId)));
    }
  };

  // Toplu onay
  const bulkApproveReturns = async () => {
    if (selectedReturns.size === 0) return;
    
    setBulkApproving(true);
    setBulkResult(null);
    setMessage('⏳ Seçili iadeler onaylanıyor...');
    
    const selectedReturnPackages = displayReturns.filter(r => selectedReturns.has(r.claimId));
    const results: any[] = [];
    
    try {
      for (const returnPkg of selectedReturnPackages) {
        try {
          const claimLineItemIdList = returnPkg.items.map(item => item.id);
          
          const response = await fetch('/api/admin/returns/approve', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              claimId: returnPkg.claimId,
              claimLineItemIdList,
              orderNumber: returnPkg.orderNumber,
              items: returnPkg.items.map(item => ({
                id: item.id,
                barcode: item.barcode,
                sku: item.sku,
                productName: item.productName
              }))
            })
          });
          
          const result = await response.json();
          
          results.push({
            orderNumber: returnPkg.orderNumber,
            customerName: returnPkg.customerName,
            success: response.ok,
            result: result,
            error: response.ok ? null : result.error
          });
          
        } catch (error) {
          results.push({
            orderNumber: returnPkg.orderNumber,
            customerName: returnPkg.customerName,
            success: false,
            error: 'Bağlantı hatası'
          });
        }
      }
      
      const successCount = results.filter(r => r.success).length;
      const errorCount = results.filter(r => !r.success).length;
      
      setBulkResult({
        total: results.length,
        success: successCount,
        error: errorCount,
        results: results
      });
      
      setMessage(`✅ ${successCount} iade onaylandı, ${errorCount} hata.`);
      setSelectedReturns(new Set());
      
      // Listeyi yenile
      setTimeout(() => {
        loadReturns(currentPage);
      }, 2000);
      
    } catch (error) {
      setMessage('❌ Toplu onay hatası');
    } finally {
      setBulkApproving(false);
    }
  };

  // API'den filtrelenmiş veri geliyor, ekstra filtreleme gerekmiyor
  // Sadece client-side arama için kullanılabilir
  const displayReturns = returns;

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <div className="text-xl">Yükleniyor...</div>
      </div>
    );
  }

  return (
    <div className="bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-semibold text-gray-800">İade Yönetimi</h1>
          <button
            onClick={syncReturns}
            disabled={syncing}
            className="bg-orange-500 text-white px-4 py-2 rounded hover:bg-orange-600 disabled:opacity-50"
          >
            {syncing ? 'Senkronize Ediliyor...' : 'Trendyol\'dan Çek'}
          </button>
        </div>
      </div>

      {/* Message */}
      {message && (
        <div className={`mx-6 mt-4 p-3 rounded ${message.includes('✅') ? 'bg-green-100 text-green-700' : message.includes('⏳') ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'}`}>
          {message}
        </div>
      )}

      {/* Status Tabs */}
      <div className="bg-white border-b">
        <div className="px-6">
          <div className="flex space-x-0 overflow-x-auto">
            {statusTabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => { setSelectedTab(tab.key); setCurrentPage(0); }}
                className={`px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap ${
                  selectedTab === tab.key
                    ? 'border-orange-500 text-orange-600 bg-orange-50'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
                title={tab.description}
              >
                {tab.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border-b px-6 py-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Müşteri Adı</label>
            <input
              type="text"
              value={filters.customerName}
              onChange={(e) => setFilters(prev => ({ ...prev, customerName: e.target.value }))}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:ring-1 focus:ring-orange-500 focus:border-orange-500"
              placeholder="Müşteri adı"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Sipariş No</label>
            <input
              type="text"
              value={filters.orderNumber}
              onChange={(e) => setFilters(prev => ({ ...prev, orderNumber: e.target.value }))}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:ring-1 focus:ring-orange-500 focus:border-orange-500"
              placeholder="Sipariş numarası"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">İade Kodu</label>
            <input
              type="text"
              value={filters.returnCode}
              onChange={(e) => setFilters(prev => ({ ...prev, returnCode: e.target.value }))}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:ring-1 focus:ring-orange-500 focus:border-orange-500"
              placeholder="İade kodu"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Barkod</label>
            <input
              type="text"
              value={filters.barcode}
              onChange={(e) => setFilters(prev => ({ ...prev, barcode: e.target.value }))}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:ring-1 focus:ring-orange-500 focus:border-orange-500"
              placeholder="Barkod"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">İade Sebebi</label>
            <select
              value={filters.returnReason}
              onChange={(e) => setFilters(prev => ({ ...prev, returnReason: e.target.value }))}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:ring-1 focus:ring-orange-500 focus:border-orange-500"
            >
              <option value="">Tümü</option>
              {returnReasons.map((reason) => (
                <option key={reason} value={reason}>{reason}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">İade Talep Başlangıç Tarihi</label>
            <input
              type="date"
              value={filters.startDate}
              onChange={(e) => setFilters(prev => ({ ...prev, startDate: e.target.value }))}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:ring-1 focus:ring-orange-500 focus:border-orange-500"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">İade Talep Bitiş Tarihi</label>
            <input
              type="date"
              value={filters.endDate}
              onChange={(e) => setFilters(prev => ({ ...prev, endDate: e.target.value }))}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:ring-1 focus:ring-orange-500 focus:border-orange-500"
            />
          </div>
        </div>
        
        <div className="flex justify-between items-center mt-4">
          <div className="flex gap-2">
            <button
              onClick={clearFilters}
              className="bg-gray-200 text-gray-700 px-4 py-2 rounded text-sm hover:bg-gray-300"
            >
              Temizle
            </button>
            <button
              onClick={() => loadReturns(0)}
              className="bg-gray-800 text-white px-4 py-2 rounded text-sm hover:bg-gray-900"
            >
              Filtrele
            </button>
          </div>
          
          {/* Toplu Onay Butonu - Sadece Aksiyon Bekleyen sekmesinde göster */}
          {selectedTab === 'WaitingInAction' && displayReturns.filter(r => r.status === 'WaitingInAction').length > 0 && (
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-600">
                {selectedReturns.size} iade seçili
              </span>
              <button
                onClick={bulkApproveReturns}
                disabled={selectedReturns.size === 0 || bulkApproving}
                className="bg-green-600 text-white px-4 py-2 rounded text-sm hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {bulkApproving ? (
                  <>
                    <span className="animate-spin">⏳</span>
                    Onaylanıyor...
                  </>
                ) : (
                  <>
                    ✓ Seçili İadeleri Onayla ({selectedReturns.size})
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Returns Table */}
      <div className="bg-white mx-6 mt-4 rounded-lg shadow overflow-hidden">
        {returns.length === 0 ? (
          <div className="p-12 text-center">
            <div className="text-6xl mb-4">📦</div>
            <h3 className="text-xl font-semibold text-gray-700 mb-2">İade paketi bulunamadı</h3>
            <p className="text-gray-500 mb-4">
              {returns.length === 0 
                ? 'Henüz iade paketi yok. Trendyol\'dan çekmek için yukarıdaki butonu kullanın.'
                : 'Arama kriterlerinize uygun iade paketi bulunamadı.'
              }
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-gray-50">
                <tr>
                  {/* Checkbox sütunu - Sadece Aksiyon Bekleyen sekmesinde */}
                  {selectedTab === 'WaitingInAction' && (
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-12">
                      <input
                        type="checkbox"
                        checked={displayReturns.filter(r => r.status === 'WaitingInAction').length > 0 && 
                                 selectedReturns.size === displayReturns.filter(r => r.status === 'WaitingInAction').length}
                        onChange={toggleSelectAll}
                        className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                      />
                    </th>
                  )}
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Sipariş Bilgileri
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Alıcı
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Bilgiler
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Birim Fiyat
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Kargo
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Fatura
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    İade Sebebi
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Durum
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {displayReturns.map((returnPkg) => (
                  <tr key={returnPkg.id} className="hover:bg-gray-50">
                    {/* Checkbox sütunu - Sadece WaitingInAction durumunda */}
                    {selectedTab === 'WaitingInAction' && (
                      <td className="px-4 py-4">
                        {returnPkg.status === 'WaitingInAction' ? (
                          <input
                            type="checkbox"
                            checked={selectedReturns.has(returnPkg.claimId)}
                            onChange={() => toggleSelectReturn(returnPkg.claimId)}
                            className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                          />
                        ) : (
                          <div className="w-4 h-4"></div>
                        )}
                      </td>
                    )}
                    <td className="px-4 py-4">
                      <div className="flex items-center">
                        <div className="w-2 h-2 bg-orange-500 rounded-full mr-3"></div>
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            #{returnPkg.orderNumber}
                          </div>
                          <div className="text-xs text-gray-500">
                            {new Date(returnPkg.claimDate).toLocaleDateString('tr-TR')}
                          </div>
                          <div className="text-xs text-gray-500">
                            İade Talep Tarihi: {new Date(returnPkg.claimDate).toLocaleDateString('tr-TR')}
                          </div>
                        </div>
                      </div>
                    </td>
                    
                    <td className="px-4 py-4">
                      <div className="text-sm text-gray-900">{returnPkg.customerName}</div>
                      {returnPkg.customerAddress && (
                        <div className="text-xs text-gray-500">{returnPkg.customerAddress}</div>
                      )}
                    </td>
                    
                    <td className="px-4 py-4">
                      {returnPkg.items.map((item, index) => (
                        <div key={item.id} className="mb-2 last:mb-0">
                          <div className="flex items-center">
                            <div className="w-12 h-12 bg-gray-200 rounded mr-3 flex items-center justify-center">
                              <span className="text-xs text-gray-500">IMG</span>
                            </div>
                            <div>
                              <div className="text-sm font-medium text-gray-900 max-w-xs truncate">
                                {item.productName}
                              </div>
                              <div className="text-xs text-gray-500">
                                Stok Kodu: {item.sku || item.barcode || 'N/A'}
                              </div>
                              <div className="text-xs text-gray-500">
                                Renk: {item.productColor || 'N/A'}, Beden: {item.productSize || 'N/A'}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </td>
                    
                    <td className="px-4 py-4">
                      {returnPkg.items.map((item) => (
                        <div key={item.id} className="text-sm text-gray-900 mb-2">
                          ₺{item.price?.toFixed(2) || '0.00'}
                        </div>
                      ))}
                    </td>
                    
                    <td className="px-4 py-4">
                      <div className="flex items-center">
                        <div className="w-8 h-6 bg-red-600 rounded mr-2 flex items-center justify-center">
                          <span className="text-xs text-white font-bold">aras</span>
                        </div>
                        <div>
                          <div className="text-sm text-gray-900">
                            {returnPkg.cargoTrackingNumber || 'Takip No Yok'}
                          </div>
                          <div className="text-xs text-gray-500">
                            {returnPkg.cargoProvider || 'Aras Kargo'}
                          </div>
                        </div>
                      </div>
                    </td>
                    
                    <td className="px-4 py-4">
                      <div className="text-sm text-gray-900">
                        Toplam Tutar: ₺{returnPkg.totalAmount?.toFixed(2) || '0.00'}
                      </div>
                    </td>
                    
                    <td className="px-4 py-4">
                      {returnPkg.items.map((item) => (
                        <div key={item.id} className="text-sm text-gray-900 mb-2">
                          {item.customerReason || 'Belirtilmemiş'}
                        </div>
                      ))}
                    </td>
                    
                    <td className="px-4 py-4">
                      <div className="flex flex-col gap-1">
                        {returnPkg.status === 'WaitingInAction' ? (
                          <>
                            <button 
                              onClick={() => openApproveModal(returnPkg)}
                              className="bg-green-600 text-white px-3 py-1 rounded text-xs hover:bg-green-700"
                            >
                              İade Onayı
                            </button>
                            <button className="bg-red-600 text-white px-3 py-1 rounded text-xs hover:bg-red-700">
                              İade Red
                            </button>
                          </>
                        ) : (
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            returnPkg.status === 'Accepted' ? 'bg-green-100 text-green-800' :
                            returnPkg.status === 'Rejected' ? 'bg-red-100 text-red-800' :
                            returnPkg.status === 'Created' ? 'bg-blue-100 text-blue-800' :
                            returnPkg.status === 'WaitingInAction' ? 'bg-yellow-100 text-yellow-800' :
                            returnPkg.status === 'Cancelled' ? 'bg-gray-100 text-gray-800' :
                            returnPkg.status === 'InAnalysis' ? 'bg-purple-100 text-purple-800' :
                            returnPkg.status === 'Unresolved' ? 'bg-orange-100 text-orange-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {returnPkg.status === 'Accepted' ? 'Onaylandı' :
                             returnPkg.status === 'Rejected' ? 'Reddedildi' :
                             returnPkg.status === 'Created' ? 'İadesi Oluşturulan' :
                             returnPkg.status === 'WaitingInAction' ? 'Aksiyon Bekleyen' :
                             returnPkg.status === 'Cancelled' ? 'İptal Edildi' :
                             returnPkg.status === 'InAnalysis' ? 'Analiz' :
                             returnPkg.status === 'Unresolved' ? 'İhtilaflı' :
                             returnPkg.status}
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      <div className="bg-white mx-6 mt-4 mb-6 rounded-lg shadow px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-700">
            Filtreleme Sonuçları: Toplam <strong>{totalItems}</strong> iade bilgisi
            <br />
            Sayfa {currentPage + 1} / {totalPages} • Son Güncelleme: {new Date().toLocaleString('tr-TR')}
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-700">Her Sayfada <strong>20</strong> Ürün</span>
            
            {/* Sayfa Numaraları */}
            <div className="flex items-center gap-1">
              {/* Önceki Sayfa */}
              <button
                onClick={() => setCurrentPage(prev => Math.max(0, prev - 1))}
                disabled={currentPage === 0}
                className="px-3 py-1 rounded text-sm border border-gray-300 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                ‹
              </button>
              
              {/* Sayfa Numaraları */}
              {(() => {
                const pages = [];
                const maxVisiblePages = 5;
                let startPage = Math.max(0, currentPage - Math.floor(maxVisiblePages / 2));
                let endPage = Math.min(totalPages - 1, startPage + maxVisiblePages - 1);
                
                if (endPage - startPage < maxVisiblePages - 1) {
                  startPage = Math.max(0, endPage - maxVisiblePages + 1);
                }
                
                // İlk sayfa
                if (startPage > 0) {
                  pages.push(
                    <button
                      key={0}
                      onClick={() => setCurrentPage(0)}
                      className="px-3 py-1 rounded text-sm border border-gray-300 hover:bg-gray-100"
                    >
                      1
                    </button>
                  );
                  if (startPage > 1) {
                    pages.push(<span key="start-ellipsis" className="px-2">...</span>);
                  }
                }
                
                // Görünür sayfalar
                for (let i = startPage; i <= endPage; i++) {
                  pages.push(
                    <button
                      key={i}
                      onClick={() => setCurrentPage(i)}
                      className={`px-3 py-1 rounded text-sm ${
                        currentPage === i
                          ? 'bg-orange-500 text-white'
                          : 'border border-gray-300 hover:bg-gray-100'
                      }`}
                    >
                      {i + 1}
                    </button>
                  );
                }
                
                // Son sayfa
                if (endPage < totalPages - 1) {
                  if (endPage < totalPages - 2) {
                    pages.push(<span key="end-ellipsis" className="px-2">...</span>);
                  }
                  pages.push(
                    <button
                      key={totalPages - 1}
                      onClick={() => setCurrentPage(totalPages - 1)}
                      className="px-3 py-1 rounded text-sm border border-gray-300 hover:bg-gray-100"
                    >
                      {totalPages}
                    </button>
                  );
                }
                
                return pages;
              })()}
              
              {/* Sonraki Sayfa */}
              <button
                onClick={() => setCurrentPage(prev => Math.min(totalPages - 1, prev + 1))}
                disabled={currentPage >= totalPages - 1}
                className="px-3 py-1 rounded text-sm border border-gray-300 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                ›
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* İade Onay Modal */}
      {approveModal.isOpen && approveModal.returnPkg && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold text-gray-900">İade Onaylama</h2>
                <button 
                  onClick={() => setApproveModal({ isOpen: false, returnPkg: null, loading: false, result: null })}
                  className="text-gray-500 hover:text-gray-700"
                >
                  ✕
                </button>
              </div>
            </div>
            
            <div className="p-6">
              {/* Sipariş Bilgileri */}
              <div className="mb-6 bg-gray-50 rounded-lg p-4">
                <h3 className="font-semibold text-gray-700 mb-2">Sipariş Bilgileri</h3>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div><span className="text-gray-500">Sipariş No:</span> <strong>{approveModal.returnPkg.orderNumber}</strong></div>
                  <div><span className="text-gray-500">Müşteri:</span> {approveModal.returnPkg.customerName}</div>
                  <div><span className="text-gray-500">İade Tarihi:</span> {new Date(approveModal.returnPkg.claimDate).toLocaleDateString('tr-TR')}</div>
                  <div><span className="text-gray-500">Kargo Takip:</span> {approveModal.returnPkg.cargoTrackingNumber || '-'}</div>
                </div>
              </div>
              
              {/* İade Ürünleri */}
              <div className="mb-6">
                <h3 className="font-semibold text-gray-700 mb-3">İade Edilen Ürünler</h3>
                <div className="space-y-3">
                  {approveModal.returnPkg.items.map((item, index) => (
                    <div key={item.id} className="border rounded-lg p-4 bg-white">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="font-medium text-gray-900">{item.productName}</div>
                          <div className="text-sm text-gray-500 mt-1">
                            <span className="mr-4">Barkod: <strong>{item.barcode || '-'}</strong></span>
                            <span className="mr-4">SKU: {item.sku || '-'}</span>
                          </div>
                          <div className="text-sm text-gray-500">
                            <span className="mr-4">Renk: {item.productColor || '-'}</span>
                            <span>Beden: {item.productSize || '-'}</span>
                          </div>
                          <div className="text-sm text-orange-600 mt-1">
                            İade Sebebi: {item.customerReason || 'Belirtilmemiş'}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-lg font-bold text-gray-900">₺{item.price?.toFixed(2) || '0.00'}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              
              {/* Sonuç */}
              {approveModal.result && (
                <div className={`mb-6 p-4 rounded-lg ${approveModal.result.error ? 'bg-red-50 border border-red-200' : 'bg-green-50 border border-green-200'}`}>
                  {approveModal.result.error ? (
                    <div className="text-red-700">
                      <strong>❌ Hata:</strong> {approveModal.result.error}
                    </div>
                  ) : (
                    <div>
                      <div className="text-green-700 font-semibold mb-2">✅ İade Başarıyla Onaylandı!</div>
                      
                      {approveModal.result.matchedProducts?.length > 0 && (
                        <div className="mt-3">
                          <div className="text-sm font-medium text-gray-700 mb-2">Stok Güncellenen Ürünler:</div>
                          {approveModal.result.matchedProducts.map((product: any, idx: number) => (
                            <div key={idx} className="text-sm bg-white rounded p-3 mb-2 border border-green-200">
                              <div className="font-medium text-gray-900">{product.productName}</div>
                              <div className="text-gray-500 mt-1">
                                Mağaza: <strong className="text-blue-600">{product.marketplace} - {product.storeName}</strong>
                              </div>
                              <div className="text-gray-500">
                                Stok: {product.currentStock} → <strong className="text-green-600">{product.currentStock + 1}</strong>
                              </div>
                              <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded">
                                <span className="text-yellow-800">📍 <strong>Lokasyon:</strong> {product.location}</span>
                                <div className="text-yellow-700 text-xs mt-1">
                                  Ürünü bu lokasyona yerleştirebilirsiniz.
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                      
                      {approveModal.result.unmatchedItems?.length > 0 && (
                        <div className="mt-3">
                          <div className="text-sm font-medium text-orange-700 mb-2">⚠️ Eşleşmeyen Ürünler:</div>
                          {approveModal.result.unmatchedItems.map((item: any, idx: number) => (
                            <div key={idx} className="text-sm text-orange-600">
                              {item.productName} - {item.reason}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
            
            {/* Footer */}
            <div className="p-6 border-t bg-gray-50 flex justify-end gap-3">
              <button
                onClick={() => setApproveModal({ isOpen: false, returnPkg: null, loading: false, result: null })}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100"
              >
                {approveModal.result ? 'Kapat' : 'İptal'}
              </button>
              {!approveModal.result && (
                <button
                  onClick={approveReturn}
                  disabled={approveModal.loading}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {approveModal.loading ? (
                    <>
                      <span className="animate-spin">⏳</span>
                      Onaylanıyor...
                    </>
                  ) : (
                    <>
                      ✓ İadeyi Onayla ve Stoğu Güncelle
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Toplu Onay Sonuç Modal */}
      {bulkResult && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold text-gray-900">Toplu Onay Sonuçları</h2>
                <button 
                  onClick={() => setBulkResult(null)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  ✕
                </button>
              </div>
            </div>
            
            <div className="p-6">
              {/* Özet */}
              <div className="mb-6 bg-gray-50 rounded-lg p-4">
                <h3 className="font-semibold text-gray-700 mb-2">Özet</h3>
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div className="bg-white rounded p-3 border">
                    <div className="text-2xl font-bold text-gray-900">{bulkResult.total}</div>
                    <div className="text-sm text-gray-500">Toplam</div>
                  </div>
                  <div className="bg-white rounded p-3 border border-green-200">
                    <div className="text-2xl font-bold text-green-600">{bulkResult.success}</div>
                    <div className="text-sm text-gray-500">Başarılı</div>
                  </div>
                  <div className="bg-white rounded p-3 border border-red-200">
                    <div className="text-2xl font-bold text-red-600">{bulkResult.error}</div>
                    <div className="text-sm text-gray-500">Hatalı</div>
                  </div>
                </div>
              </div>
              
              {/* Detaylar */}
              <div className="space-y-3">
                <h3 className="font-semibold text-gray-700">Detaylar</h3>
                {bulkResult.results.map((result: any, idx: number) => (
                  <div key={idx} className={`border rounded-lg p-4 ${result.success ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-medium text-gray-900">
                          {result.success ? '✅' : '❌'} #{result.orderNumber}
                        </div>
                        <div className="text-sm text-gray-600">{result.customerName}</div>
                        {result.error && (
                          <div className="text-sm text-red-600 mt-1">{result.error}</div>
                        )}
                      </div>
                      {result.success && result.result?.matchedProducts?.length > 0 && (
                        <div className="text-right">
                          <div className="text-sm text-green-600">
                            {result.result.matchedProducts.length} ürün stoğu güncellendi
                          </div>
                        </div>
                      )}
                    </div>
                    
                    {/* Başarılı onayların detayları */}
                    {result.success && result.result?.matchedProducts?.length > 0 && (
                      <div className="mt-3 space-y-2">
                        {result.result.matchedProducts.map((product: any, pidx: number) => (
                          <div key={pidx} className="text-xs bg-white rounded p-2 border">
                            <div className="font-medium">{product.productName}</div>
                            <div className="text-gray-500">
                              📍 {product.location} • Stok: {product.currentStock} → {product.currentStock + 1}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
            
            <div className="p-6 border-t bg-gray-50 flex justify-end">
              <button
                onClick={() => setBulkResult(null)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100"
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
