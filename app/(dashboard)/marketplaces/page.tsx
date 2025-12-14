'use client';

import { useEffect, useState } from 'react';
import LoadingSpinner from '@/components/LoadingSpinner';

interface Marketplace {
  id: string;
  name: string;
  storeName: string | null;
  apiKey: string | null;
  apiSecret: string | null;
  supplierId: string | null;
  isActive: boolean;
  createdAt: string;
  _count: {
    mappings: number;
    orders: number;
  };
}

export default function MarketplacesPage() {
  const [marketplaces, setMarketplaces] = useState<Marketplace[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingMarketplace, setEditingMarketplace] = useState<Marketplace | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    storeName: '',
    apiKey: '',
    apiSecret: '',
    supplierId: '',
    isActive: true,
  });

  useEffect(() => {
    fetchMarketplaces();
  }, []);

  const fetchMarketplaces = async () => {
    try {
      const response = await fetch('/api/marketplaces');
      const data = await response.json();
      setMarketplaces(data);
    } catch (error) {
      console.error('Error fetching marketplaces:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const url = editingMarketplace 
        ? `/api/marketplaces/${editingMarketplace.id}` 
        : '/api/marketplaces';
      const method = editingMarketplace ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        setShowModal(false);
        setEditingMarketplace(null);
        setFormData({ name: '', storeName: '', apiKey: '', apiSecret: '', supplierId: '', isActive: true });
        fetchMarketplaces();
      } else {
        const error = await response.json();
        alert(error.error || 'Bir hata oluştu');
      }
    } catch (error) {
      console.error('Error saving marketplace:', error);
      alert('Bir hata oluştu');
    }
  };

  const handleEdit = (marketplace: Marketplace) => {
    setEditingMarketplace(marketplace);
    setFormData({
      name: marketplace.name,
      storeName: marketplace.storeName || '',
      apiKey: marketplace.apiKey || '',
      apiSecret: marketplace.apiSecret || '',
      supplierId: marketplace.supplierId || '',
      isActive: marketplace.isActive,
    });
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Bu pazaryerini silmek istediğinizden emin misiniz?')) return;

    try {
      const response = await fetch(`/api/marketplaces/${id}`, { method: 'DELETE' });
      if (response.ok) {
        fetchMarketplaces();
      }
    } catch (error) {
      console.error('Error deleting marketplace:', error);
    }
  };

  const toggleActive = async (marketplace: Marketplace) => {
    try {
      const response = await fetch(`/api/marketplaces/${marketplace.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !marketplace.isActive }),
      });

      if (response.ok) {
        fetchMarketplaces();
      }
    } catch (error) {
      console.error('Error toggling marketplace:', error);
    }
  };

  const openNewMarketplaceModal = () => {
    setEditingMarketplace(null);
    setFormData({ name: '', storeName: '', apiKey: '', apiSecret: '', supplierId: '', isActive: true });
    setShowModal(true);
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-orange-50/20 to-red-50/20 p-3 md:p-8 space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="space-y-2">
          <h1 className="text-3xl md:text-5xl font-bold bg-gradient-to-r from-orange-600 via-red-600 to-pink-600 bg-clip-text text-transparent animate-slide-in">
            Pazaryerleri
          </h1>
          <p className="text-base md:text-lg text-gray-600 font-medium">Bağlı platformları yönetin</p>
          <div className="h-1 w-24 bg-gradient-to-r from-orange-600 to-red-600 rounded-full"></div>
        </div>
        <button
          onClick={openNewMarketplaceModal}
          className="btn btn-primary flex items-center gap-2 shadow-lg hover:shadow-xl bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700"
        >
          <span className="text-xl">➕</span>
          Yeni Pazaryeri
        </button>
      </div>

      {/* Marketplaces Grid */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {marketplaces.length === 0 ? (
          <div className="col-span-full card text-center p-12">
            <div className="text-6xl mb-4">🏪</div>
            <p className="text-gray-500 text-lg">Henüz pazaryeri eklenmemiş</p>
          </div>
        ) : (
          marketplaces.map((marketplace) => (
            <div
              key={marketplace.id}
              className="group card hover:scale-105 transition-transform duration-300"
            >
              <div className="mb-4 flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-2xl">🏪</span>
                    <h3 className="text-xl font-bold text-gray-900 group-hover:text-orange-600 transition-colors">
                      {marketplace.name}
                    </h3>
                  </div>
                  {marketplace.storeName && (
                    <p className="text-sm font-semibold text-blue-600 mb-2">
                      🏬 {marketplace.storeName}
                    </p>
                  )}
                  <span
                    className={`badge ${
                      marketplace.isActive
                        ? 'badge-success'
                        : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {marketplace.isActive ? '✅ Aktif' : '❌ Pasif'}
                  </span>
                </div>
                <button
                  onClick={() => toggleActive(marketplace)}
                  className={`rounded-xl px-3 py-1.5 text-sm font-semibold transition-all shadow-sm ${
                    marketplace.isActive
                      ? 'bg-gray-100 text-gray-700 hover:bg-gray-200 hover:shadow'
                      : 'bg-gradient-to-r from-green-500 to-emerald-600 text-white hover:from-green-600 hover:to-emerald-700 hover:shadow-lg'
                  }`}
                >
                  {marketplace.isActive ? 'Devre Dışı' : 'Aktif Et'}
                </button>
              </div>

              <div className="space-y-3 border-t border-gray-100 pt-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Eşleşmeler</span>
                  <span className="font-medium text-gray-900">
                    {marketplace._count.mappings}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Siparişler</span>
                  <span className="font-medium text-gray-900">
                    {marketplace._count.orders}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Supplier ID</span>
                  <span className="font-mono text-xs text-gray-900">
                    {marketplace.supplierId || '-'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">API Key</span>
                  <span className="font-mono text-xs text-gray-500">
                    {marketplace.apiKey ? '••••••••' : 'Yok'}
                  </span>
                </div>
              </div>

              <div className="mt-4 flex gap-2 border-t border-gray-100 pt-4">
                <button
                  onClick={() => handleEdit(marketplace)}
                  className="flex-1 rounded-lg border border-blue-600 px-3 py-2 text-sm text-blue-600 hover:bg-blue-50"
                >
                  Düzenle
                </button>
                <button
                  onClick={() => handleDelete(marketplace.id)}
                  className="flex-1 rounded-lg border border-red-600 px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                >
                  Sil
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <h2 className="mb-4 text-xl font-bold text-gray-900">
              {editingMarketplace ? 'Pazaryeri Düzenle' : 'Yeni Pazaryeri'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Pazaryeri Adı
                </label>
                <input
                  type="text"
                  required
                  disabled={!!editingMarketplace}
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Örn: Trendyol, Hepsiburada"
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none disabled:bg-gray-100"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Mağaza Adı (İsteğe Bağlı)
                </label>
                <input
                  type="text"
                  value={formData.storeName}
                  onChange={(e) => setFormData({ ...formData, storeName: e.target.value })}
                  placeholder="Örn: Ana Mağaza, Outlet Mağaza"
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
                />
                <p className="mt-1 text-xs text-gray-500">
                  💡 Aynı pazaryerinde birden fazla mağazanız varsa ayırt etmek için kullanın
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">API Key</label>
                <input
                  type="text"
                  value={formData.apiKey}
                  onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
                  placeholder="API anahtarı (opsiyonel)"
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  API Secret
                </label>
                <input
                  type="password"
                  value={formData.apiSecret}
                  onChange={(e) => setFormData({ ...formData, apiSecret: e.target.value })}
                  placeholder="API gizli anahtarı (opsiyonel)"
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-900">
                  <span className="text-red-500">*</span> Supplier/Seller ID
                </label>
                <input
                  type="text"
                  required
                  value={formData.supplierId}
                  onChange={(e) => setFormData({ ...formData, supplierId: e.target.value })}
                  placeholder="Örn: 673643 (Trendyol Seller ID)"
                  className="mt-1 w-full rounded-lg border-2 border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
                />
                <div className="mt-2 rounded-lg bg-blue-50 border border-blue-200 p-3">
                  <p className="text-xs text-blue-900 font-semibold mb-1">
                    📌 Trendyol için Satıcı ID'nizi nerede bulabilirsiniz:
                  </p>
                  <ul className="text-xs text-blue-800 space-y-1 ml-4 list-disc">
                    <li>Trendyol Satıcı Paneli'ne giriş yapın</li>
                    <li>Sağ üstte Mağaza Adınıza tıklayın</li>
                    <li>"Hesap Bilgilerim" menüsüne gidin</li>
                    <li>Satıcı ID bilginizi buradan alın</li>
                  </ul>
                </div>
              </div>
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="isActive" className="ml-2 text-sm text-gray-700">
                  Aktif
                </label>
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
                >
                  {editingMarketplace ? 'Güncelle' : 'Oluştur'}
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
