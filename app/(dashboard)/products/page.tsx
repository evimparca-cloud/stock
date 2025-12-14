'use client';

import { useEffect, useState, useMemo } from 'react';
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
  images?: Array<{ url: string }>;
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
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
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

  // ✅ Toplu fiyat güncelleme için state'ler
  const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(new Set());
  const [showBulkUpdateModal, setShowBulkUpdateModal] = useState(false);
  const [bulkUpdateData, setBulkUpdateData] = useState({
    updateType: 'fixed' as 'fixed' | 'percent_increase' | 'percent_decrease',
    value: '',
  });
  const [bulkUpdateLoading, setBulkUpdateLoading] = useState(false);

  // ✅ Gruplama State'leri
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [expandAll, setExpandAll] = useState(false);

  useEffect(() => {
    fetchProducts();
    fetchMarketplaces();
  }, [search]);

  // Gruplama Mantığı
  const groupedProducts = useMemo(() => {
    const groups: Record<string, Product[]> = {};

    if (!products) return {};

    products.forEach(product => {
      // Model kodunu SKU'nun ilk kısmından (tireden önce) veya adından çıkar
      // Örnek: 5524-SIYAH-M -> 5524
      let modelCode = 'Diğer';

      if (product.sku) {
        const parts = product.sku.split('-');
        if (parts.length > 1) {
          modelCode = parts[0];
        } else {
          modelCode = product.sku;
        }
      } else {
        modelCode = product.name.split(' ')[0] || 'Tanımsız';
      }

      if (!groups[modelCode]) {
        groups[modelCode] = [];
      }
      groups[modelCode].push(product);
    });

    // Grupları model adına göre sırala
    return Object.fromEntries(
      Object.entries(groups).sort(([a], [b]) => a.localeCompare(b))
    );
  }, [products]);

  const toggleGroup = (modelCode: string) => {
    setExpandedGroups(prev => {
      const newSet = new Set(prev);
      if (newSet.has(modelCode)) newSet.delete(modelCode);
      else newSet.add(modelCode);
      return newSet;
    });
  };

  const toggleAllGroups = () => {
    if (expandAll) {
      setExpandedGroups(new Set());
    } else {
      setExpandedGroups(new Set(Object.keys(groupedProducts)));
    }
    setExpandAll(!expandAll);
  };

  // Grup Seçimi
  const handleGroupSelection = (modelCode: string, isSelected: boolean) => {
    const groupItems = groupedProducts[modelCode];
    setSelectedProductIds(prev => {
      const newSet = new Set(prev);
      groupItems.forEach(item => {
        if (isSelected) newSet.add(item.id);
        else newSet.delete(item.id);
      });
      return newSet;
    });
  };

  const fetchProducts = async () => {
    try {
      const url = search
        ? `/api/products?search=${encodeURIComponent(search)}&limit=100`
        : '/api/products?limit=100';
      const response = await fetch(url);
      const data = await response.json();
      setProducts(data?.data || (Array.isArray(data) ? data : []));
    } catch (error) {
      console.error('Error fetching products:', error);
      setProducts([]);
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
          finalLocation = `${selectedProduct.location}-${stockFormData.newLocation}`;
        } else {
          finalLocation = stockFormData.newLocation;
        }
      }

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

  const getLogTypeIcon = (type: string) => {
    const icons: Record<string, string> = {
      ENTRY: '📥',
      EXIT: '📤',
      SALE: '🛒',
      RETURN: '↩️',
      CANCEL: '❌',
      ADJUSTMENT: '⚙️',
      DAMAGED: '💔',
      TRANSFER: '🔄',
    };
    return icons[type] || '📦';
  };

  const getLogTypeIconBg = (type: string) => {
    const bgs: Record<string, string> = {
      ENTRY: 'bg-green-100',
      EXIT: 'bg-red-100',
      SALE: 'bg-blue-100',
      RETURN: 'bg-yellow-100',
      CANCEL: 'bg-orange-100',
      ADJUSTMENT: 'bg-purple-100',
      DAMAGED: 'bg-red-200',
      TRANSFER: 'bg-indigo-100',
    };
    return bgs[type] || 'bg-gray-100';
  };

  const formatRelativeDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return 'Bugün';
    } else if (diffDays === 1) {
      return 'Dün';
    } else if (diffDays < 7) {
      return `${diffDays} gün önce`;
    } else {
      return date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
    }
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
      stockCode: product.sku,
    });
    setShowApiUpdateModal(true);
  };

  const openTrendyolDetails = async (product: Product, mapping: any) => {
    try {
      console.log('🔍 Trendyol ürün detayları çekiliyor...', {
        barcode: mapping.remoteSku,
        marketplaceId: mapping.marketplaceId
      });

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

      if (selectedMapping.marketplace.name === 'Trendyol') {
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

      if (apiUpdateData.updateTrendyol && selectedProduct.mappings.length > 0) {
        for (const mapping of selectedProduct.mappings) {
          if (mapping.marketplace.name === 'Trendyol' && mapping.syncStock) {
            try {
              const currentStock = parseInt(apiUpdateData.stockQuantity);
              const needsPriceInventoryUpdate =
                currentStock !== selectedProduct.stockQuantity ||
                (apiUpdateData.salePrice && parseFloat(apiUpdateData.salePrice) !== parseFloat(selectedProduct.price)) ||
                apiUpdateData.listPrice;

              if (needsPriceInventoryUpdate) {
                const priceInventoryPayload: any = {
                  sku: mapping.remoteSku,
                  quantity: currentStock,
                };

                if (apiUpdateData.salePrice) {
                  priceInventoryPayload.salePrice = parseFloat(apiUpdateData.salePrice);
                }
                if (apiUpdateData.listPrice) {
                  priceInventoryPayload.listPrice = parseFloat(apiUpdateData.listPrice);
                }

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
                if (!priceInventoryResult.success) {
                  if (priceInventoryResult.message.includes('15 dakika')) {
                    alert(`⚠️ Trendyol Stok/Fiyat: ${priceInventoryResult.message}`);
                  }
                }
              }

              const productUpdatePayload: any = { sku: mapping.remoteSku };
              let needsProductUpdate = false;

              if (apiUpdateData.stockCode && apiUpdateData.stockCode !== selectedProduct.sku) {
                productUpdatePayload.stockCode = apiUpdateData.stockCode;
                needsProductUpdate = true;
              }

              if (needsProductUpdate) {
                await fetch('/api/sync/trendyol-update', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    marketplaceId: mapping.marketplace.id,
                    updates: [productUpdatePayload],
                    updateType: 'products',
                  }),
                });
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

  const handleBulkUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedProductIds.size === 0) {
      alert('Lütfen en az bir ürün seçin');
      return;
    }

    const value = parseFloat(bulkUpdateData.value);
    if (isNaN(value) || value < 0) {
      alert('Geçerli bir değer girin');
      return;
    }

    const confirmMsg = bulkUpdateData.updateType === 'fixed'
      ? `${selectedProductIds.size} ürünün fiyatı ${value} ₺ olarak güncellenecek.`
      : bulkUpdateData.updateType === 'percent_increase'
        ? `${selectedProductIds.size} ürünün fiyatına %${value} zam yapılacak.`
        : `${selectedProductIds.size} ürünün fiyatından %${value} indirim yapılacak.`;

    if (!confirm(confirmMsg + '\n\nDevam etmek istiyor musunuz?')) return;

    setBulkUpdateLoading(true);
    try {
      const response = await fetch('/api/products/bulk-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productIds: Array.from(selectedProductIds),
          updateType: bulkUpdateData.updateType,
          value: value,
        }),
      });

      const result = await response.json();

      if (result.success) {
        alert(`✅ ${result.message}`);
        setShowBulkUpdateModal(false);
        setSelectedProductIds(new Set());
        setBulkUpdateData({ updateType: 'fixed', value: '' });
        fetchProducts();
      } else {
        alert(`❌ Hata: ${result.error}`);
      }
    } catch (error) {
      console.error('Bulk update error:', error);
      alert('Bir hata oluştu');
    } finally {
      setBulkUpdateLoading(false);
    }
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 lg:p-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 mb-2">
              🏪 Ürünler
            </h1>
            <p className="text-gray-600">
              Toplam {Object.keys(groupedProducts).length} model, {products.length} varyant
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={toggleAllGroups}
              className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-lg transition-colors"
            >
              {expandAll ? '📚 Hepsini Kapat' : '📂 Hepsini Aç'}
            </button>
            <button
              onClick={openNewProductModal}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg shadow-sm transition-colors"
            >
              <span>➕</span>
              Yeni Ürün
            </button>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="mb-6">
        <div className="relative max-w-md">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <span className="text-gray-400">🔍</span>
          </div>
          <input
            type="text"
            placeholder="Ürün adı veya SKU ile ara..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
          />
        </div>
      </div>

      {/* Toplu Güncelleme Bar */}
      {selectedProductIds.size > 0 && (
        <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-blue-600 font-medium">📦 {selectedProductIds.size} ürün seçildi</span>
            <button
              onClick={() => setSelectedProductIds(new Set())}
              className="text-xs text-blue-500 hover:text-blue-700 underline"
            >
              Seçimi temizle
            </button>
          </div>
          <button
            onClick={() => setShowBulkUpdateModal(true)}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-lg transition-colors"
          >
            💰 Toplu Fiyat Güncelle
          </button>
        </div>
      )}

      {/* Grouped Products List */}
      <div className="space-y-4">
        {Object.entries(groupedProducts).length === 0 ? (
          <div className="bg-white rounded-lg p-12 text-center text-gray-500 shadow-sm border">
            <span className="text-4xl block mb-2">📦</span>
            <p>Henüz ürün bulunmuyor</p>
          </div>
        ) : (
          Object.entries(groupedProducts).map(([modelCode, items]) => {
            const isExpanded = expandedGroups.has(modelCode);
            const totalStock = items.reduce((sum, item) => sum + item.stockQuantity, 0);
            const priceRange = items.length > 1
              ? `${Math.min(...items.map(i => parseFloat(i.price)))} - ${Math.max(...items.map(i => parseFloat(i.price)))} ₺`
              : `${items[0].price} ₺`;
            const firstImage = items.find(i => i.images && i.images.length > 0)?.images?.[0]?.url;
            const modelName = items[0].name.split('-').slice(1).join(' ') || items[0].name;

            // Grup seçimi durumu
            const allSelected = items.every(item => selectedProductIds.has(item.id));
            const someSelected = items.some(item => selectedProductIds.has(item.id));

            return (
              <div key={modelCode} className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                {/* Accordion Header */}
                <div
                  className={`p-4 flex items-center justify-between cursor-pointer hover:bg-gray-50 transition-colors ${isExpanded ? 'bg-gray-50 border-b border-gray-200' : ''}`}
                  onClick={() => toggleGroup(modelCode)}
                >
                  <div className="flex items-center gap-4 flex-1">
                    {/* Grup Checkbox */}
                    <div onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={allSelected}
                        ref={(input) => {
                          if (input) input.indeterminate = someSelected && !allSelected;
                        }}
                        onChange={(e) => handleGroupSelection(modelCode, e.target.checked)}
                        className="w-5 h-5 text-blue-600 rounded border-gray-300 focus:ring-blue-500 cursor-pointer"
                      />
                    </div>

                    <div className="w-8 flex justify-center text-gray-400">
                      {isExpanded ? '▼' : '▶'}
                    </div>

                    {/* Image */}
                    {firstImage ? (
                      <img
                        src={`/api/proxy-image?url=${encodeURIComponent(firstImage)}`}
                        alt={modelName}
                        className="h-12 w-12 rounded bg-gray-100 object-cover border"
                      />
                    ) : (
                      <div className="h-12 w-12 rounded bg-gray-100 flex items-center justify-center text-gray-400 text-xl border">
                        📦
                      </div>
                    )}

                    {/* Info */}
                    <div>
                      <h3 className="font-bold text-gray-900 text-lg flex items-center gap-2">
                        {modelCode}
                        <span className="text-sm font-normal text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                          {items.length} Varyant
                        </span>
                      </h3>
                      <p className="text-sm text-gray-600">{modelName}</p>
                    </div>
                  </div>

                  {/* Summary Stats */}
                  <div className="flex items-center gap-8 mr-4 text-sm text-gray-600">
                    <div className="text-right">
                      <div className="text-xs text-gray-500">Toplam Stok</div>
                      <div className={`font-bold text-lg ${totalStock === 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {totalStock} adet
                      </div>
                    </div>
                    <div className="text-right hidden sm:block">
                      <div className="text-xs text-gray-500">Fiyat</div>
                      <div className="font-medium text-gray-900">{priceRange}</div>
                    </div>
                  </div>
                </div>

                {/* Accordion Body (Original Table Structure) */}
                {isExpanded && (
                  <div className="overflow-x-auto border-t border-gray-100 bg-gray-50/50 p-2">
                    <table className="min-w-full divide-y divide-gray-200 bg-white rounded-lg shadow-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="w-10 px-2 py-3"></th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">SKU</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tam Adı</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Lokasyon</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Stok</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fiyat</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Pazaryerleri</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">İşlemler</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {items.map((product) => (
                          <tr key={product.id} className="hover:bg-blue-50 transition-colors">
                            <td className="px-2 py-4 text-center">
                              <input
                                type="checkbox"
                                checked={selectedProductIds.has(product.id)}
                                onChange={(e) => {
                                  const newSet = new Set(selectedProductIds);
                                  if (e.target.checked) newSet.add(product.id);
                                  else newSet.delete(product.id);
                                  setSelectedProductIds(newSet);
                                }}
                                className="w-4 h-4 text-blue-600 rounded border-gray-300"
                              />
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap">
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                {product.sku}
                              </span>
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap">
                              <div className="text-sm font-medium text-gray-900">{product.name}</div>
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap">
                              <input
                                type="text"
                                value={productEdits[product.id]?.location ?? product.location ?? ''}
                                onChange={(e) => {
                                  setProductEdits(prev => ({
                                    ...prev,
                                    [product.id]: { ...prev[product.id], location: e.target.value }
                                  }));
                                }}
                                className="w-20 px-2 py-1 text-sm border border-gray-300 rounded focus:border-blue-500"
                                placeholder="A-12"
                              />
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap">
                              <input
                                type="number"
                                value={productEdits[product.id]?.stockQuantity ?? product.stockQuantity}
                                onChange={(e) => {
                                  setProductEdits(prev => ({
                                    ...prev,
                                    [product.id]: { ...prev[product.id], stockQuantity: parseInt(e.target.value) || 0 }
                                  }));
                                }}
                                className="w-16 px-2 py-1 text-sm border border-gray-300 rounded focus:border-blue-500"
                              />
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap">
                              <input
                                type="number"
                                step="0.01"
                                value={productEdits[product.id]?.price ?? product.price}
                                onChange={(e) => {
                                  setProductEdits(prev => ({
                                    ...prev,
                                    [product.id]: { ...prev[product.id], price: e.target.value }
                                  }));
                                }}
                                className="w-20 px-2 py-1 text-sm border border-gray-300 rounded focus:border-blue-500"
                              />
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-900">
                              <div className="flex flex-wrap gap-1">
                                {product.mappings.map((mapping) => (
                                  <div key={mapping.id} className="flex items-center gap-1">
                                    <span className="inline-flex flex-col gap-0.5 px-2 py-1 rounded-lg text-xs font-medium bg-blue-100 text-blue-800">
                                      <div className="flex items-center gap-1">
                                        {mapping.marketplace.name}
                                        {mapping.syncStock && <span>🔄</span>}
                                      </div>
                                    </span>
                                    {mapping.marketplace.name === 'Trendyol' && (
                                      <button
                                        onClick={() => openTrendyolDetails(product, mapping)}
                                        className="px-1.5 py-0.5 bg-blue-600 hover:bg-blue-700 text-white text-[10px] rounded"
                                      >
                                        📋
                                      </button>
                                    )}
                                    <button
                                      onClick={() => handleDeleteMapping(mapping.id)}
                                      className="px-1.5 py-0.5 bg-red-600 hover:bg-red-700 text-white text-[10px] rounded"
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
                                    setStockFormData({ type: 'ENTRY', quantity: '', reason: '', newLocation: '' });
                                  }}
                                  className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700 flex items-center gap-1"
                                >
                                  📦 Stok Ekle
                                </button>
                                <button
                                  onClick={async () => {
                                    try {
                                      const edits = productEdits[product.id] || {};
                                      const finalLocation = edits.location ?? product.location;
                                      const finalStock = edits.stockQuantity ?? product.stockQuantity;
                                      const finalPrice = edits.price ?? product.price;

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

                                      if (!response.ok) throw new Error('Güncelleme başarısız');

                                      // Trendyol Güncelleme (Basitleştirilmiş)
                                      const trendyolMapping = product.mappings.find(m => m.marketplace.name === 'Trendyol');
                                      if (trendyolMapping) {
                                        await fetch('/api/sync/trendyol-update', {
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

                                        if (finalLocation) {
                                          await fetch('/api/sync/trendyol-update', {
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
                                        }
                                      }

                                      setProductEdits(prev => {
                                        const newEdits = { ...prev };
                                        delete newEdits[product.id];
                                        return newEdits;
                                      });
                                      fetchProducts();
                                      alert('✅ Güncellendi!');
                                    } catch (error) {
                                      alert('Hata oluştu');
                                    }
                                  }}
                                  className="rounded bg-blue-600 px-2 py-1 text-xs text-white hover:bg-blue-700"
                                >
                                  💾 Güncelle
                                </button>
                                <button onClick={() => viewLogs(product)} className="rounded bg-purple-600 px-2 py-1 text-xs text-white">📋 Log</button>
                                <button onClick={() => openMappingModal(product)} className="rounded bg-orange-600 px-2 py-1 text-xs text-white">🔗 Eşleştir</button>
                                <button onClick={() => openApiUpdateModal(product)} className="rounded bg-indigo-600 px-2 py-1 text-xs text-white">🔄 API</button>
                                <button onClick={() => handleEdit(product)} className="text-blue-600 px-2 py-1" title="Düzenle">✏️</button>
                                <button onClick={() => handleDelete(product.id)} className="text-red-600 px-2 py-1" title="Sil">🗑️</button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* MODALS */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <h2 className="mb-4 text-xl font-bold text-gray-900">{editingProduct ? 'Ürün Düzenle' : 'Yeni Ürün'}</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Ürün Adı</label>
                <input type="text" required value={formData.name} onChange={(e) => { const newName = e.target.value; setFormData({ ...formData, name: newName, sku: editingProduct ? formData.sku : newName.replace(/-/g, '') }); }} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">SKU</label>
                <input type="text" required disabled={!!editingProduct} value={formData.sku} onChange={(e) => setFormData({ ...formData, sku: e.target.value })} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 disabled:bg-gray-100" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Stok</label>
                <input type="number" required min="0" value={formData.stockQuantity} onChange={(e) => setFormData({ ...formData, stockQuantity: e.target.value })} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Fiyat</label>
                <input type="number" required min="0" step="0.01" value={formData.price} onChange={(e) => setFormData({ ...formData, price: e.target.value })} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Lokasyon</label>
                <input type="text" value={formData.location} onChange={(e) => setFormData({ ...formData, location: e.target.value })} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2" />
              </div>
              <div className="flex gap-2">
                <button type="submit" className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-white">{editingProduct ? 'Güncelle' : 'Oluştur'}</button>
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 rounded-lg border border-gray-300 px-4 py-2">İptal</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showStockModal && selectedProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900">Stok Hareketi</h2>
              <button onClick={() => setShowStockModal(false)} className="text-gray-400 hover:text-gray-600 text-2xl">×</button>
            </div>

            {/* Ürün Bilgisi */}
            <div className="bg-gray-50 rounded-lg p-3 mb-4">
              <p className="font-medium text-gray-900">{selectedProduct.name}</p>
              <div className="flex items-center gap-4 mt-1 text-sm text-gray-600">
                <span>📦 Mevcut Stok: <strong className="text-blue-600">{selectedProduct.stockQuantity}</strong></span>
                {selectedProduct.location && (
                  <span>📍 Lokasyon: <strong>{selectedProduct.location}</strong></span>
                )}
              </div>
            </div>

            <form onSubmit={handleStockSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">İşlem Türü</label>
                <select
                  value={stockFormData.type}
                  onChange={(e) => setStockFormData({ ...stockFormData, type: e.target.value })}
                  className="w-full border border-gray-300 p-2.5 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="ENTRY">📥 Stok Girişi</option>
                  <option value="EXIT">📤 Stok Çıkışı</option>
                  <option value="SALE">🛒 Satış</option>
                  <option value="RETURN">↩️ İade</option>
                  <option value="ADJUSTMENT">⚙️ Düzeltme</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Miktar
                  <span className="text-gray-400 font-normal ml-2">(Mevcut: {selectedProduct.stockQuantity})</span>
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  placeholder={`Miktar girin (Mevcut: ${selectedProduct.stockQuantity})`}
                  value={stockFormData.quantity}
                  onChange={(e) => setStockFormData({ ...stockFormData, quantity: e.target.value })}
                  className="w-full border border-gray-300 p-2.5 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Yeni Lokasyon (Opsiyonel)</label>
                <input
                  type="text"
                  placeholder="Örn: B-15"
                  value={stockFormData.newLocation}
                  onChange={(e) => setStockFormData({ ...stockFormData, newLocation: e.target.value })}
                  className="w-full border border-gray-300 p-2.5 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                {/* Lokasyon Önizleme */}
                {stockFormData.newLocation && (
                  <div className="mt-2 p-2 bg-blue-50 rounded-lg border border-blue-200">
                    <p className="text-sm text-blue-800">
                      📍 Yeni lokasyon: <strong>
                        {selectedProduct.location
                          ? `${selectedProduct.location}-${stockFormData.newLocation}`
                          : stockFormData.newLocation
                        }
                      </strong>
                    </p>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Açıklama</label>
                <textarea
                  placeholder="İşlem açıklaması..."
                  value={stockFormData.reason}
                  onChange={(e) => setStockFormData({ ...stockFormData, reason: e.target.value })}
                  className="w-full border border-gray-300 p-2.5 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                  rows={2}
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button type="submit" className="flex-1 bg-green-600 hover:bg-green-700 text-white p-2.5 rounded-lg font-medium transition">
                  ✓ Kaydet
                </button>
                <button type="button" onClick={() => setShowStockModal(false)} className="flex-1 border border-gray-300 p-2.5 rounded-lg hover:bg-gray-50 transition">
                  İptal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showLogsModal && selectedProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-2xl max-h-[90vh] overflow-hidden bg-white rounded-2xl shadow-2xl">
            {/* Header */}
            <div className="bg-gradient-to-r from-purple-600 to-indigo-600 p-4 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold">📋 Stok Hareketleri</h2>
                  <p className="text-purple-200 text-sm mt-1">{selectedProduct.name}</p>
                </div>
                <button
                  onClick={() => setShowLogsModal(false)}
                  className="p-2 hover:bg-white/20 rounded-full transition"
                >
                  <span className="text-2xl">×</span>
                </button>
              </div>
            </div>

            {/* Logs Timeline */}
            <div className="overflow-y-auto max-h-[70vh] p-4">
              <div className="space-y-3">
                {stockLogs.map((log) => (
                  <div
                    key={log.id}
                    className="bg-gradient-to-r from-gray-50 to-white rounded-xl p-4 border border-gray-100 shadow-sm hover:shadow-md transition"
                  >
                    <div className="flex items-start justify-between gap-4">
                      {/* Sol - İkon ve Bilgi */}
                      <div className="flex items-start gap-3">
                        {/* Tip İkonu */}
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg shrink-0 ${getLogTypeIconBg(log.type)}`}>
                          {getLogTypeIcon(log.type)}
                        </div>

                        {/* Detaylar */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${getLogTypeColor(log.type)}`}>
                              {getLogTypeLabel(log.type)}
                            </span>
                            <span className="font-bold text-gray-900">
                              {log.type === 'ENTRY' || log.type === 'RETURN' || log.type === 'CANCEL' ? '+' : '-'}{Math.abs(log.quantity)} adet
                            </span>
                          </div>

                          {/* Pazaryeri Bilgisi */}
                          {log.order?.marketplace && (
                            <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                              <span className="text-sm text-gray-600">
                                🏪 {log.order.marketplace.name}
                                {log.order.marketplace.storeName && ` - ${log.order.marketplace.storeName}`}
                              </span>
                              <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
                                #{log.order.marketplaceOrderId?.slice(-8)}
                              </span>
                            </div>
                          )}

                          {/* Manuel işlem göstergesi */}
                          {!log.order && log.createdBy && (
                            <div className="flex items-center gap-1.5 mt-2">
                              <span className="text-sm text-gray-500">
                                👤 {log.createdBy}
                              </span>
                            </div>
                          )}

                          {/* İptal/İade Sebebi */}
                          {log.reason && (
                            <p className="text-sm text-gray-600 mt-1.5 bg-gray-50 px-2 py-1 rounded">
                              💬 {log.reason}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Sağ - Tarih */}
                      <div className="text-right shrink-0">
                        <div className="text-sm font-medium text-gray-700">
                          {formatRelativeDate(log.createdAt)}
                        </div>
                        <div className="text-xs text-gray-400 mt-0.5">
                          {new Date(log.createdAt).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                    </div>

                    {/* Stok Değişimi */}
                    <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-100 text-xs">
                      <span className="text-gray-500">Stok:</span>
                      <span className="font-mono bg-gray-100 px-2 py-0.5 rounded">{log.oldStock}</span>
                      <span className="text-gray-400">→</span>
                      <span className={`font-mono px-2 py-0.5 rounded ${log.newStock >= log.oldStock ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {log.newStock}
                      </span>
                    </div>
                  </div>
                ))}

                {stockLogs.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    <span className="text-4xl">📭</span>
                    <p className="mt-2">Henüz stok hareketi yok</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {showMappingModal && selectedProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="w-full max-w-md bg-white p-6 rounded-lg">
            <h2 className="text-xl font-bold mb-4">Eşleştirme</h2>
            <form onSubmit={handleMappingSubmit} className="space-y-4">
              <select required value={mappingFormData.marketplaceId} onChange={e => setMappingFormData({ ...mappingFormData, marketplaceId: e.target.value })} className="w-full border p-2 rounded">
                <option value="">Pazaryeri Seç</option>
                {marketplaces.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
              <input required placeholder="Remote SKU" value={mappingFormData.remoteSku} onChange={e => setMappingFormData({ ...mappingFormData, remoteSku: e.target.value })} className="w-full border p-2 rounded" />
              <div className="flex gap-2"><button type="submit" className="flex-1 bg-orange-600 text-white p-2 rounded">Eşleştir</button><button type="button" onClick={() => setShowMappingModal(false)} className="flex-1 border p-2 rounded">İptal</button></div>
            </form>
          </div>
        </div>
      )}

      {showBulkUpdateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="w-full max-w-md bg-white p-6 rounded-lg">
            <h2 className="text-xl font-bold mb-4">Toplu Güncelleme ({selectedProductIds.size} ürün)</h2>
            <div className="space-y-4">
              <select value={bulkUpdateData.updateType} onChange={e => setBulkUpdateData({ ...bulkUpdateData, updateType: e.target.value as any })} className="w-full border p-2 rounded">
                <option value="fixed">Sabit Fiyat</option>
                <option value="percent_increase">Yüzde Zam</option>
                <option value="percent_decrease">Yüzde İndirim</option>
              </select>
              <input type="number" placeholder="Değer" value={bulkUpdateData.value} onChange={e => setBulkUpdateData({ ...bulkUpdateData, value: e.target.value })} className="w-full border p-2 rounded" />
              <div className="flex gap-2">
                <button onClick={handleBulkUpdate} className="flex-1 bg-blue-600 text-white p-2 rounded">Güncelle</button>
                <button onClick={() => setShowBulkUpdateModal(false)} className="flex-1 border p-2 rounded">İptal</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Trendyol & Api Update Modals omitted for brevity but logic preserved in memory - if needed I can add them fully but they are huge */}
      {showApiUpdateModal && selectedProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="w-full max-w-lg rounded-lg bg-white p-6 shadow-xl">
            <h2 className="mb-4 text-xl font-bold text-gray-900">
              API ile Güncelle - {selectedProduct.name}
            </h2>
            <div className="mb-4 rounded-lg bg-blue-50 p-3">
              <p className="text-sm text-blue-900">
                <span className="font-medium">Mevcut Stok:</span> {selectedProduct.stockQuantity} adet<br />
                <span className="font-medium">Mevcut Fiyat:</span> ₺{selectedProduct.price}<br />
                <span className="font-medium">Mevcut SKU/Stok Kodu:</span> {selectedProduct.sku}<br />
                <span className="font-medium">Mevcut Lokasyon:</span> {selectedProduct.location || 'Belirtilmemiş'}<br />
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
                  <br />• <strong>Stok/Fiyat:</strong> updatePriceAndInventory API'si (basit)
                  <br />• <strong>Stok Kodu:</strong> updateProducts API'si (zorunlu alanlarla)
                  <br />• <strong>Lokasyon:</strong> Sadece yerel veritabanında (Trendyol karmaşık)
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
                        onChange={(e) => setSelectedTrendyolProduct({ ...selectedTrendyolProduct, stockQuantity: parseInt(e.target.value) })}
                        className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Satış Fiyatı (₺)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={selectedTrendyolProduct.salePrice || 0}
                        onChange={(e) => setSelectedTrendyolProduct({ ...selectedTrendyolProduct, salePrice: parseFloat(e.target.value) })}
                        className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Liste Fiyatı (₺)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={selectedTrendyolProduct.listPrice || 0}
                        onChange={(e) => setSelectedTrendyolProduct({ ...selectedTrendyolProduct, listPrice: parseFloat(e.target.value) })}
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
                      onChange={(e) => setSelectedTrendyolProduct({ ...selectedTrendyolProduct, description: e.target.value })}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          const textarea = e.currentTarget;
                          const start = textarea.selectionStart;
                          const end = textarea.selectionEnd;
                          const currentValue = selectedTrendyolProduct.description || '';
                          const lines = currentValue.substring(0, start).split('\n');
                          const currentLine = lines[lines.length - 1];
                          let newValue;
                          if (currentLine.trim() === '' && lines.length > 1) {
                            newValue = currentValue.substring(0, start) + '\n' + currentValue.substring(end);
                          } else {
                            newValue = currentValue.substring(0, start) + '\n- ' + currentValue.substring(end);
                          }
                          setSelectedTrendyolProduct({ ...selectedTrendyolProduct, description: newValue });
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
                        onChange={(e) => setSelectedTrendyolProduct({ ...selectedTrendyolProduct, stockCode: e.target.value })}
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
                        onChange={(e) => setSelectedTrendyolProduct({ ...selectedTrendyolProduct, dimensionalWeight: parseFloat(e.target.value) })}
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
                        onChange={(e) => setSelectedTrendyolProduct({ ...selectedTrendyolProduct, deliveryDuration: parseInt(e.target.value) })}
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
                        onChange={(e) => setSelectedTrendyolProduct({ ...selectedTrendyolProduct, vatRate: parseInt(e.target.value) })}
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

    </div>
  );
}
