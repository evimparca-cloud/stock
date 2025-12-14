'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Edit, Package, Truck } from 'lucide-react';

interface OrderDetailData {
    id: string;
    marketplaceOrderId: string;
    totalAmount: string;
    status: string;
    orderDate: string;
    marketplace: {
        name: string;
    };
    customerFirstName?: string;
    customerLastName?: string;
    customerEmail?: string;
    customerPhone?: string;
    cargoTrackingNumber?: string;
    cargoProviderName?: string;
    shippingAddress?: string;
    items: Array<{
        id: string;
        quantity: number;
        price: string;
        productMapping: {
            product: {
                name: string;
                sku: string;
                images?: string[];
            };
        };
    }>;
}

const statusConfig = {
    PENDING: { bg: 'bg-yellow-100 dark:bg-yellow-500/20', text: 'text-yellow-600 dark:text-yellow-300', label: 'Hazırlanıyor' },
    PROCESSING: { bg: 'bg-blue-100 dark:bg-blue-500/20', text: 'text-blue-600 dark:text-blue-300', label: 'İşleniyor' },
    SHIPPED: { bg: 'bg-orange-100 dark:bg-orange-500/20', text: 'text-orange-600 dark:text-orange-300', label: 'Kargolandı' },
    DELIVERED: { bg: 'bg-green-100 dark:bg-green-500/20', text: 'text-green-600 dark:text-green-300', label: 'Teslim Edildi' },
    CANCELLED: { bg: 'bg-red-100 dark:bg-red-500/20', text: 'text-red-600 dark:text-red-300', label: 'İptal Edildi' },
    REFUNDED: { bg: 'bg-gray-100 dark:bg-gray-500/20', text: 'text-gray-600 dark:text-gray-300', label: 'İade' },
};

export default function OrderDetailPage({ params }: { params: { id: string } }) {
    const router = useRouter();
    const [order, setOrder] = useState<OrderDetailData | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchOrderDetail();
    }, [params.id]);

    const fetchOrderDetail = async () => {
        try {
            const response = await fetch(`/api/orders/${params.id}`);
            const data = await response.json();

            if (response.ok) {
                setOrder(data);
            } else {
                console.error('Order not found');
            }
        } catch (error) {
            console.error('Error fetching order:', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center min-h-screen bg-[#F9F9FB] dark:bg-gray-900">
                <div className="text-center">
                    <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-gray-600 dark:text-gray-300">Sipariş detayları yükleniyor...</p>
                </div>
            </div>
        );
    }

    if (!order) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-[#F9F9FB] dark:bg-gray-900">
                <Package className="text-gray-300 mb-4" size={64} />
                <p className="text-lg text-gray-500 mb-4">Sipariş bulunamadı</p>
                <button
                    onClick={() => router.back()}
                    className="px-4 py-2 bg-[#0A84FF] text-white rounded-lg hover:bg-[#0077ED] transition-colors"
                >
                    Geri Dön
                </button>
            </div>
        );
    }

    const config = statusConfig[order.status as keyof typeof statusConfig] || statusConfig.PENDING;
    const customerName = `${order.customerFirstName || ''} ${order.customerLastName || ''}`.trim() || 'Müşteri';
    const subtotal = order.items.reduce((sum, item) => sum + (parseFloat(item.price) * item.quantity), 0);
    const total = parseFloat(order.totalAmount);
    const shipping = 0;
    const tax = total - subtotal - shipping;

    return (
        <div className="relative flex min-h-screen w-full flex-col bg-[#F9F9FB] dark:bg-gray-900">
            <div className="w-full max-w-lg mx-auto bg-[#F9F9FB] dark:bg-gray-900 min-h-screen shadow-2xl shadow-gray-200 dark:shadow-black">

                {/* Header */}
                <div className="flex items-center bg-white dark:bg-gray-800 p-4 pb-2 justify-between sticky top-0 z-10 border-b border-gray-200 dark:border-gray-700">
                    <button
                        onClick={() => router.back()}
                        className="text-gray-800 dark:text-white flex size-10 shrink-0 items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                        aria-label="Geri dön"
                    >
                        <ArrowLeft size={24} />
                    </button>
                    <h1 className="text-gray-900 dark:text-white text-lg font-bold leading-tight tracking-[-0.015em] flex-1 text-center">
                        Sipariş Detayı
                    </h1>
                    <button
                        className="flex size-10 shrink-0 items-center justify-center rounded-full hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                        aria-label="Siparişi düzenle"
                    >
                        <Edit className="text-[#0A84FF] dark:text-blue-400" size={24} />
                    </button>
                </div>

                <main className="p-4 space-y-4 pb-8">

                    {/* Order Summary*/}
                    <div className="p-4 rounded-xl bg-white dark:bg-gray-800 shadow-[0_2px_8px_rgba(0,0,0,0.05)]">
                        <div className="flex justify-between items-center">
                            <h2 className="text-gray-900 dark:text-white text-xl font-bold leading-tight tracking-[-0.015em]">
                                Sipariş #{order.marketplaceOrderId}
                            </h2>
                            <div className={`flex h-8 shrink-0 items-center justify-center gap-x-2 rounded-full ${config.bg} px-4`}>
                                <p className={`${config.text} text-sm font-medium leading-normal`}>
                                    {config.label}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Customer Info */}
                    <div className="p-4 rounded-xl bg-white dark:bg-gray-800 shadow-[0_2px_8px_rgba(0,0,0,0.05)]">
                        <div className="flex flex-col gap-4">
                            <h3 className="text-gray-900 dark:text-white text-lg font-bold leading-tight tracking-[-0.015em]">
                                Müşteri Bilgileri
                            </h3>

                            <div>
                                <p className="text-gray-500 dark:text-gray-400 text-sm font-normal mb-1">İletişim</p>
                                <p className="text-gray-800 dark:text-gray-100 text-base font-medium">{customerName}</p>
                                {order.customerEmail && (
                                    <p className="text-gray-800 dark:text-gray-100 text-base">{order.customerEmail}</p>
                                )}
                                {order.customerPhone && (
                                    <p className="text-gray-800 dark:text-gray-100 text-base">{order.customerPhone}</p>
                                )}
                            </div>

                            {order.shippingAddress && (
                                <div>
                                    <p className="text-gray-500 dark:text-gray-400 text-sm font-normal mb-1">Teslimat Adresi</p>
                                    <div className="text-gray-800 dark:text-gray-100 text-base font-medium whitespace-pre-line">
                                        {order.shippingAddress}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Items List */}
                    <div>
                        <h3 className="text-gray-900 dark:text-white text-lg font-bold leading-tight tracking-[-0.015em] px-1 pb-2 pt-2">
                            Sipariş İçeriği
                        </h3>
                        <div className="space-y-3">
                            {order.items.map((item) => (
                                <div
                                    key={item.id}
                                    className="flex items-center gap-4 p-3 rounded-xl bg-white dark:bg-gray-800 shadow-[0_2px_8px_rgba(0,0,0,0.05)] transition-transform active:scale-[0.99]"
                                >
                                    <div className="h-16 w-16 shrink-0 rounded-lg bg-gradient-to-br from-blue-100 to-purple-100 dark:from-blue-900/30 dark:to-purple-900/30 flex items-center justify-center">
                                        {item.productMapping.product.images?.[0] ? (
                                            <img
                                                className="h-full w-full rounded-lg object-cover"
                                                alt={item.productMapping.product.name}
                                                src={item.productMapping.product.images[0]}
                                            />
                                        ) : (
                                            <Package className="text-blue-500" size={32} />
                                        )}
                                    </div>
                                    <div className="flex-grow min-w-0">
                                        <p className="text-gray-900 dark:text-white font-semibold truncate">
                                            {item.productMapping.product.name}
                                        </p>
                                        <p className="text-gray-500 dark:text-gray-400 text-sm">SKU: {item.productMapping.product.sku}</p>
                                        <p className="text-gray-500 dark:text-gray-400 text-sm">Adet: {item.quantity}</p>
                                    </div>
                                    <p className="text-gray-900 dark:text-white font-semibold whitespace-nowrap">
                                        ₺{parseFloat(item.price).toFixed(2)}
                                    </p>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Financial Summary */}
                    <div className="p-4 rounded-xl bg-white dark:bg-gray-800 shadow-[0_2px_8px_rgba(0,0,0,0.05)]">
                        <h3 className="text-gray-900 dark:text-white text-lg font-bold leading-tight tracking-[-0.015em] mb-4">
                            Ödeme Özeti
                        </h3>
                        <div className="space-y-2">
                            <div className="flex justify-between items-center text-base">
                                <p className="text-gray-600 dark:text-gray-300">Ara Toplam</p>
                                <p className="text-gray-800 dark:text-gray-100 font-medium">₺{subtotal.toFixed(2)}</p>
                            </div>
                            {shipping > 0 && (
                                <div className="flex justify-between items-center text-base">
                                    <p className="text-gray-600 dark:text-gray-300">Kargo Ücreti</p>
                                    <p className="text-gray-800 dark:text-gray-100 font-medium">₺{shipping.toFixed(2)}</p>
                                </div>
                            )}
                            {tax > 0 && (
                                <div className="flex justify-between items-center text-base">
                                    <p className="text-gray-600 dark:text-gray-300">Vergi</p>
                                    <p className="text-gray-800 dark:text-gray-100 font-medium">₺{tax.toFixed(2)}</p>
                                </div>
                            )}
                            <div className="my-3 h-px w-full bg-gray-200 dark:bg-gray-700"></div>
                            <div className="flex justify-between items-center">
                                <p className="text-gray-900 dark:text-white text-lg font-bold">Genel Toplam</p>
                                <p className="text-[#0A84FF] dark:text-blue-400 text-lg font-bold">₺{total.toFixed(2)}</p>
                            </div>
                        </div>
                    </div>

                    {/* Tracking Card */}
                    {order.cargoProviderName && order.cargoTrackingNumber && (
                        <div className="p-4 rounded-xl bg-white dark:bg-gray-800 shadow-[0_2px_8px_rgba(0,0,0,0.05)]">
                            <h3 className="text-gray-900 dark:text-white text-lg font-bold leading-tight tracking-[-0.015em] mb-3">
                                Kargo Takibi
                            </h3>

                            <div className="flex items-center justify-between mb-6">
                                <div>
                                    <p className="text-gray-600 dark:text-gray-300">Taşıyıcı Firma: {order.cargoProviderName}</p>
                                    <p className="text-[#0A84FF] dark:text-blue-400 font-semibold">
                                        #{order.cargoTrackingNumber}
                                    </p>
                                </div>
                                <button className="flex h-10 items-center justify-center gap-x-2 rounded-lg bg-[#0A84FF]/10 dark:bg-[#0A84FF]/20 px-4 text-[#0A84FF] dark:text-blue-300 font-semibold hover:bg-[#0A84FF]/20 transition-colors">
                                    <Truck size={16} />
                                    Takip Et
                                </button>
                            </div>

                            <div className="space-y-4">
                                {order.status === 'SHIPPED' || order.status === 'DELIVERED' ? (
                                    <>
                                        <div className="flex gap-4">
                                            <div className="flex flex-col items-center">
                                                <div className="flex size-6 items-center justify-center rounded-full bg-[#0A84FF] ring-4 ring-[#0A84FF]/20 z-10">
                                                    <span className="text-white text-xs">✓</span>
                                                </div>
                                                <div className="h-full w-0.5 -my-1 py-1 bg-gray-300 dark:bg-gray-600"></div>
                                            </div>
                                            <div className="pb-2">
                                                <p className="font-semibold text-gray-800 dark:text-gray-100">Sipariş Onaylandı</p>
                                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                                    {new Date(order.orderDate).toLocaleDateString('tr-TR')}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="flex gap-4">
                                            <div className="flex flex-col items-center">
                                                <div className="flex size-6 items-center justify-center rounded-full bg-[#0A84FF] ring-4 ring-[#0A84FF]/20 z-10">
                                                    <Truck className="text-white" size={14} />
                                                </div>
                                                {order.status === 'DELIVERED' && (
                                                    <div className="h-full w-0.5 -my-1 py-1 bg-gray-300 dark:bg-gray-600"></div>
                                                )}
                                            </div>
                                            <div className="pb-2">
                                                <p className="font-semibold text-gray-800 dark:text-gray-100">Kargolandı</p>
                                                <p className="text-sm text-gray-500 dark:text-gray-400">Kargoya verildi</p>
                                            </div>
                                        </div>

                                        {order.status === 'DELIVERED' && (
                                            <div className="flex gap-4">
                                                <div className="flex flex-col items-center">
                                                    <div className="flex size-6 items-center justify-center rounded-full bg-[#0A84FF] ring-4 ring-[#0A84FF]/20 z-10">
                                                        <span className="text-white text-xs">✓</span>
                                                    </div>
                                                </div>
                                                <div className="pb-2">
                                                    <p className="font-semibold text-gray-800 dark:text-gray-100">Teslim Edildi</p>
                                                    <p className="text-sm text-gray-500 dark:text-gray-400">Müşteriye teslim edildi</p>
                                                </div>
                                            </div>
                                        )}
                                    </>
                                ) : (
                                    <p className="text-gray-500 dark:text-gray-400">
                                        Sipariş henüz kargoya verilmedi
                                    </p>
                                )}
                            </div>
                        </div>
                    )}

                </main>
            </div>
        </div>
    );
}
