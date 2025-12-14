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
    };
  }>;
}

export default function ModernProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);

  useEffect(() => {
    fetchProducts();
  }, [search]);

  const fetchProducts = async () => {
    try {
      const url = search 
        ? `/api/products?search=${encodeURIComponent(search)}&limit=100`
        : '/api/products?limit=100';
      const response = await fetch(url);
      const data = await response.json();
      setProducts(data.data);
    } catch (error) {
      console.error('Error fetching products:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateProduct = async (productId: string, updates: any) => {
    try {
      const response = await fetch(`/api/products/${productId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      
      if (response.ok) {
        fetchProducts();
        setShowEditModal(false);
      }
    } catch (error) {
      console.error('Error updating product:', error);
    }
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-4 md:p-6 lg:p-8">
      {/* Modern Header */}
      <div className="mb-6 md:mb-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              Ürünler
            </h1>
            <p className="mt-2 text-sm md:text-base text-gray-600">
              {products.length} ürün yönetiliyor
            </p>
          </div>
          
          {/* Desktop Action Buttons */}
          <div className="flex gap-3">
            <button className="flex-1 md:flex-none bg-white border-2 border-gray-200 hover:border-blue-500 text-gray-700 px-4 py-2 md:px-6 md:py-3 rounded-xl font-semibold transition-all duration-200 hover:shadow-lg">
              📤 Dışa Aktar
            </button>
            <button className="flex-1 md:flex-none bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-4 py-2 md:px-6 md:py-3 rounded-xl font-semibold transition-all duration-200 hover:shadow-lg">
              ➕ Yeni Ürün
            </button>
          </div>
        </div>
      </div>

      {/* Search and Filter Bar */}
      <div className="mb-6 bg-white rounded-2xl shadow-sm border border-gray-200 p-4">
        <div className="flex flex-col md:flex-row gap-3">
          {/* Search */}
          <div className="flex-1 relative">
            <input
              type="text"
              placeholder="🔍 Ürün adı, SKU veya lokasyon ara..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full px-4 py-3 pl-12 rounded-xl border-2 border-gray-200 focus:border-blue-500 focus:outline-none transition-all"
            />
            <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>

          {/* View Toggle */}
          <div className="flex gap-2 bg-gray-100 p-1 rounded-xl">
            <button
              onClick={() => setViewMode('grid')}
              className={`flex-1 md:w-auto px-4 py-2 rounded-lg font-medium transition-all ${
                viewMode === 'grid'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <span className="hidden md:inline">📊 Kart</span>
              <span className="md:hidden">📊</span>
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`flex-1 md:w-auto px-4 py-2 rounded-lg font-medium transition-all ${
                viewMode === 'list'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <span className="hidden md:inline">📋 Liste</span>
              <span className="md:hidden">📋</span>
            </button>
          </div>
        </div>
      </div>

      {/* Products Display */}
      {products.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-12 text-center">
          <div className="text-6xl mb-4">📦</div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">Ürün Bulunamadı</h3>
          <p className="text-gray-600">Arama kriterlerinize uygun ürün yok</p>
        </div>
      ) : viewMode === 'grid' ? (
        /* Grid View - Responsive Cards */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
          {products.map((product) => (
            <div
              key={product.id}
              className="group bg-white rounded-2xl shadow-sm hover:shadow-xl border border-gray-200 hover:border-blue-300 transition-all duration-300 overflow-hidden cursor-pointer"
              onClick={() => {
                setSelectedProduct(product);
                setShowEditModal(true);
              }}
            >
              {/* Card Header */}
              <div className="bg-gradient-to-r from-blue-50 to-purple-50 p-4 border-b border-gray-100">
                <div className="flex items-start justify-between mb-2">
                  <span className="px-3 py-1 bg-white rounded-lg text-xs font-mono text-gray-600 border border-gray-200">
                    {product.sku}
                  </span>
                  <span className={`px-3 py-1 rounded-lg text-xs font-bold ${
                    product.stockQuantity > 10
                      ? 'bg-green-100 text-green-700'
                      : product.stockQuantity > 0
                      ? 'bg-yellow-100 text-yellow-700'
                      : 'bg-red-100 text-red-700'
                  }`}>
                    {product.stockQuantity} adet
                  </span>
                </div>
                <h3 className="font-semibold text-gray-900 line-clamp-2 group-hover:text-blue-600 transition-colors">
                  {product.name}
                </h3>
              </div>

              {/* Card Body */}
              <div className="p-4 space-y-3">
                {/* Price */}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Fiyat</span>
                  <span className="text-lg font-bold text-gray-900">
                    ₺{parseFloat(product.price).toFixed(2)}
                  </span>
                </div>

                {/* Location */}
                {product.location && (
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-gray-600">📍</span>
                    <span className="font-medium text-gray-900">{product.location}</span>
                  </div>
                )}

                {/* Marketplaces */}
                {product.mappings.length > 0 && (
                  <div className="pt-3 border-t border-gray-100">
                    <div className="flex flex-wrap gap-2">
                      {product.mappings.map((mapping) => (
                        <span
                          key={mapping.id}
                          className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-700 rounded-lg text-xs font-medium border border-blue-200"
                        >
                          {mapping.marketplace.name}
                          {mapping.syncStock && <span className="text-blue-500">🔄</span>}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Card Footer */}
              <div className="px-4 pb-4 flex gap-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    // Quick edit
                  }}
                  className="flex-1 py-2 bg-gray-50 hover:bg-gray-100 text-gray-700 rounded-lg text-sm font-medium transition-colors"
                >
                  ✏️ Düzenle
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    // View logs
                  }}
                  className="flex-1 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-sm font-medium transition-colors"
                >
                  📝 Log
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* List View - Mobile Optimized */
        <div className="space-y-3">
          {products.map((product) => (
            <div
              key={product.id}
              className="bg-white rounded-xl shadow-sm hover:shadow-md border border-gray-200 hover:border-blue-300 transition-all duration-200 overflow-hidden"
            >
              <div className="p-4">
                <div className="flex items-start gap-3">
                  {/* Left: Stock Badge */}
                  <div className={`flex-shrink-0 w-14 h-14 rounded-xl flex items-center justify-center font-bold text-sm ${
                    product.stockQuantity > 10
                      ? 'bg-green-100 text-green-700'
                      : product.stockQuantity > 0
                      ? 'bg-yellow-100 text-yellow-700'
                      : 'bg-red-100 text-red-700'
                  }`}>
                    {product.stockQuantity}
                  </div>

                  {/* Middle: Product Info */}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-900 truncate mb-1">
                      {product.name}
                    </h3>
                    <div className="flex flex-wrap items-center gap-2 text-sm text-gray-600 mb-2">
                      <span className="font-mono bg-gray-100 px-2 py-0.5 rounded">
                        {product.sku}
                      </span>
                      {product.location && (
                        <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded">
                          📍 {product.location}
                        </span>
                      )}
                    </div>
                    {product.mappings.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {product.mappings.map((mapping) => (
                          <span
                            key={mapping.id}
                            className="text-xs bg-purple-50 text-purple-700 px-2 py-0.5 rounded"
                          >
                            {mapping.marketplace.name}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Right: Price & Actions */}
                  <div className="flex-shrink-0 text-right">
                    <div className="text-lg font-bold text-gray-900 mb-2">
                      ₺{parseFloat(product.price).toFixed(2)}
                    </div>
                    <div className="flex gap-1">
                      <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                        ✏️
                      </button>
                      <button className="p-2 hover:bg-blue-50 rounded-lg transition-colors">
                        📝
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Edit Modal - Full Screen on Mobile */}
      {showEditModal && selectedProduct && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end md:items-center justify-center p-0 md:p-4">
          <div className="bg-white w-full md:max-w-2xl md:rounded-2xl rounded-t-3xl max-h-[90vh] md:max-h-[85vh] flex flex-col overflow-hidden animate-slide-up">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 md:p-6 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-purple-50">
              <h2 className="text-xl md:text-2xl font-bold text-gray-900">
                Ürün Detayı
              </h2>
              <button
                onClick={() => setShowEditModal(false)}
                className="p-2 hover:bg-white rounded-xl transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Modal Body - Scrollable */}
            <div className="flex-1 overflow-y-auto p-4 md:p-6">
              <div className="space-y-4">
                {/* Product Info */}
                <div className="bg-gray-50 rounded-xl p-4">
                  <h3 className="font-semibold text-gray-900 mb-2">{selectedProduct.name}</h3>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-gray-600">SKU:</span>
                      <span className="ml-2 font-mono font-medium">{selectedProduct.sku}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Stok:</span>
                      <span className="ml-2 font-bold">{selectedProduct.stockQuantity}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Fiyat:</span>
                      <span className="ml-2 font-bold">₺{selectedProduct.price}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Lokasyon:</span>
                      <span className="ml-2 font-medium">{selectedProduct.location || '-'}</span>
                    </div>
                  </div>
                </div>

                {/* Quick Actions */}
                <div className="grid grid-cols-2 gap-3">
                  <button className="py-3 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl font-semibold transition-colors">
                    ✏️ Düzenle
                  </button>
                  <button className="py-3 bg-green-50 hover:bg-green-100 text-green-700 rounded-xl font-semibold transition-colors">
                    📝 Stok Log
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes slide-up {
          from {
            transform: translateY(100%);
          }
          to {
            transform: translateY(0);
          }
        }
        .animate-slide-up {
          animation: slide-up 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}
