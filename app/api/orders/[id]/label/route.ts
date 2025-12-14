import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth-check';

export async function GET(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        await requireAdmin();
    } catch {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const order = await prisma.order.findUnique({
        where: { id: params.id },
        include: {
            marketplace: true,
        },
    });

    if (!order) {
        return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    const customerInfo = order.customerInfo as any;

    // Extract customer details
    const customerName = `${customerInfo.firstName || ''} ${customerInfo.lastName || ''}`.trim() || 'Müşteri';
    const addressData = customerInfo.address || {};
    const trackingNumber = order.cargoTrackingNumber || order.marketplaceOrderId;

    // Generate 80mm thermal label HTML
    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    @page {
      size: 80mm auto;
      margin: 3mm;
    }
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: Arial, sans-serif;
      font-size: 11pt;
      line-height: 1.3;
      padding: 8px;
    }
    .barcode-container {
      text-align: center;
      margin-bottom: 8px;
    }
    .barcode {
      width: 100%;
      height: 50px;
    }
    .barcode-text {
      font-size: 13pt;
      font-weight: bold;
      margin-top: 4px;
    }
    .box {
      border: 2px solid black;
      padding: 6px 8px;
      margin: 8px 0;
      min-height: 40px;
    }
    .box-title {
      font-weight: bold;
      font-size: 10pt;
      margin-bottom: 3px;
    }
    .box-content {
      font-size: 9pt;
      line-height: 1.4;
    }
    .order-info {
      margin: 8px 0;
      font-size: 10pt;
      line-height: 1.5;
    }
    .order-info div {
      margin: 2px 0;
    }
    .cargo {
      font-weight: bold;
      font-size: 16pt;
      text-align: center;
      margin-top: 10px;
      padding: 8px;
      border-top: 2px solid black;
    }
  </style>
</head>
<body>
  <!-- Barcode -->
  <div class="barcode-container">
    <svg class="barcode" id="barcode"></svg>
    <div class="barcode-text">${trackingNumber}</div>
  </div>

  <!-- Customer Address -->
  <div class="box">
    <div class="box-title">${customerName.toUpperCase()}</div>
    <div class="box-content">
      ${addressData.fullAddress || addressData.address || ''}<br>
      ${addressData.district || ''} ${addressData.city || ''}
    </div>
  </div>

  <!-- Recipient Name -->
  <div class="box">
    <div class="box-title">${customerName.toUpperCase()}</div>
  </div>

  <!-- Order Details -->
  <div class="order-info">
    <div><strong>Sipariş:</strong> ${order.marketplaceOrderId}</div>
    ${order.cargoTrackingNumber ? `<div><strong>Takip No:</strong> ${order.cargoTrackingNumber}</div>` : ''}
  </div>

  <!-- Cargo Provider -->
  <div class="cargo">${order.cargoProviderName || 'KARGO'}</div>

  <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js"></script>
  <script>
    window.addEventListener('DOMContentLoaded', function() {
      JsBarcode("#barcode", "${trackingNumber}", {
        format: "CODE128",
        width: 2,
        height: 50,
        displayValue: false,
        margin: 0
      });
    });
  </script>
</body>
</html>`;

    return new NextResponse(html, {
        headers: {
            'Content-Type': 'text/html; charset=utf-8',
        },
    });
}
