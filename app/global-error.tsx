'use client';

import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log error to Sentry/GlitchTip
    Sentry.captureException(error);
  }, [error]);

  return (
    <html>
      <body>
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          fontFamily: 'system-ui, sans-serif',
          backgroundColor: '#1a1a2e',
          color: '#eaeaea'
        }}>
          <h2 style={{ fontSize: '24px', marginBottom: '16px' }}>Bir hata oluştu</h2>
          <p style={{ color: '#888', marginBottom: '24px' }}>
            Sistem hatası kaydedildi. Lütfen tekrar deneyin.
          </p>
          <button
            onClick={reset}
            style={{
              padding: '12px 24px',
              backgroundColor: '#4f46e5',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '16px'
            }}
          >
            Tekrar Dene
          </button>
        </div>
      </body>
    </html>
  );
}