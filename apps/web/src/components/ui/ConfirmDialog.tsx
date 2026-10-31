'use client';

export { ConfirmDialog, confirmDialog } from 'primereact/confirmdialog';

/** No-op host — v10 ConfirmDialog is self-contained via <ConfirmDialog /> on pages. */
export function ConfirmDialogHost({ children }: { children?: React.ReactNode }) {
  return <>{children}</>;
}
