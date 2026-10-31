'use client';

import { Times } from '@primeicons/react';
import { Button } from '@primereact/ui/button';
import { Dialog as PRDialog } from '@primereact/ui/dialog';
import type { CSSProperties, ReactNode } from 'react';

interface AppDialogProps {
  header?: ReactNode;
  visible: boolean;
  onHide: () => void;
  style?: CSSProperties;
  children?: ReactNode;
  footer?: ReactNode;
}

/** Controlled dialog compatible with v10 visible/onHide usage. */
export function Dialog({
  header,
  visible,
  onHide,
  style,
  children,
  footer,
}: AppDialogProps) {
  return (
    <PRDialog.Root
      open={visible}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      onOpenChange={(e: any) => {
        if (!e?.value) onHide();
      }}
    >
      <PRDialog.Portal>
        <PRDialog.Backdrop />
        <PRDialog.Positioner>
          <PRDialog.Popup style={style ?? { width: 'min(32rem, 95vw)' }}>
            {header ? (
              <PRDialog.Header>
                <PRDialog.Title>{header}</PRDialog.Title>
                <PRDialog.HeaderActions>
                  <PRDialog.Close as={Button} rounded variant="text" iconOnly aria-label="Close">
                    <Times />
                  </PRDialog.Close>
                </PRDialog.HeaderActions>
              </PRDialog.Header>
            ) : null}
            <PRDialog.Content>{children}</PRDialog.Content>
            {footer ? <PRDialog.Footer>{footer}</PRDialog.Footer> : null}
          </PRDialog.Popup>
        </PRDialog.Positioner>
      </PRDialog.Portal>
    </PRDialog.Root>
  );
}
