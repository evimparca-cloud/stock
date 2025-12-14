'use client';

import { useEffect, useState } from 'react';
import LoadingSpinner from '@/components/LoadingSpinner';

interface Product {
  id: string;
  sku: string;
  name: string;
  stockQuantity: number;
  price: string;
  location?: string;
  createdAt: string;
  mappings: Array<{
    id: string;
    remoteSku: string;
    remoteProductId?: string;
    syncStock: boolean;
    marketplace: {
      id: string;
      name: string;
      storeName?: string | null;
    };
  }>;
}

interface Marketplace {
  id: string;
  name: string;
  storeName?: string | null;
  isActive: boolean;
}

interface StockLog {
  id: string;
  type: string;
  quantity: number;
  oldStock: number;
  newStock: number;
  reason?: string;
  reference?: string;
  createdBy?: string;
  createdAt: string;
  order?: {
    id: string;
    marketplaceOrderId: string;
    marketplace: {
      name: string;
      storeName?: string | null;
    };
  };
}

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [formData, setFormData] = useState({
    sku: '',
    name: '',
    stockQuantity: '',
    price: '',
    location: '',
  });
  const [showStockModal, setShowStockModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [stockLogs, setStockLogs] = useState<StockLog[]>([]);
  const [showLogsModal, setShowLogsModal] = useState(false);
  const [stockFormData, setStockFormData] = useState({
    type: 'ENTRY',
    quantity: '',
    reason: '',
    newLocation: '',
  });
  const [showMappingModal, setShowMappingModal] = useState(false);
  const [marketplaces, setMarketplaces] = useState<Marketplace[]>([]);
  const [mappingFormData, setMappingFormData] = useState({
    marketplaceId: '',
    remoteSku: '',
    remoteProductId: '',
    syncStock: true,
  });
  const [showApiUpdateModal, setShowApiUpdateModal] = useState(false);
  const [apiUpdateData, setApiUpdateData] = useState({
    stockQuantity: '',
    location: '',
    updateTrendyol: true,
    salePrice: '',
    listPrice: '',
    stockCode: '',
  });
  const [showTrendyolModal, setShowTrendyolModal] = useState(false);
  const [selectedTrendyolProduct, setSelectedTrendyolProduct] = useState<any>(null);
  const [selectedMapping, setSelectedMapping] = useState<any>(null);
  const [productEdits, setProductEdits] = useState<Record<string, { location?: string; stockQuantity?: number; price?: string }>>({});

  useEffect(() => {
    fetchProducts();
    fetchMarketplaces();
  }, [search]);

  const fetchProducts = async () => {
    try {
      const url = search 
        ? `/api/products?search=${encodeURIComponent(search)}&limit=100`
        : '/api/products?limit=100';
      const response = await fetch(url);
      const data = await response.json();
      // Güvenli: data.data veya data (array ise) veya boş array
      setProducts(data?.data || (Array.isArray(data) ? data : []));
    } catch (error) {
      console.error('Error fetching products:', error);
      setProducts([]); // Hata durumunda boş array
    } finally {
      setLoading(false);
    }
  };

  const fetchMarketplaces = async () => {
    try {
      const response = await fetch('/api/marketplaces');
      const data = await response.json();
      setMarketplaces(data);
    } catch (error) {
      console.error('Error fetching marketplaces:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const url = editingProduct ? `/api/products/${editingProduct.id}` : '/api/products';
      const method = editingProduct ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sku: formData.sku,
          name: formData.name,
          stockQuantity: parseInt(formData.stockQuantity),
          price: parseFloat(formData.price),
          location: formData.location || null,
        }),
      });

      if (response.ok) {
        setShowModal(false);
        setEditingProduct(null);
        setFormData({ sku: '', name: '', stockQuantity: '', price: '', location: '' });
        fetchProducts();
      } else {
        const error = await response.json();
        alert(error.error || 'Bir hata oluştu');
      }
    } catch (error) {
      console.error('Error saving product:', error);
      alert('Bir hata oluştu');
    }
  };

  const handleEdit = (product: Product) => {
    setEditingProduct(product);
    setFormData({
      sku: product.sku,
      name: product.name,
      stockQuantity: product.stockQuantity.toString(),
      price: product.price,
      location: product.location || '',
    });
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    const product = products.find(p => p.id === id);
    const productName = product ? product.name : 'Bu ürün';
    
    if (!confirm(`${productName} ürününü silmek istediğinizden emin misiniz?\n\n⚠️ Bu işlem:\n- Ürünü tamamen siler\n- Tüm eşleştirmeleri siler\n- Tüm stok geçmişini siler\n\nGeri alınamaz!`)) return;

    try {
      console.log('Deleting product:', id);
      const response = await fetch(`/api/products/${id}`, { method: 'DELETE' });
      
      if (response.ok) {
        const data = await response.json();
        alert(`✅ ${data.productName || 'Ürün'} başarıyla silindi!`);
        fetchProducts();
      } else {
        const error = await response.json();
        console.error('Delete error:', error);
        alert(`❌ Ürün silinemedi:\n${error.error || 'Bilinmeyen hata'}\n${error.details || ''}`);
      }
    } catch (error) {
      console.error('Error deleting product:', error);
      alert('❌ Ürün silinirken bir hata oluştu!\nİnternet bağlantınızı kontrol edin.');
    }
  };

  const openNewProductModal = () => {
    setEditingProduct(null);
    setFormData({ sku: '', name: '', stockQuantity: '', price: '', location: '' });
    setShowModal(true);
  };

  const openStockModal = (product: Product) => {
    setSelectedProduct(product);
    setStockFormData({ type: 'ENTRY', quantity: '', reason: '', newLocation: '' });
    setShowStockModal(true);
  };

  const handleStockSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct) return;

    try {
      // Lokasyon birleştirme mantığı
      let finalLocation = selectedProduct.location || '';
      if (stockFormData.newLocation) {
        if (selectedProduct.location) {
          // Mevcut lokasyon varsa, tire ile birleştir
          finalLocation = `${selectedProduct.location}-${stockFormData.newLocation}`;
        } else {
          // Mevcut lokasyon yoksa, sadece yeni lokasyonu kullan
          finalLocation = stockFormData.newLocation;
        }
      }

      // Stok log kaydı
      const logResponse = await fetch(`/api/products/${selectedProduct.id}/stock-logs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: stockFormData.type,
          quantity: parseInt(stockFormData.quantity),
          reason: stockFormData.reason + (stockFormData.newLocation ? ` | Yeni Lokasyon: ${finalLocation}` : ''),
          createdBy: 'Admin',
        }),
      });

      if (!logResponse.ok) {
        const error = await logResponse.json();
        alert(error.error || 'Stok log kaydı başarısız');
        return;
      }

      // Lokasyon güncellemesi (eğer yeni lokasyon girildiyse)
      if (stockFormData.newLocation) {
        const updateResponse = await fetch(`/api/products/${selectedProduct.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            location: finalLocation,
          }),
        });

        if (!updateResponse.ok) {
          console.warn('Lokasyon güncellenemedi');
        }
      }

      setShowStockModal(false);
      setSelectedProduct(null);
      setStockFormData({ type: 'ENTRY', quantity: '', reason: '', newLocation: '' });
      fetchProducts();
      
      const message = stockFormData.newLocation 
        ? `✅ Stok hareketi kaydedildi!\n\n📍 Yeni Lokasyon: ${finalLocation}`
        : '✅ Stok hareketi başarıyla kaydedildi!';
      alert(message);
    } catch (error) {
      console.error('Error saving stock movement:', error);
      alert('Bir hata oluştu');
    }
  };

  const viewLogs = async (product: Product) => {
    setSelectedProduct(product);
    setShowLogsModal(true);
    
    try {
      const response = await fetch(`/api/products/${product.id}/stock-logs`);
      const data = await response.json();
      if (data.success) {
        setStockLogs(data.data);
      }
    } catch (error) {
      console.error('Error fetching stock logs:', error);
    }
  };

  const getLogTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      ENTRY: 'Stok Girişi',
      EXIT: 'Stok Çıkışı',
      SALE: 'Satış',
      RETURN: 'İade',
      CANCEL: 'İptal',
      ADJUSTMENT: 'Düzeltme',
      DAMAGED: 'Hasarlı',
      TRANSFER: 'Transfer',
    };
    return labels[type] || type;
  };

  const getLogTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      ENTRY: 'bg-green-100 text-green-800',
      EXIT: 'bg-red-100 text-red-800',
      SALE: 'bg-blue-100 text-blue-800',
      RETURN: 'bg-yellow-100 text-yellow-800',
      CANCEL: 'bg-orange-100 text-orange-800',
      ADJUSTMENT: 'bg-purple-100 text-purple-800',
      DAMAGED: 'bg-red-200 text-red-900',
      TRANSFER: 'bg-indigo-100 text-indigo-800',
    };
    return colors[type] || 'bg-gray-100 text-gray-800';
  };

  const openMappingModal = (product: Product) => {
    setSelectedProduct(product);
    setMappingFormData({
      marketplaceId: '',
      remoteSku: '',
      remoteProductId: '',
      syncStock: true,
    });
    setShowMappingModal(true);
  };

  const handleMappingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct) return;

    try {
      const response = await fetch(`/api/products/${selectedProduct.id}/mappings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mappingFormData),
      });

      const result = await response.json();

      if (result.success) {
        setShowMappingModal(false);
        setSelectedProduct(null);
        setMappingFormData({
          marketplaceId: '',
          remoteSku: '',
          remoteProductId: '',
          syncStock: true,
        });
        fetchProducts();
        alert('✅ Eşleştirme başarıyla oluşturuldu!');
      } else {
        alert(result.error || 'Eşleştirme oluşturulamadı');
      }
    } catch (error) {
      console.error('Error creating mapping:', error);
      alert('Bir hata oluştu');
    }
  };

  const deleteMappingHandler = async (product: Product, mappingId: string, marketplaceId: string) => {
    if (!confirm('Bu eşleştirmeyi kaldırmak istediğinizden emin misiniz?')) return;

    try {
      const response = await fetch(`/api/products/${product.id}/mappings?marketplaceId=${marketplaceId}`, {
        method: 'DELETE',
      });

      const result = await response.json();

      if (result.success) {
        fetchProducts();
        alert('✅ Eşleştirme kaldırıldı!');
      } else {
        alert(result.error || 'Eşleştirme kaldırılamadı');
      }
    } catch (error) {
      console.error('Error deleting mapping:', error);
      alert('Bir hata oluştu');
    }
  };

  const openApiUpdateModal = (product: Product) => {
    setSelectedProduct(product);
    setApiUpdateData({
      stockQuantity: product.stockQuantity.toString(),
      location: product.location || '',
      updateTrendyol: true,
      salePrice: product.price,
      listPrice: (parseFloat(product.price) * 1.1).toFixed(2),
      stockCode: product.sku, // SKU'yu stok kodu olarak kullan
    });
    setShowApiUpdateModal(true);
  };

  const openTrendyolDetails = async (product: Product, mapping: any) => {
    try {
      console.log('🔍 Trendyol ürün detayları çekiliyor...', {
        barcode: mapping.remoteSku,
        marketplaceId: mapping.marketplaceId
      });

      // Trendyol API'sinden gerçek ürün bilgilerini çek
      const response = await fetch(`/api/trendyol/product-details`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          marketplaceId: mapping.marketplaceId,
          barcode: mapping.remoteSku,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        console.log('✅ Trendyol ürün detayları alındı:', result);
        
        setSelectedTrendyolProduct(result.product);
        setSelectedMapping(mapping);
        setSelectedProduct(product);
        setShowTrendyolModal(true);
      } else {
        console.error('❌ Trendyol detay hatası');
        alert('Trendyol ürün detayları alınamadı. Lütfen tekrar deneyin.');
      }
    } catch (error) {
      console.error('Error fetching Trendyol details:', error);
      alert('Bir hata oluştu');
    }
  };

  const handleTrendyolLocationUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct || !selectedMapping || !selectedTrendyolProduct) return;

    try {
      console.log('🔄 Trendyol ürün bilgileri güncelleniyor...', {
        productId: selectedProduct.id,
        stockCode: selectedTrendyolProduct.stockCode,
        mapping: selectedMapping
      });

      // 1. Yerel veritabanında lokasyonu güncelle (stockCode'u location olarak kaydet)
      const localResponse = await fetch(`/api/products/${selectedProduct.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          location: selectedTrendyolProduct.stockCode,
        }),
      });

      if (!localResponse.ok) {
        const error = await localResponse.json();
        alert(error.error || 'Yerel güncelleme başarısız');
        return;
      }

      console.log('✅ Yerel DB güncellendi');

      // 2. Trendyol'a tüm güncellenmiş bilgileri gönder
      if (selectedMapping.marketplace.name === 'Trendyol') {
        // Açıklamayı HTML formatına çevir
        const formatDescriptionToHTML = (text: string) => {
          if (!text) return '';
          
          const lines = text.split('\n').filter(line => line.trim() !== '');
          const listItems = lines.map(line => {
            const cleanLine = line.trim().replace(/^-\s*/, '');
            return `  <li>${cleanLine}<br /></li>`;
          }).join('\n');
          
          return `<div><ul>\n${listItems}\n</ul>\n<div><br /></div>\n</div>`;
        };

        const formattedDescription = formatDescriptionToHTML(selectedTrendyolProduct.description || '');

        console.log('🚀 Trendyol\'a güncellenmiş ürün bilgileri gönderiliyor...', {
          remoteSku: selectedMapping.remoteSku,
          stockCode: selectedTrendyolProduct.stockCode,
          dimensionalWeight: selectedTrendyolProduct.dimensionalWeight,
          deliveryDuration: selectedTrendyolProduct.deliveryDuration,
          vatRate: selectedTrendyolProduct.vatRate,
          description: formattedDescription,
          marketplaceId: selectedMapping.marketplaceId
        });

        // Önce fiyat ve stok güncelle
        const priceStockResponse = await fetch('/api/sync/trendyol-update', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            updateType: 'priceAndInventory',
            marketplaceId: selectedMapping.marketplaceId,
            updates: [{
              sku: selectedMapping.remoteSku,
              quantity: selectedTrendyolProduct.stockQuantity,
              salePrice: selectedTrendyolProduct.salePrice,
              listPrice: selectedTrendyolProduct.listPrice,
            }],
          }),
        });

        if (!priceStockResponse.ok) {
          console.warn('⚠️ Fiyat ve stok güncellenemedi');
        }

        // Sonra ürün bilgilerini güncelle
        const trendyolResponse = await fetch('/api/sync/trendyol-update', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            updateType: 'products',
            marketplaceId: selectedMapping.marketplaceId,
            updates: [{
              sku: selectedMapping.remoteSku,
              stockCode: selectedTrendyolProduct.stockCode,
              dimensionalWeight: selectedTrendyolProduct.dimensionalWeight,
              deliveryDuration: selectedTrendyolProduct.deliveryDuration,
              vatRate: selectedTrendyolProduct.vatRate,
              description: formattedDescription,
            }],
          }),
        });

        if (trendyolResponse.ok) {
          const trendyolResult = await trendyolResponse.json();
          console.log('✅ Trendyol stockCode güncellendi:', trendyolResult);
          
          // Stok logu oluştur
          await fetch(`/api/products/${selectedProduct.id}/stock-logs`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              type: 'ADJUSTMENT',
              quantity: 0,
              reason: `Trendyol ürün bilgileri güncellendi`,
              reference: `stockCode: ${selectedTrendyolProduct.stockCode}, desi: ${selectedTrendyolProduct.dimensionalWeight}`,
            }),
          });

          fetchProducts();
          setShowTrendyolModal(false);
          alert(`✅ Trendyol ürün bilgileri güncellendi!\n\n📦 stockCode: ${selectedTrendyolProduct.stockCode}\n📐 Desi: ${selectedTrendyolProduct.dimensionalWeight}\n🚚 Teslimat: ${selectedTrendyolProduct.deliveryDuration} gün\n📄 KDV: %${selectedTrendyolProduct.vatRate}`);
        } else {
          const trendyolError = await trendyolResponse.json();
          console.error('❌ Trendyol güncelleme hatası:', trendyolError);
          
          // 15 dakika hatası kontrolü
          if (trendyolError.error && trendyolError.error.includes('15')) {
            alert(`⚠️ Yerel DB güncellendi!\n\n❌ Trendyol Hatası: Aynı bilgilerle 15 dakika içinde tekrar güncelleme yapılamaz.\n\nLokasyon yerel sistemde kaydedildi: ${selectedProduct.location}`);
          } else {
            alert(`⚠️ Yerel DB güncellendi!\n\n❌ Trendyol Hatası: ${trendyolError.error || 'Bilinmeyen hata'}\n\nLokasyon yerel sistemde kaydedildi: ${selectedProduct.location}`);
          }
          
          fetchProducts();
          setShowTrendyolModal(false);
        }
      } else {
        fetchProducts();
        setShowTrendyolModal(false);
        alert('✅ Lokasyon yerel DB\'de güncellendi!');
      }
    } catch (error) {
      console.error('Error updating location:', error);
      alert('Bir hata oluştu');
    }
  };

  const handleDeleteMapping = async (mappingId: string) => {
    if (!confirm('Bu eşleştirmeyi silmek istediğinizden emin misiniz?')) {
      return;
    }

    try {
      const response = await fetch(`/api/products/mappings/${mappingId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        fetchProducts();
        alert('✅ Eşleştirme silindi!');
      } else {
        const error = await response.json();
        alert(error.error || 'Silme başarısız');
      }
    } catch (error) {
      console.error('Error deleting mapping:', error);
      alert('Bir hata oluştu');
    }
  };

  const handleApiUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct) return;

    try {
      // Önce yerel veritabanını güncelle
      const localResponse = await fetch(`/api/products/${selectedProduct.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stockQuantity: parseInt(apiUpdateData.stockQuantity),
          location: apiUpdateData.location || null,
        }),
      });

      if (!localResponse.ok) {
        const error = await localResponse.json();
        alert(error.error || 'Yerel güncelleme başarısız');
        return;
      }

      // Stok log oluştur
      await fetch(`/api/products/${selectedProduct.id}/stock-logs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'ADJUSTMENT',
          quantity: parseInt(apiUpdateData.stockQuantity),
          reason: 'API ile güncelleme',
          createdBy: 'API Update',
        }),
      });

      // Eğer Trendyol güncelleme seçilmişse ve ürünün pazaryeri eşleştirmesi varsa
      if (apiUpdateData.updateTrendyol && selectedProduct.mappings.length > 0) {
        for (const mapping of selectedProduct.mappings) {
          if (mapping.marketplace.name === 'Trendyol' && mapping.syncStock) {
            try {
              console.log('🔍 Trendyol güncelleme başlıyor:', {
                remoteSku: mapping.remoteSku,
                currentStock: selectedProduct.stockQuantity,
                newStock: apiUpdateData.stockQuantity,
                currentPrice: selectedProduct.price,
                newSalePrice: apiUpdateData.salePrice,
                newListPrice: apiUpdateData.listPrice,
                currentLocation: selectedProduct.location,
                newLocation: apiUpdateData.location,
                currentStockCode: selectedProduct.sku,
                newStockCode: apiUpdateData.stockCode
              });

              // 1. Stok ve fiyat güncelleme (sadece değişmişse)
              const currentStock = parseInt(apiUpdateData.stockQuantity);
              const needsPriceInventoryUpdate = 
                currentStock !== selectedProduct.stockQuantity ||
                (apiUpdateData.salePrice && parseFloat(apiUpdateData.salePrice) !== parseFloat(selectedProduct.price)) ||
                apiUpdateData.listPrice;

              console.log('📊 Stok/Fiyat güncelleme gerekli mi?', needsPriceInventoryUpdate);

              if (needsPriceInventoryUpdate) {
                const priceInventoryPayload: any = {
                  sku: mapping.remoteSku,
                  quantity: currentStock,
                };

                // Fiyat bilgileri varsa ekle
                if (apiUpdateData.salePrice) {
                  priceInventoryPayload.salePrice = parseFloat(apiUpdateData.salePrice);
                }
                if (apiUpdateData.listPrice) {
                  priceInventoryPayload.listPrice = parseFloat(apiUpdateData.listPrice);
                }

                console.log('🔄 Trendyol stok/fiyat güncelleniyor:', priceInventoryPayload);

                const priceInventoryResponse = await fetch('/api/sync/trendyol-update', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    marketplaceId: mapping.marketplace.id,
                    updates: [priceInventoryPayload],
                    updateType: 'priceAndInventory',
                  }),
                });

                const priceInventoryResult = await priceInventoryResponse.json();
                
                if (priceInventoryResult.success) {
                  console.log('✅ Trendyol stok/fiyat güncellendi:', priceInventoryResult.batchRequestId);
                } else {
                  console.warn('⚠️ Trendyol stok/fiyat güncellenemedi:', priceInventoryResult.message);
                  if (priceInventoryResult.message.includes('15 dakika')) {
                    alert(`⚠️ Trendyol Stok/Fiyat: ${priceInventoryResult.message}`);
                  }
                }
              } else {
                console.log('ℹ️ Stok/fiyat değişmediği için güncelleme yapılmadı');
              }

              // 2. Ürün bilgisi güncelleme (lokasyon ve stok kodu)
              const productUpdatePayload: any = {
                sku: mapping.remoteSku,
              };

              let needsProductUpdate = false;

              // Sadece gerçek stok kodu değişmişse Trendyol'a gönder
              // Lokasyon bilgisi sadece yerel veritabanında tutulur
              console.log('🔍 Stok kodu kontrolü:', {
                currentStockCode: selectedProduct.sku,
                newStockCode: apiUpdateData.stockCode,
                location: apiUpdateData.location,
                note: 'Lokasyon sadece yerel DB\'de tutulur'
              });

              if (apiUpdateData.stockCode && apiUpdateData.stockCode !== selectedProduct.sku) {
                productUpdatePayload.stockCode = apiUpdateData.stockCode;
                needsProductUpdate = true;
                console.log('✅ Stok kodu güncelleme eklendi:', apiUpdateData.stockCode);
              }

              // Lokasyon bilgisi sadece yerel veritabanında güncellenir
              if (apiUpdateData.location && apiUpdateData.location !== selectedProduct.location) {
                console.log('ℹ️ Lokasyon sadece yerel veritabanında güncellendi:', {
                  oldLocation: selectedProduct.location,
                  newLocation: apiUpdateData.location,
                  note: 'Trendyol API\'sine gönderilmez (zorunlu alanlar karmaşık)'
                });
              }

              // Ürün bilgisi güncellemesi gerekiyorsa gönder
              console.log('📋 Ürün bilgisi güncelleme gerekli mi?', needsProductUpdate);
              console.log('📦 Ürün güncelleme payload:', productUpdatePayload);

              if (needsProductUpdate) {
                console.log('🔄 Trendyol ürün bilgisi güncelleniyor...');
                
                const productUpdateResponse = await fetch('/api/sync/trendyol-update', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    marketplaceId: mapping.marketplace.id,
                    updates: [productUpdatePayload],
                    updateType: 'products',
                  }),
                });

                const productUpdateResult = await productUpdateResponse.json();
                
                if (productUpdateResult.success) {
                  console.log('✅ Trendyol ürün bilgisi güncellendi:', productUpdateResult.batchRequestId);
                } else {
                  console.warn('⚠️ Trendyol ürün bilgisi güncellenemedi:', productUpdateResult.message);
                  console.error('❌ Hata detayı:', productUpdateResult.error);
                }
              } else {
                console.log('ℹ️ Ürün bilgisi değişmediği için güncelleme yapılmadı');
              }

            } catch (trendyolError) {
              console.error('Trendyol API hatası:', trendyolError);
            }
          }
        }
      }

      setShowApiUpdateModal(false);
      setSelectedProduct(null);
      setApiUpdateData({ 
        stockQuantity: '', 
        location: '', 
        updateTrendyol: true, 
        salePrice: '', 
        listPrice: '',
        stockCode: ''
      });
      fetchProducts();
      alert('✅ Ürün bilgileri güncellendi! Pazaryeri eşleştirmeleri de kontrol edildi.');
    } catch (error) {
      console.error('Error updating product via API:', error);
      alert('Bir hata oluştu');
    }
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-purple-50/20 to-pink-50/20 p-3 md:p-8 space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="space-y-2">
          <h1 className="text-3xl md:text-5xl font-bold bg-gradient-to-r from-purple-600 via-pink-600 to-red-600 bg-clip-text text-transparent animate-slide-in">
            Ürünler
          </h1>
          <p className="text-base md:text-lg text-gray-600 font-medium">Yerel stok ürünlerinizi yönetin</p>
          <div className="h-1 w-24 bg-gradient-to-r from-purple-600 to-pink-600 rounded-full"></div>
        </div>
        <button
          onClick={openNewProductModal}
          className="btn btn-primary flex items-center gap-2 shadow-lg hover:shadow-xl"
        >
          <span className="text-xl">➕</span>
          Yeni Ürün
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl pointer-events-none">
          🔍
        </span>
        <input
          type="text"
          placeholder="Ürün adı veya SKU ile ara..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="input w-full pl-12 pr-4 py-3 text-base shadow-md"
        />
      </div>

      {/* Products Table */}
      <div className="group relative overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xl hover:shadow-2xl transition-all duration-300">
        <div className="absolute top-0 right-0 h-32 w-32 bg-gradient-to-br from-purple-500 to-pink-600 opacity-5 blur-2xl"></div>
        <div className="overflow-x-auto">
          <table className="table-modern">
            <thead>
              <tr>
                <th>SKU</th>
                <th>Ürün Adı</th>
                <th>Lokasyon</th>
                <th>Stok</th>
                <th>Fiyat</th>
                <th>Pazaryerleri</th>
                <th>İşlemler</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {(!products || products.length === 0) ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-gray-500">
                    Ürün bulunamadı
                  </td>
                </tr>
              ) : (
                products.map((product) => (
                  <tr key={product.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="p-4">
                      <span className="font-mono text-sm font-bold text-gray-800 bg-gray-100 px-2 py-1 rounded">
                        {product.sku}
                      </span>
                    </td>
                    <td className="p-4 font-medium text-gray-900">{product.name}</td>
                    <td className="p-4 text-sm">
                      <input
                        type="text"
                        value={productEdits[product.id]?.location ?? product.location ?? ''}
                        onChange={(e) => {
                          setProductEdits(prev => ({
                            ...prev,
                            [product.id]: {
                              ...prev[product.id],
                              location: e.target.value
                            }
                          }));
                        }}
                        placeholder="A-12"
                        className="w-24 px-2 py-1 text-xs border border-gray-300 rounded focus:border-indigo-500 focus:outline-none"
                      />
                    </td>
                    <td className="p-4">
                      <input
                        type="number"
                        value={productEdits[product.id]?.stockQuantity ?? product.stockQuantity}
                        onChange={(e) => {
                          const value = parseInt(e.target.value);
                          if (!isNaN(value)) {
                            setProductEdits(prev => ({
                              ...prev,
                              [product.id]: {
                                ...prev[product.id],
                                stockQuantity: value
                              }
                            }));
                          }
                        }}
                        className="w-20 px-2 py-1 text-xs border border-gray-300 rounded focus:border-indigo-500 focus:outline-none"
                      />
                    </td>
                    <td className="p-4">
                      <input
                        type="number"
                        step="0.01"
                        value={productEdits[product.id]?.price ?? product.price}
                        onChange={(e) => {
                          setProductEdits(prev => ({
                            ...prev,
                            [product.id]: {
                              ...prev[product.id],
                              price: e.target.value
                            }
                          }));
                        }}
                        className="w-24 px-2 py-1 text-xs border border-gray-300 rounded focus:border-indigo-500 focus:outline-none"
                      />
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      <div className="flex flex-wrap gap-1">
                        {product.mappings.map((mapping) => (
                          <div key={mapping.id} className="flex items-center gap-1">
                            <span 
                              className="inline-flex flex-col gap-0.5 px-2 py-1 rounded-lg text-xs font-medium bg-blue-100 text-blue-800"
                              title={`${mapping.marketplace.storeName || ''}\nSKU: ${mapping.remoteSku}\nID: ${mapping.remoteProductId || 'N/A'}\n${mapping.syncStock ? '🔄 Sync Aktif' : '❌ Sync Pasif'}`}
                            >
                              <div className="flex items-center gap-1">
                                {mapping.marketplace.name}
                                {mapping.syncStock && <span>🔄</span>}
                              </div>
                              {mapping.marketplace.storeName && (
                                <div className="text-[10px] text-blue-600 font-semibold">
                                  {mapping.marketplace.storeName}
                                </div>
                              )}
                            </span>
                            {mapping.marketplace.name === 'Trendyol' && (
                              <button
                                onClick={() => openTrendyolDetails(product, mapping)}
                                className="px-1.5 py-0.5 bg-blue-600 hover:bg-blue-700 text-white text-[10px] rounded"
                                title="Detaylar"
                              >
                                📋
                              </button>
                            )}
                            <button
                              onClick={() => handleDeleteMapping(mapping.id)}
                              className="px-1.5 py-0.5 bg-red-600 hover:bg-red-700 text-white text-[10px] rounded"
                              title="Kaldır"
                            >
                              ✕
                            </button>
                          </div>
                        ))}
                        {product.mappings.length === 0 && (
                          <span className="text-gray-400 text-xs">Eşleştirme yok</span>
                        )}
                      </div>
                    </td>
                    <td className="p-4 relative z-10">
                      <div className="flex flex-wrap gap-2 relative z-10">
                        <button
                          onClick={() => {
                            setSelectedProduct(product);
                            setShowStockModal(true);
                            setStockFormData({
                              type: 'ENTRY',
                              quantity: '',
                              reason: '',
                              newLocation: ''
                            });
                          }}
                          className="rounded-lg bg-gradient-to-r from-green-500 to-green-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:from-green-600 hover:to-green-700 hover:shadow transition-all flex items-center gap-1"
                          title="Stok Ekle"
                        >
                          <span className="text-sm">📦</span>
                          Stok Ekle
                        </button>
                        <button
                          onClick={async () => {
                            try {
                              const edits = productEdits[product.id] || {};
                              const finalLocation = edits.location ?? product.location;
                              const finalStock = edits.stockQuantity ?? product.stockQuantity;
                              const finalPrice = edits.price ?? product.price;

                              console.log('💾 Güncelleniyor:', {
                                productId: product.id,
                                location: finalLocation,
                                stock: finalStock,
                                price: finalPrice
                              });

                              // Yerel DB güncelle
                              const response = await fetch(`/api/products/${product.id}`, {
                                method: 'PUT',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                  stockQuantity: finalStock,
                                  price: finalPrice,
                                  location: finalLocation,
                                }),
                              });

                              if (!response.ok) {
                                throw new Error('Yerel DB güncelleme başarısız');
                              }

                              console.log('✅ Yerel DB güncellendi');

                              // Trendyol'a fiyat ve stok gönder
                              const trendyolMapping = product.mappings.find(m => m.marketplace.name === 'Trendyol');
                              if (trendyolMapping) {
                                console.log('🚀 Trendyol\'a gönderiliyor...');
                                
                                // 1. Fiyat ve stok güncelle
                                const priceStockResponse = await fetch('/api/sync/trendyol-update', {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({
                                    updateType: 'priceAndInventory',
                                    marketplaceId: trendyolMapping.marketplace.id,
                                    updates: [{
                                      sku: trendyolMapping.remoteSku,
                                      quantity: finalStock,
                                      salePrice: parseFloat(finalPrice.toString()),
                                      listPrice: parseFloat(finalPrice.toString()) * 1.1,
                                    }],
                                  }),
                                });

                                if (priceStockResponse.ok) {
                                  console.log('✅ Trendyol fiyat/stok güncellendi');
                                } else {
                                  console.warn('⚠️ Trendyol fiyat/stok güncellenemedi');
                                }

                                // 2. Lokasyon her zaman stockCode olarak Trendyol'a gönder (değişmiş olsun veya olmasın)
                                if (finalLocation) {
                                  console.log('📍 Lokasyon (stockCode) Trendyol\'a gönderiliyor:', {
                                    oldLocation: product.location,
                                    newLocation: finalLocation,
                                    isChanged: finalLocation !== product.location
                                  });
                                  
                                  const locationResponse = await fetch('/api/sync/trendyol-update', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({
                                      updateType: 'products',
                                      marketplaceId: trendyolMapping.marketplace.id,
                                      updates: [{
                                        sku: trendyolMapping.remoteSku,
                                        stockCode: finalLocation,
                                      }],
                                    }),
                                  });

                                  if (locationResponse.ok) {
                                    const locationResult = await locationResponse.json();
                                    console.log('✅ Trendyol lokasyon (stockCode) güncellendi:', locationResult);
                                  } else {
                                    const locationError = await locationResponse.json();
                                    console.error('❌ Trendyol lokasyon güncellenemedi:', locationError);
                                    alert(`⚠️ Lokasyon Trendyol'a gönderilemedi: ${locationError.error || 'Bilinmeyen hata'}`);
                                  }
                                } else {
                                  console.log('ℹ️ Lokasyon boş, Trendyol\'a gönderilmedi');
                                }
                              }

                              // State'i temizle
                              setProductEdits(prev => {
                                const newEdits = { ...prev };
                                delete newEdits[product.id];
                                return newEdits;
                              });

                              console.log('🔄 Ürünler yeniden yükleniyor...');
                              await fetchProducts();
                              console.log('✅ Ürünler yüklendi');
                              alert(`✅ Güncellendi!\n\n📍 Lokasyon: ${finalLocation}\n💰 Fiyat: ${finalPrice}\n📦 Stok: ${finalStock}`);
                            } catch (error) {
                              console.error(error);
                              alert('Hata oluştu');
                            }
                          }}
                          className="rounded bg-blue-600 px-2 py-1 text-xs text-white hover:bg-blue-700"
                        >
                          💾 Güncelle
                        </button>
                        <button
                          onClick={() => viewLogs(product)}
                          className="rounded bg-purple-600 px-2 py-1 text-xs text-white hover:bg-purple-700"
                        >
                          📋 Log
                        </button>
                        <button
                          onClick={() => openMappingModal(product)}
                          className="rounded bg-orange-600 px-2 py-1 text-xs text-white hover:bg-orange-700"
                        >
                          🔗 Eşleştir
                        </button>
                        <button
                          onClick={() => openApiUpdateModal(product)}
                          className="rounded bg-indigo-600 px-2 py-1 text-xs text-white hover:bg-indigo-700"
                        >
                          🔄 API
                        </button>
                        <button
                          onClick={() => handleEdit(product)}
                          className="text-blue-600 hover:text-blue-800 hover:bg-blue-50 text-xs px-2 py-1 rounded transition-colors"
                          title="Düzenle"
                        >
                          ✏️
                        </button>
                        <button
                          onClick={() => handleDelete(product.id)}
                          className="text-red-600 hover:text-red-800 hover:bg-red-50 text-xs px-2 py-1 rounded transition-colors"
                          title="Sil"
                        >
                          🗑️
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <h2 className="mb-4 text-xl font-bold text-gray-900">
              {editingProduct ? 'Ürün Düzenle' : 'Yeni Ürün'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Ürün Adı</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => {
                    const newName = e.target.value;
                    setFormData({ 
                      ...formData, 
                      name: newName,
                      // Otomatik SKU: tire işaretlerini kaldır
                      sku: editingProduct ? formData.sku : newName.replace(/-/g, '')
                    });
                  }}
                  placeholder="Örn: 2135-SİYAH-XL"
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
                />
                <p className="mt-1 text-xs text-gray-500">
                  💡 Tire (-) işaretleri SKU'dan otomatik kaldırılır
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">SKU</label>
                <input
                  type="text"
                  required
                  disabled={!!editingProduct}
                  value={formData.sku}
                  onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none disabled:bg-gray-100"
                  placeholder="Otomatik doldurulur"
                />
                {!editingProduct && (
                  <p className="mt-1 text-xs text-gray-500">
                    ✓ Ürün adından otomatik oluşturuldu
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Stok Miktarı</label>
                <input
                  type="number"
                  required
                  min="0"
                  value={formData.stockQuantity}
                  onChange={(e) => setFormData({ ...formData, stockQuantity: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Fiyat (₺)</label>
                <input
                  type="number"
                  required
                  min="0"
                  step="0.01"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Lokasyon (Depo/Raf)</label>
                <input
                  type="text"
                  placeholder="Örn: A-12, Raf-3, Depo-1"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
                />
                <p className="mt-1 text-xs text-gray-500">İsteğe bağlı: Ürünün fiziksel konumu</p>
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
                >
                  {editingProduct ? 'Güncelle' : 'Oluştur'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50"
                >
                  İptal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Stok Giriş Modal */}
      {showStockModal && selectedProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <h2 className="mb-4 text-xl font-bold text-gray-900">
              Stok Hareketi - {selectedProduct.name}
            </h2>
            <div className="mb-4 rounded-lg bg-gray-50 p-3">
              <p className="text-sm text-gray-600">Mevcut Stok: <span className="font-bold text-gray-900">{selectedProduct.stockQuantity} adet</span></p>
            </div>
            <form onSubmit={handleStockSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Hareket Tipi</label>
                <select
                  value={stockFormData.type}
                  onChange={(e) => setStockFormData({ ...stockFormData, type: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
                >
                  <option value="ENTRY">📦 Stok Girişi</option>
                  <option value="EXIT">📤 Stok Çıkışı</option>
                  <option value="SALE">💰 Satış</option>
                  <option value="RETURN">↩️ İade</option>
                  <option value="CANCEL">❌ İptal</option>
                  <option value="ADJUSTMENT">⚙️ Düzeltme</option>
                  <option value="DAMAGED">⚠️ Hasarlı</option>
                  <option value="TRANSFER">🔄 Transfer</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Miktar {stockFormData.type === 'ADJUSTMENT' && '(Yeni Toplam)'}
                </label>
                <input
                  type="number"
                  required
                  min="0"
                  value={stockFormData.quantity}
                  onChange={(e) => setStockFormData({ ...stockFormData, quantity: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
                />
                {stockFormData.type !== 'ADJUSTMENT' && stockFormData.quantity && (
                  <p className="mt-1 text-xs text-gray-500">
                    Yeni Stok: <span className="font-medium">
                      {['ENTRY', 'RETURN', 'CANCEL'].includes(stockFormData.type)
                        ? selectedProduct.stockQuantity + parseInt(stockFormData.quantity || '0')
                        : selectedProduct.stockQuantity - parseInt(stockFormData.quantity || '0')
                      } adet
                    </span>
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Yeni Lokasyon (İsteğe Bağlı)</label>
                <input
                  type="text"
                  value={stockFormData.newLocation}
                  onChange={(e) => setStockFormData({ ...stockFormData, newLocation: e.target.value })}
                  placeholder="Örn: A-12, Raf-3"
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
                />
                <p className="mt-1 text-xs text-gray-500">
                  💡 Mevcut: <span className="font-medium">{selectedProduct.location || 'Yok'}</span>
                  {stockFormData.newLocation && selectedProduct.location && (
                    <span className="text-green-600"> → Yeni: {selectedProduct.location}-{stockFormData.newLocation}</span>
                  )}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Açıklama / Sebep</label>
                <textarea
                  value={stockFormData.reason}
                  onChange={(e) => setStockFormData({ ...stockFormData, reason: e.target.value })}
                  rows={3}
                  placeholder="İşlem hakkında not ekleyin..."
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  className="flex-1 rounded-lg bg-green-600 px-4 py-2 text-white hover:bg-green-700"
                >
                  Kaydet
                </button>
                <button
                  type="button"
                  onClick={() => setShowStockModal(false)}
                  className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50"
                >
                  İptal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Log Geçmişi Modal */}
      {showLogsModal && selectedProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="w-full max-w-4xl rounded-lg bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">
                Stok Geçmişi - {selectedProduct.name}
              </h2>
              <button
                onClick={() => setShowLogsModal(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>
            <div className="mb-4 rounded-lg bg-blue-50 p-4">
              <div className="flex items-center gap-4 flex-wrap text-sm text-blue-900">
                <div className="flex items-center gap-2">
                  <span className="font-semibold">SKU:</span>
                  <span className="font-mono text-base font-bold bg-white px-3 py-1 rounded border-2 border-blue-300 text-gray-800">
                    {selectedProduct.sku}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold">Mevcut Stok:</span>
                  <span className="font-bold text-base">{selectedProduct.stockQuantity} adet</span>
                </div>
              </div>
            </div>
            {stockLogs.length === 0 ? (
              <div className="py-8 text-center text-gray-500">
                Henüz stok hareketi kaydı bulunmuyor
              </div>
            ) : (
              <div className="space-y-3">
                {stockLogs.map((log) => (
                  <div key={log.id} className="rounded-lg border border-gray-200 bg-white p-4 hover:bg-gray-50">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className={`rounded-full px-3 py-1 text-xs font-medium ${getLogTypeColor(log.type)}`}>
                            {getLogTypeLabel(log.type)}
                          </span>
                          <span className="text-sm text-gray-500">
                            {new Date(log.createdAt).toLocaleString('tr-TR')}
                          </span>
                        </div>
                        <div className="mt-2 flex items-center gap-4 text-sm">
                          <div>
                            <span className="text-gray-600">Miktar:</span>
                            <span className={`ml-1 font-medium ${
                              ['ENTRY', 'RETURN', 'CANCEL'].includes(log.type) 
                                ? 'text-green-600' 
                                : 'text-red-600'
                            }`}>
                              {['ENTRY', 'RETURN', 'CANCEL'].includes(log.type) ? '+' : '-'}
                              {log.quantity}
                            </span>
                          </div>
                          <div>
                            <span className="text-gray-600">Önceki:</span>
                            <span className="ml-1 font-medium text-gray-900">{log.oldStock}</span>
                          </div>
                          <div>
                            <span className="text-gray-600">→</span>
                          </div>
                          <div>
                            <span className="text-gray-600">Yeni:</span>
                            <span className="ml-1 font-medium text-gray-900">{log.newStock}</span>
                          </div>
                        </div>
                        {log.reason && (
                          <p className="mt-2 text-sm text-gray-600">
                            <span className="font-medium">Not:</span> {log.reason}
                          </p>
                        )}
                        {log.order && (
                          <div className="mt-3 p-3 bg-gradient-to-r from-orange-50 to-blue-50 rounded-lg border border-orange-200">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-semibold text-gray-700">📦 Sipariş Kaynağı:</span>
                              <span className="rounded-full bg-orange-500 px-3 py-1 text-xs font-bold text-white shadow-sm">
                                {log.order.marketplace.name}
                              </span>
                              {log.order.marketplace.storeName && (
                                <span className="rounded-full bg-blue-500 px-3 py-1 text-xs font-bold text-white shadow-sm">
                                  🏬 {log.order.marketplace.storeName}
                                </span>
                              )}
                              {log.reference && (
                                <span className="text-xs text-gray-600 font-mono">
                                  #{log.reference}
                                </span>
                              )}
                            </div>
                          </div>
                        )}
                        {log.reference && (
                          <p className="mt-1 text-xs text-gray-500">
                            <span className="font-medium">Referans:</span> {log.reference}
                          </p>
                        )}
                      </div>
                      {log.createdBy && (
                        <div className="ml-4 text-xs text-gray-500">
                          {log.createdBy}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Mapping Modal */}
      {showMappingModal && selectedProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <h2 className="mb-4 text-xl font-bold text-gray-900">
              Pazaryeri Eşleştirmesi - {selectedProduct.name}
            </h2>
            <form onSubmit={handleMappingSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Pazaryeri</label>
                <select
                  required
                  value={mappingFormData.marketplaceId}
                  onChange={(e) => setMappingFormData({ ...mappingFormData, marketplaceId: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
                >
                  <option value="">Seçiniz...</option>
                  {marketplaces
                    .filter(mp => mp.isActive)
                    .map((mp) => (
                      <option key={mp.id} value={mp.id}>
                        {mp.name}{mp.storeName ? ` • ${mp.storeName}` : ''}
                      </option>
                    ))}
                </select>
                <p className="mt-1 text-xs text-gray-500">
                  💡 Sadece aktif pazaryerleri gösteriliyor
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Remote SKU/Barkod</label>
                <input
                  type="text"
                  required
                  value={mappingFormData.remoteSku}
                  onChange={(e) => setMappingFormData({ ...mappingFormData, remoteSku: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
                  placeholder="Pazaryerindeki ürün SKU/barkodu"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Remote Product ID (İsteğe bağlı)</label>
                <input
                  type="text"
                  value={mappingFormData.remoteProductId}
                  onChange={(e) => setMappingFormData({ ...mappingFormData, remoteProductId: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
                  placeholder="Pazaryerindeki ürün ID'si"
                />
              </div>
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="syncStock"
                  checked={mappingFormData.syncStock}
                  onChange={(e) => setMappingFormData({ ...mappingFormData, syncStock: e.target.checked })}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="syncStock" className="ml-2 text-sm text-gray-700">
                  Stok senkronizasyonu aktif
                </label>
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  className="flex-1 rounded-lg bg-orange-600 px-4 py-2 text-white hover:bg-orange-700"
                >
                  Eşleştir
                </button>
                <button
                  type="button"
                  onClick={() => setShowMappingModal(false)}
                  className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50"
                >
                  İptal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Trendyol Detay Modal */}
      {showTrendyolModal && selectedProduct && selectedTrendyolProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-lg bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900">
                📋 Trendyol Ürün Detayları - {selectedProduct.name}
              </h2>
              <button
                onClick={() => setShowTrendyolModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Sol Kolon - Temel Bilgiler */}
              <div className="space-y-4">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h3 className="font-semibold text-gray-900 mb-2">📦 Temel Bilgiler</h3>
                  <div className="space-y-2 text-sm">
                    <div><strong>Barkod:</strong> {selectedTrendyolProduct.barcode}</div>
                    <div><strong>Başlık:</strong> {selectedTrendyolProduct.title}</div>
                    <div><strong>Marka:</strong> {selectedTrendyolProduct.brand || selectedTrendyolProduct.brandName || 'N/A'}</div>
                    <div><strong>Kategori:</strong> {selectedTrendyolProduct.categoryName || 'N/A'}</div>
                    <div><strong>Stok Kodu:</strong> {selectedTrendyolProduct.stockCode || 'N/A'}</div>
                  </div>
                </div>

                <div className="bg-green-50 p-4 rounded-lg">
                  <h3 className="font-semibold text-green-900 mb-2">💰 Fiyat & Stok</h3>
                  <div className="space-y-2 text-sm">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Stok (adet)</label>
                      <input
                        type="number"
                        value={selectedTrendyolProduct.stockQuantity || 0}
                        onChange={(e) => setSelectedTrendyolProduct({...selectedTrendyolProduct, stockQuantity: parseInt(e.target.value)})}
                        className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Satış Fiyatı (₺)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={selectedTrendyolProduct.salePrice || 0}
                        onChange={(e) => setSelectedTrendyolProduct({...selectedTrendyolProduct, salePrice: parseFloat(e.target.value)})}
                        className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Liste Fiyatı (₺)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={selectedTrendyolProduct.listPrice || 0}
                        onChange={(e) => setSelectedTrendyolProduct({...selectedTrendyolProduct, listPrice: parseFloat(e.target.value)})}
                        className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
                      />
                    </div>
                  </div>
                </div>

                <div className="bg-yellow-50 p-4 rounded-lg">
                  <h3 className="font-semibold text-yellow-900 mb-2">📝 Açıklama</h3>
                  <div className="text-sm">
                    <textarea
                      value={selectedTrendyolProduct.description || ''}
                      onChange={(e) => setSelectedTrendyolProduct({...selectedTrendyolProduct, description: e.target.value})}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          const textarea = e.currentTarget;
                          const start = textarea.selectionStart;
                          const end = textarea.selectionEnd;
                          const currentValue = selectedTrendyolProduct.description || '';
                          
                          // Mevcut satırın başında bullet var mı kontrol et
                          const lines = currentValue.substring(0, start).split('\n');
                          const currentLine = lines[lines.length - 1];
                          
                          let newValue;
                          if (currentLine.trim() === '' && lines.length > 1) {
                            // Boş satırda Enter basıldı, bullet ekleme
                            newValue = currentValue.substring(0, start) + '\n' + currentValue.substring(end);
                          } else {
                            // Yeni satıra bullet point ekle
                            newValue = currentValue.substring(0, start) + '\n- ' + currentValue.substring(end);
                          }
                          
                          setSelectedTrendyolProduct({...selectedTrendyolProduct, description: newValue});
                          
                          // Cursor'u yeni pozisyona taşı
                          setTimeout(() => {
                            textarea.selectionStart = textarea.selectionEnd = start + (currentLine.trim() === '' ? 1 : 3);
                          }, 0);
                        }
                      }}
                      rows={6}
                      className="w-full rounded border border-gray-300 px-2 py-1 text-sm font-mono"
                      placeholder="Her satır otomatik olarak bullet point olacak..."
                    />
                    <p className="text-xs text-yellow-700 mt-2">
                      💡 Enter'a basınca otomatik "- " ekler. Kaydetmeden önce HTML'e dönüştürülür.
                    </p>
                  </div>
                </div>
              </div>

              {/* Sağ Kolon - Detay Bilgiler */}
              <div className="space-y-4">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h3 className="font-semibold text-gray-900 mb-2">🏷️ Durum</h3>
                  <div className="space-y-2 text-sm">
                    <div><strong>Onaylanmış:</strong> {selectedTrendyolProduct.approved ? '✅ Evet' : '❌ Hayır'}</div>
                    <div><strong>Satışta:</strong> {selectedTrendyolProduct.onSale ? '✅ Evet' : '❌ Hayır'}</div>
                    <div><strong>Cinsiyet:</strong> {selectedTrendyolProduct.gender || 'N/A'}</div>
                  </div>
                </div>

                {/* Düzenlenebilir Alanlar */}
                <div className="bg-indigo-50 p-4 rounded-lg">
                  <h3 className="font-semibold text-indigo-900 mb-3">✏️ Düzenlenebilir Alanlar</h3>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        📍 Lokasyon (stockCode)
                      </label>
                      <input
                        type="text"
                        value={selectedTrendyolProduct.stockCode || ''}
                        onChange={(e) => setSelectedTrendyolProduct({...selectedTrendyolProduct, stockCode: e.target.value})}
                        className="w-full rounded border border-gray-300 px-2 py-1 text-sm focus:border-indigo-500 focus:outline-none"
                        placeholder="Örn: A-12"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        📦 Desi
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={selectedTrendyolProduct.dimensionalWeight || ''}
                        onChange={(e) => setSelectedTrendyolProduct({...selectedTrendyolProduct, dimensionalWeight: parseFloat(e.target.value)})}
                        className="w-full rounded border border-gray-300 px-2 py-1 text-sm focus:border-indigo-500 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        🚚 Teslimat Süresi (gün)
                      </label>
                      <input
                        type="number"
                        value={selectedTrendyolProduct.deliveryDuration || ''}
                        onChange={(e) => setSelectedTrendyolProduct({...selectedTrendyolProduct, deliveryDuration: parseInt(e.target.value)})}
                        className="w-full rounded border border-gray-300 px-2 py-1 text-sm focus:border-indigo-500 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        📄 KDV Oranı (%)
                      </label>
                      <input
                        type="number"
                        value={selectedTrendyolProduct.vatRate || ''}
                        onChange={(e) => setSelectedTrendyolProduct({...selectedTrendyolProduct, vatRate: parseInt(e.target.value)})}
                        className="w-full rounded border border-gray-300 px-2 py-1 text-sm focus:border-indigo-500 focus:outline-none"
                      />
                    </div>

                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        handleTrendyolLocationUpdate(e as any);
                      }}
                      className="w-full rounded-lg bg-indigo-600 px-4 py-2 text-white text-sm hover:bg-indigo-700"
                    >
                      💾 Tüm Değişiklikleri Kaydet
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setShowTrendyolModal(false)}
                className="rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50"
              >
                Kapat
              </button>
            </div>
          </div>
        </div>
      )}

      {/* API Update Modal */}
      {showApiUpdateModal && selectedProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="w-full max-w-lg rounded-lg bg-white p-6 shadow-xl">
            <h2 className="mb-4 text-xl font-bold text-gray-900">
              API ile Güncelle - {selectedProduct.name}
            </h2>
            <div className="mb-4 rounded-lg bg-blue-50 p-3">
              <p className="text-sm text-blue-900">
                <span className="font-medium">Mevcut Stok:</span> {selectedProduct.stockQuantity} adet<br/>
                <span className="font-medium">Mevcut Fiyat:</span> ₺{selectedProduct.price}<br/>
                <span className="font-medium">Mevcut SKU/Stok Kodu:</span> {selectedProduct.sku}<br/>
                <span className="font-medium">Mevcut Lokasyon:</span> {selectedProduct.location || 'Belirtilmemiş'}<br/>
                <span className="font-medium">Trendyol Eşleştirme:</span> {
                  selectedProduct.mappings.some(m => m.marketplace.name === 'Trendyol' && m.syncStock) 
                    ? '✅ Aktif' 
                    : '❌ Yok'
                }
              </p>
            </div>
            <form onSubmit={handleApiUpdate} className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Yeni Stok Miktarı</label>
                  <input
                    type="number"
                    required
                    min="0"
                    max="20000"
                    value={apiUpdateData.stockQuantity}
                    onChange={(e) => setApiUpdateData({ ...apiUpdateData, stockQuantity: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Maksimum 20.000 adet
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Stok Kodu</label>
                  <input
                    type="text"
                    value={apiUpdateData.stockCode}
                    onChange={(e) => setApiUpdateData({ ...apiUpdateData, stockCode: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
                    placeholder="STK-123"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Trendyol stockCode alanı
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Lokasyon</label>
                  <input
                    type="text"
                    value={apiUpdateData.location}
                    onChange={(e) => setApiUpdateData({ ...apiUpdateData, location: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
                    placeholder="A-12, Raf-3"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Yerel depo konumu (sadece yerel veritabanında tutulur)
                  </p>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Satış Fiyatı (₺)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={apiUpdateData.salePrice}
                    onChange={(e) => setApiUpdateData({ ...apiUpdateData, salePrice: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
                    placeholder="Trendyol satış fiyatı"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Liste Fiyatı (₺)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={apiUpdateData.listPrice}
                    onChange={(e) => setApiUpdateData({ ...apiUpdateData, listPrice: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
                    placeholder="Trendyol liste fiyatı"
                  />
                </div>
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="updateTrendyol"
                  checked={apiUpdateData.updateTrendyol}
                  onChange={(e) => setApiUpdateData({ ...apiUpdateData, updateTrendyol: e.target.checked })}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="updateTrendyol" className="ml-2 text-sm text-gray-700">
                  Trendyol API'sini de güncelle (stok senkronizasyonu aktif ürünler için)
                </label>
              </div>

              <div className="rounded-lg bg-yellow-50 p-3">
                <p className="text-xs text-yellow-800">
                  ⚠️ <strong>Dikkat:</strong> Trendyol API'sine aynı bilgilerle 15 dakika içinde tekrar istek gönderemezsiniz.
                  <br/>• <strong>Stok/Fiyat:</strong> updatePriceAndInventory API'si (basit)
                  <br/>• <strong>Stok Kodu:</strong> updateProducts API'si (zorunlu alanlarla)
                  <br/>• <strong>Lokasyon:</strong> Sadece yerel veritabanında (Trendyol karmaşık)
                </p>
              </div>

              <div className="flex gap-2">
                <button
                  type="submit"
                  className="flex-1 rounded-lg bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700"
                >
                  🔄 API ile Güncelle
                </button>
                <button
                  type="button"
                  onClick={() => setShowApiUpdateModal(false)}
                  className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50"
                >
                  İptal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
