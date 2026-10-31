'use client';

import Lara from '@primeuix/themes/lara';
import { PrimeReactProvider } from '@primereact/core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { ConfirmDialogHost } from '@/components/ui';
import { AuthProvider } from '@/lib/auth';

const theme = {
  preset: Lara,
  options: {
    darkModeSelector: 'none' as const,
  },
};

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
      <PrimeReactProvider theme={theme}>
        <ConfirmDialogHost>
          <AuthProvider>{children}</AuthProvider>
        </ConfirmDialogHost>
      </PrimeReactProvider>
    </QueryClientProvider>
  );
}
