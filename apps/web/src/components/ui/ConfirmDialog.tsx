'use client';

import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { Button } from './Button';
import { Dialog } from './Dialog';

export interface ConfirmOptions {
  header?: string;
  message: string;
  acceptLabel?: string;
  rejectLabel?: string;
  acceptClassName?: string;
  acceptSeverity?: 'danger' | 'warn' | 'secondary';
  accept: () => void;
}

type ConfirmFn = (opts: ConfirmOptions) => void;

const ConfirmContext = createContext<ConfirmFn | null>(null);

let externalConfirm: ConfirmFn | null = null;

/** Imperative confirm (v10 confirmDialog style). Requires ConfirmDialogHost in tree. */
export function confirmDialog(opts: ConfirmOptions) {
  if (!externalConfirm) {
    console.warn('ConfirmDialogHost is not mounted');
    return;
  }
  externalConfirm(opts);
}

export function ConfirmDialogHost({ children }: { children?: React.ReactNode }) {
  const [opts, setOpts] = useState<ConfirmOptions | null>(null);

  const confirm = useCallback((next: ConfirmOptions) => {
    setOpts(next);
  }, []);

  externalConfirm = confirm;

  const value = useMemo(() => confirm, [confirm]);

  return (
    <ConfirmContext.Provider value={value}>
      {children}
      <Dialog
        header={opts?.header ?? 'Confirm'}
        visible={Boolean(opts)}
        onHide={() => setOpts(null)}
        style={{ width: 'min(28rem, 95vw)' }}
        footer={
          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
            <Button
              label={opts?.rejectLabel ?? 'Cancel'}
              text
              severity="secondary"
              onClick={() => setOpts(null)}
            />
            <Button
              label={opts?.acceptLabel ?? 'OK'}
              severity={opts?.acceptSeverity ?? (opts?.acceptClassName?.includes('danger') ? 'danger' : undefined)}
              onClick={() => {
                const accept = opts?.accept;
                setOpts(null);
                accept?.();
              }}
            />
          </div>
        }
      >
        <p style={{ margin: 0 }}>{opts?.message}</p>
      </Dialog>
    </ConfirmContext.Provider>
  );
}

export function useConfirmDialog() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirmDialog requires ConfirmDialogHost');
  return ctx;
}

/** No-op mount point kept for pages that rendered <ConfirmDialog /> */
export function ConfirmDialog() {
  return null;
}
