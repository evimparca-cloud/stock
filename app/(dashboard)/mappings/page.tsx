'use client';

import { useEffect, useState } from 'react';
import LoadingSpinner from '@/components/LoadingSpinner';

interface Product {
  id: string;
  sku: string;
  name: string;
}

interface Marketplace {
  id: string;
  name: string;
  storeName?: string | null;
  isActive: boolean;
}

interface Mapping {
  id: string;
  remoteSku: string;
  remoteProductId: string | null;
  syncStock: boolean;
  product: Product;
  marketplace: Marketplace;
}

export default function MappingsPage() {
  const [mappings, setMappings] = useState<Mapping[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [marketplaces, setMarketplaces] = useState<Marketplace[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingMapping, setEditingMapping] = useState<Mapping | null>(null);
  const [formData, setFormData] = useState({
    productId: '',
    marketplaceId: '',
    remoteSku: '',
    remoteProductId: '',
    syncStock: true,
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [mappingsRes, productsRes, marketplacesRes] = await Promise.all([
        fetch('/api/mappings'),
        fetch('/api/products?limit=1000'),
        fetch('/api/marketplaces'),
      ]);

      const mappingsData = await mappingsRes.json();
      const productsData = await productsRes.json();
      const marketplacesData = await marketplacesRes.json();

      setMappings(mappingsData);
      setProducts(productsData.data);
      setMarketplaces(marketplacesData);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const url = editingMapping ? `/api/mappings/${editingMapping.id}` : '/api/mappings';
      const method = editingMapping ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        setShowModal(false);
        setEditingMapping(null);
        setFormData({
          productId: '',
          marketplaceId: '',
          remoteSku: '',
          remoteProductId: '',
          syncStock: true,
        });
        fetchData();
      } else {
        const error = await response.json();
        alert(error.error || 'Bir hata oluştu');
      }
    } catch (error) {
      console.error('Error saving mapping:', error);
      alert('Bir hata oluştu');
    }
  };

  const handleEdit = (mapping: Mapping) => {
    setEditingMapping(mapping);
    setFormData({
      productId: mapping.product.id,
      marketplaceId: mapping.marketplace.id,
      remoteSku: mapping.remoteSku,
      remoteProductId: mapping.remoteProductId || '',
      syncStock: mapping.syncStock,
    });
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Bu eşleşmeyi silmek istediğinizden emin misiniz?')) return;

    try {
      const response = await fetch(`/api/mappings/${id}`, { method: 'DELETE' });
      if (response.ok) {
        fetchData();
      }
    } catch (error) {
      console.error('Error deleting mapping:', error);
    }
  };

  const openNewMappingModal = () => {
    setEditingMapping(null);
    setFormData({
      productId: '',
      marketplaceId: '',
      remoteSku: '',
      remoteProductId: '',
      syncStock: true,
    });
    setShowModal(true);
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-3 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">Ürün Eşleştirmeleri</h1>
          <p className="mt-2 text-gray-600">
            Yerel ürünlerinizi pazaryeri ürünleriyle eşleştirin
          </p>
        </div>
        <button
          onClick={openNewMappingModal}
          className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-4 md:px-6 py-2 md:py-3 rounded-xl font-semibold transition-all duration-200 hover:shadow-lg"
        >
          + Yeni Eşleştirme
        </button>
      </div>

      {/* Mappings Table */}
      <div className="rounded-2xl border border-gray-200 bg-white shadow-lg">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-gray-200 bg-gray-50">
              <tr className="text-left text-sm text-gray-600">
                <th className="p-4 font-medium">Yerel Ürün</th>
                <th className="p-4 font-medium">Pazaryeri</th>
                <th className="p-4 font-medium">Remote SKU</th>
                <th className="p-4 font-medium">Remote ID</th>
                <th className="p-4 font-medium">Stok Senkronizasyonu</th>
                <th className="p-4 font-medium">İşlemler</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {mappings.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-gray-500">
                    Eşleştirme bulunamadı
                  </td>
                </tr>
              ) : (
                mappings.map((mapping) => (
                  <tr key={mapping.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="p-4">
                      <div>
                        <p className="font-medium text-gray-900">{mapping.product.name}</p>
                        <p className="text-xs text-gray-500">SKU: {mapping.product.sku}</p>
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="inline-flex flex-col gap-1">
                        <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-800">
                          {mapping.marketplace.name}
                        </span>
                        {mapping.marketplace.storeName && (
                          <span className="text-xs font-semibold text-blue-600 px-2">
                            🏬 {mapping.marketplace.storeName}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="p-4 font-mono text-xs text-gray-600">
                      {mapping.remoteSku}
                    </td>
                    <td className="p-4 font-mono text-xs text-gray-600">
                      {mapping.remoteProductId || '-'}
                    </td>
                    <td className="p-4">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-medium ${
                          mapping.syncStock
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {mapping.syncStock ? 'Aktif' : 'Pasif'}
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleEdit(mapping)}
                          className="text-blue-600 hover:text-blue-800"
                        >
                          Düzenle
                        </button>
                        <button
                          onClick={() => handleDelete(mapping.id)}
                          className="text-red-600 hover:text-red-800"
                        >
                          Sil
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
              {editingMapping ? 'Eşleştirme Düzenle' : 'Yeni Eşleştirme'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Yerel Ürün
                </label>
                <select
                  required
                  disabled={!!editingMapping}
                  value={formData.productId}
                  onChange={(e) => setFormData({ ...formData, productId: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none disabled:bg-gray-100"
                >
                  <option value="">Ürün seçin</option>
                  {products.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.name} ({product.sku})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Pazaryeri
                </label>
                <select
                  required
                  disabled={!!editingMapping}
                  value={formData.marketplaceId}
                  onChange={(e) => setFormData({ ...formData, marketplaceId: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none disabled:bg-gray-100"
                >
                  <option value="">Pazaryeri seçin</option>
                  {marketplaces
                    .filter(mp => mp.isActive)
                    .map((marketplace) => (
                      <option key={marketplace.id} value={marketplace.id}>
                        {marketplace.name}{marketplace.storeName ? ` • ${marketplace.storeName}` : ''}
                      </option>
                    ))}
                </select>
                <p className="mt-1 text-xs text-gray-500">
                  💡 Sadece aktif pazaryerleri gösteriliyor
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Remote SKU
                </label>
                <input
                  type="text"
                  required
                  value={formData.remoteSku}
                  onChange={(e) => setFormData({ ...formData, remoteSku: e.target.value })}
                  placeholder="Pazaryerindeki ürün kodu"
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Remote Product ID (Opsiyonel)
                </label>
                <input
                  type="text"
                  value={formData.remoteProductId}
                  onChange={(e) => setFormData({ ...formData, remoteProductId: e.target.value })}
                  placeholder="Pazaryerindeki ürün ID"
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="syncStock"
                  checked={formData.syncStock}
                  onChange={(e) => setFormData({ ...formData, syncStock: e.target.checked })}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="syncStock" className="ml-2 text-sm text-gray-700">
                  Stok senkronizasyonu aktif
                </label>
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
                >
                  {editingMapping ? 'Güncelle' : 'Oluştur'}
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
    </div>
  );
}
