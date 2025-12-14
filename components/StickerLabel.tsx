'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

interface StickerLabelProps {
    order: {
        marketplaceOrderId: string;
        cargoTrackingNumber?: string;
        cargoProviderName?: string;
        customerFirstName?: string;
        customerLastName?: string;
        shipmentAddress?: {
            fullAddress?: string;
            address1?: string;
            neighborhood?: string;
            district?: string;
            city?: string;
        };
        marketplace?: {
            name: string;
            storeName?: string;
        };
    };
    onClose?: () => void;
}

export default function StickerLabel({ order, onClose }: StickerLabelProps) {
    const barcodeRef = useRef<SVGSVGElement>(null);
    const printBarcodeRef = useRef<SVGSVGElement>(null);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        // Generate barcode for preview
        if (order.cargoTrackingNumber && barcodeRef.current) {
            import('jsbarcode').then((JsBarcode) => {
                JsBarcode.default(barcodeRef.current, order.cargoTrackingNumber!, {
                    format: 'CODE128',
                    width: 2,
                    height: 60,
                    displayValue: true,
                    fontSize: 14,
                    margin: 5,
                });
            }).catch(err => {
                console.error('JsBarcode load error:', err);
            });
        }
    }, [order.cargoTrackingNumber]);

    useEffect(() => {
        // Generate barcode for print container
        if (order.cargoTrackingNumber && printBarcodeRef.current && mounted) {
            import('jsbarcode').then((JsBarcode) => {
                JsBarcode.default(printBarcodeRef.current, order.cargoTrackingNumber!, {
                    format: 'CODE128',
                    width: 2,
                    height: 60,
                    displayValue: true,
                    fontSize: 14,
                    margin: 5,
                });
            }).catch(err => {
                console.error('JsBarcode load error:', err);
            });
        }
    }, [order.cargoTrackingNumber, mounted]);

    const customerName = `${order.customerFirstName || ''} ${order.customerLastName || ''}`.trim() || 'Müşteri';

    const address = order.shipmentAddress;
    const addressLine1 = address?.fullAddress || address?.address1 || '';
    const addressLine2 = address?.neighborhood || '';
    const addressLine3 = `${address?.district || ''} / ${address?.city || ''}`.trim();

    const handlePrint = () => {
        window.print();
    };

    // Label content component
    const LabelContent = ({ barcodeRefProp }: { barcodeRefProp: React.RefObject<SVGSVGElement> }) => (
        <div
            className="sticker-label bg-white p-4"
            style={{ width: '80mm', fontFamily: 'Arial, sans-serif' }}
        >
            {/* Barcode Section */}
            {order.cargoTrackingNumber ? (
                <div className="text-center mb-3 pb-3 border-b-2 border-black">
                    <svg ref={barcodeRefProp} className="mx-auto"></svg>
                </div>
            ) : (
                <div className="text-center mb-3 pb-3 border-b-2 border-black text-gray-400 text-sm">
                    Kargo takip numarası yok
                </div>
            )}

            {/* Address Section */}
            <div className="mb-3 pb-3 border-b border-gray-400">
                <p className="font-bold text-sm leading-tight">{addressLine1}</p>
                <p className="text-sm mt-1">{addressLine2}</p>
                <p className="font-bold text-sm mt-2">{addressLine3}</p>
            </div>

            {/* Customer & Order Info */}
            <div className="space-y-2">
                <div className="border-2 border-black p-2">
                    <p className="font-bold text-base">{customerName}</p>
                </div>

                <div className="space-y-1 text-sm">
                    <p className="font-bold">{order.marketplaceOrderId}</p>
                    <p className="font-bold">{order.cargoTrackingNumber || '-'}</p>
                    <p className="font-bold uppercase">{order.cargoProviderName || 'KARGO'}</p>
                </div>
            </div>

            {/* Footer: Marketplace & Store */}
            <div className="mt-2 pt-2 border-t border-black text-center">
                <p className="font-bold text-xs uppercase">
                    {order.marketplace?.name} - {order.marketplace?.storeName || 'MAĞAZA'}
                </p>
            </div>
        </div>
    );

    const handleShare = async () => {
        try {
            const element = document.getElementById('sticker-preview-content');
            if (!element) {
                alert('Etiket bulunamadı');
                return;
            }

            // Loading state could be added here
            const html2canvas = (await import('html2canvas')).default;
            const canvas = await html2canvas(element, {
                scale: 2, // Better quality
                backgroundColor: '#ffffff',
                logging: false,
                useCORS: true // If external images are used
            } as any);

            canvas.toBlob(async (blob) => {
                if (!blob) {
                    alert('Görüntü oluşturulamadı');
                    return;
                }

                const file = new File([blob], `sticker-${order.marketplaceOrderId}.png`, { type: 'image/png' });

                if (navigator.share) {
                    try {
                        // Check if file sharing is supported
                        if (navigator.canShare && !navigator.canShare({ files: [file] })) {
                            throw new Error('Dosya paylaşımı desteklenmiyor');
                        }

                        await navigator.share({
                            files: [file],
                            title: `Etiket - ${order.marketplaceOrderId}`,
                            text: `${order.customerFirstName} - ${order.cargoTrackingNumber}`,
                        });
                    } catch (shareError) {
                        console.log('Share API error:', shareError);
                        // Fallback to text share or download
                        downloadImage(canvas);
                    }
                } else {
                    downloadImage(canvas);
                }
            }, 'image/png');

        } catch (err) {
            console.error('Share failed:', err);
            alert('Paylaşım sırasında bir hata oluştu');
        }
    };

    const downloadImage = (canvas: HTMLCanvasElement) => {
        const link = document.createElement('a');
        link.download = `sticker-${order.marketplaceOrderId}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
    };

    return (
        <>
            {/* Print Styles - Global */}
            {/* Print Styles - Global */}
            <style jsx global>{`
                @media print {
                    /* Reset body */
                    body {
                        visibility: hidden !important;
                        background-color: white !important;
                        margin: 0 !important;
                        padding: 0 !important;
                        min-height: auto !important;
                        height: auto !important;
                    }
                    
                    /* Hide everything else explicitly just in case */
                    body > *:not(#sticker-print-portal) {
                        display: none !important;
                    }
                    
                    /* Show only the print portal */
                    #sticker-print-portal {
                        visibility: visible !important;
                        display: block !important;
                        position: fixed !important; /* Fixed ensures it stays top-left */
                        top: 0 !important;
                        left: 0 !important;
                        margin: 0 !important;
                        padding: 0 !important;
                        width: 80mm !important;
                        height: auto !important;
                        background: white !important;
                        z-index: 2147483647 !important; /* Start of 32-bit max just to be safe */
                    }
                    
                    /* Ensure content inside interacts correctly */
                    #sticker-print-portal * {
                        visibility: visible !important;
                    }
                    
                    /* Specific Page Settings for Thermal Printers */
                    @page {
                        size: 80mm auto; /* Standard Thermal Label Width */
                        margin: 0;
                    }
                }
                
                @media screen {
                    #sticker-print-portal {
                        display: none !important;
                    }
                }
            `}</style>

            {/* Print Portal - Rendered directly in body for print */}
            {mounted && createPortal(
                <div id="sticker-print-portal">
                    <LabelContent barcodeRefProp={printBarcodeRef} />
                </div>,
                document.body
            )}

            {/* Modal Overlay - For screen preview */}
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
                <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
                    {/* Header */}
                    <div className="flex items-center justify-between p-4 border-b">
                        <h3 className="text-lg font-semibold">🏷️ Sticker Etiket Önizleme</h3>
                        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
                    </div>

                    {/* Label Preview */}
                    <div className="p-4 flex justify-center">
                        {/* Wrapper with ID for html2canvas */}
                        <div id="sticker-preview-content" className="border-2 border-dashed border-gray-300">
                            <LabelContent barcodeRefProp={barcodeRef} />
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex justify-end gap-3 p-4 border-t bg-gray-50">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 rounded-lg text-gray-600 hover:bg-gray-200 transition-colors"
                        >
                            İptal
                        </button>

                        {/* Share / Open With Button */}
                        <button
                            onClick={handleShare}
                            className="px-6 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700 transition-colors font-medium flex items-center gap-2"
                        >
                            <span>📤</span>
                            <span className="hidden md:inline">Paylaş / İndir</span>
                            <span className="md:hidden">Birlikte Aç</span>
                        </button>

                        <button
                            onClick={handlePrint}
                            className="px-6 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors font-medium"
                        >
                            🖨️ Yazdır
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
}
