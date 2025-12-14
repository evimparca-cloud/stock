'use client';

import { SessionProvider } from 'next-auth/react';
import { ReactNode } from 'react';
import { IdleTimeoutProvider } from '@/components/IdleTimeoutProvider';

export function Providers({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <IdleTimeoutProvider timeoutMinutes={15}>
        {children}
      </IdleTimeoutProvider>
    </SessionProvider>
  );
}
