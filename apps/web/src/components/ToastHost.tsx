'use client';

import { Toast } from 'primereact/toast';
import { useEffect, useRef } from 'react';
import { registerToast, type ToastShowOptions } from '@/lib/toast';

export function ToastHost() {
  const ref = useRef<Toast>(null);

  useEffect(() => {
    registerToast((opts: ToastShowOptions) => {
      ref.current?.show({
        severity: opts.severity ?? 'info',
        summary: opts.summary,
        detail: opts.detail,
        life: opts.life ?? 3500,
      });
    });
    return () => registerToast(null);
  }, []);

  return <Toast ref={ref} position="bottom-right" />;
}
