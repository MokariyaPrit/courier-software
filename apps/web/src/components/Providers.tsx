'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PrimeReactProvider } from 'primereact/api';
import { useState } from 'react';
import { ConfirmDialogHost } from '@/components/ui';
import { ToastHost } from '@/components/ToastHost';
import { AuthProvider } from '@/lib/auth';

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { retry: 1, refetchOnWindowFocus: false },
        },
      }),
  );

  return (
    <QueryClientProvider client={client}>
      <PrimeReactProvider>
        <ConfirmDialogHost>
          <ToastHost />
          <AuthProvider>{children}</AuthProvider>
        </ConfirmDialogHost>
      </PrimeReactProvider>
    </QueryClientProvider>
  );
}
