'use client';

import {
  ConfirmDialog as PRConfirmDialog,
  confirmDialog as prConfirmDialog,
} from 'primereact/confirmdialog';
import type { ConfirmDialogProps } from 'primereact/confirmdialog';

export function ConfirmDialog(props: ConfirmDialogProps) {
  return <PRConfirmDialog blockScroll {...props} />;
}

export function confirmDialog(
  options: Parameters<typeof prConfirmDialog>[0],
) {
  return prConfirmDialog({
    blockScroll: true,
    ...options,
  });
}

/** No-op host — ConfirmDialog is self-contained via <ConfirmDialog /> on pages. */
export function ConfirmDialogHost({ children }: { children?: React.ReactNode }) {
  return <>{children}</>;
}
