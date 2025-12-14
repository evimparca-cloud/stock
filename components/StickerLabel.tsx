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

    // Generate barcode for preview on mount
    useEffect(() => {
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
            }).catch(err => console.error('JsBarcode load error:', err));
        }
    }, [order.cargoTrackingNumber]);

    const customerName = `${order.customerFirstName || ''} ${order.customerLastName || ''}`.trim() || 'Müşteri';
    const address = order.shipmentAddress;
    const addressLine1 = address?.fullAddress || address?.address1 || '';
    const addressLine2 = address?.neighborhood || '';
    const addressLine3 = `${address?.district || ''} / ${address?.city || ''}`.trim();

    // Reusable HTML content string generator for the iframe
    const getPrintContent = async () => {
        // We need to generate the barcode SVG as data URI or string to pass to iframe
        let barcodeSvg = '';
        if (order.cargoTrackingNumber) {
            // Create a temp element to render barcode string
            const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            const { default: JsBarcode } = await import('jsbarcode');
            JsBarcode(tempSvg, order.cargoTrackingNumber, {
                format: 'CODE128',
                width: 2,
                height: 60,
                displayValue: true,
                fontSize: 14,
                margin: 5,
            });
            barcodeSvg = tempSvg.outerHTML;
        } else {
            barcodeSvg = '<div style="text-align:center; padding: 10px; border-bottom: 2px solid black; color: #999;">Kargo takip numarası yok</div>';
        }

        return `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Etiket - ${order.marketplaceOrderId}</title>
                <style>
                    @page { margin: 0; size: 80mm auto; }
                    body { 
                        margin: 0; 
                        padding: 0; 
                        font-family: Arial, sans-serif; 
                        width: 80mm; 
                        max-width: 80mm;
                    }
                    .sticker-container {
                        padding: 10px;
                        box-sizing: border-box;
                        width: 100%;
                    }
                    .barcode-container { text-align: center; margin-bottom: 10px; padding-bottom: 10px; border-bottom: 2px solid black; }
                    .address-container { margin-bottom: 10px; padding-bottom: 10px; border-bottom: 1px solid #ccc; }
                    .address-line { font-size: 14px; margin: 2px 0; }
                    .font-bold { font-weight: bold; }
                    .customer-box { border: 2px solid black; padding: 8px; margin-bottom: 10px; font-size: 16px; font-weight: bold; }
                    .info-line { font-size: 14px; font-weight: bold; margin: 2px 0; }
                    .footer { margin-top: 10px; padding-top: 5px; border-top: 1px solid black; text-align: center; font-size: 12px; font-weight: bold; text-transform: uppercase; }
                    svg { max-width: 100%; height: auto; }
                </style>
            </head>
            <body>
                <div class="sticker-container">
                    <div class="barcode-container">
                        ${barcodeSvg}
                    </div>
                    
                    <div class="address-container">
                        <div class="address-line font-bold">${addressLine1}</div>
                        <div class="address-line">${addressLine2}</div>
                        <div class="address-line font-bold">${addressLine3}</div>
                    </div>

                    <div class="customer-box">
                        ${customerName}
                    </div>

                    <div class="info-line">${order.marketplaceOrderId}</div>
                    <div class="info-line">${order.cargoTrackingNumber || '-'}</div>
                    <div class="info-line" style="text-transform:uppercase;">${order.cargoProviderName || 'KARGO'}</div>

                    <div class="footer">
                        ${order.marketplace?.name} - ${order.marketplace?.storeName || 'MAĞAZA'}
                    </div>
                </div>
            </body>
            </html>
        `;
    };

    const handlePrint = async () => {
        // Fallback to the most reliable method: New Window Popup
        // This avoids all CSS conflicts and iframe rendering issues
        const printWindow = window.open('', '_blank', 'width=400,height=600');

        if (!printWindow) {
            alert('Lütfen açılır pencere (popup) engelleyicisini kapatıp tekrar deneyin.');
            return;
        }

        const content = await getPrintContent();

        printWindow.document.open();
        printWindow.document.write(content);
        printWindow.document.close();

        // Wait for resources to load
        printWindow.focus();
        setTimeout(() => {
            printWindow.print();
            // Optional: Close after print dialog is closed (some browsers support this better than others)
            // printWindow.close(); 
        }, 800);
    };

    // Keep the share logic as is, it works on the preview element
    const handleShare = async () => {
        try {
            const element = document.getElementById('sticker-preview-content');
            if (!element) return;
            const html2canvas = (await import('html2canvas')).default;
            const canvas = await html2canvas(element, { scale: 2, backgroundColor: '#ffffff' } as any);
            canvas.toBlob(async (blob) => {
                if (!blob) return;
                const file = new File([blob], `sticker-${order.marketplaceOrderId}.png`, { type: 'image/png' });
                if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
                    await navigator.share({ files: [file], title: 'Etiket' });
                } else {
                    const link = document.createElement('a');
                    link.download = file.name;
                    link.href = URL.createObjectURL(blob);
                    link.click();
                }
            }, 'image/png');
        } catch (err) {
            alert('Paylaşım hatası');
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b">
                    <h3 className="text-lg font-semibold">🏷️ Sticker Etiket Önizleme</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
                </div>

                {/* Preview Content (Only for display, not for printing anymore) */}
                <div className="p-4 flex justify-center bg-gray-100/50">
                    <div id="sticker-preview-content" className="bg-white p-4 shadow-sm border border-gray-200" style={{ width: '80mm', minHeight: '150px' }}>
                        {/* We replicate the structure visually for preview using Tailwind */}
                        {/* Barcode */}
                        <div className="text-center mb-3 pb-3 border-b-2 border-black">
                            <svg ref={barcodeRef} className="mx-auto max-w-full h-16"></svg>
                        </div>
                        {/* Address */}
                        <div className="mb-3 pb-3 border-b border-gray-400 text-sm">
                            <p className="font-bold leading-tight">{addressLine1}</p>
                            <p className="mt-1">{addressLine2}</p>
                            <p className="font-bold mt-2">{addressLine3}</p>
                        </div>
                        {/* Customer */}
                        <div className="border-2 border-black p-2 mb-3">
                            <p className="font-bold text-base">{customerName}</p>
                        </div>
                        {/* Info */}
                        <div className="space-y-1 text-sm font-bold">
                            <p>{order.marketplaceOrderId}</p>
                            <p>{order.cargoTrackingNumber || '-'}</p>
                            <p className="uppercase">{order.cargoProviderName || 'KARGO'}</p>
                        </div>
                        {/* Footer */}
                        <div className="mt-2 pt-2 border-t border-black text-center text-xs font-bold uppercase">
                            {order.marketplace?.name} - {order.marketplace?.storeName || 'MAĞAZA'}
                        </div>
                    </div>
                </div>

                {/* Actions */}
                <div className="flex justify-end gap-3 p-4 border-t bg-gray-50">
                    <button onClick={onClose} className="px-4 py-2 rounded-lg text-gray-600 hover:bg-gray-200">İptal</button>
                    <button onClick={handleShare} className="px-6 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700 flex items-center gap-2">
                        <span>📤</span> <span className="hidden md:inline">Paylaş/İndir</span>
                    </button>
                    <button onClick={handlePrint} className="px-6 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 font-medium">
                        🖨️ Yazdır
                    </button>
                </div>
            </div>
        </div>
    );
}
