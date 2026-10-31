'use client';

import { Dialog as PRDialog } from 'primereact/dialog';
import type { CSSProperties, ReactNode } from 'react';

interface AppDialogProps {
  header?: ReactNode;
  visible: boolean;
  onHide: () => void;
  style?: CSSProperties;
  children?: ReactNode;
  footer?: ReactNode;
}

export function Dialog({
  header,
  visible,
  onHide,
  style,
  children,
  footer,
}: AppDialogProps) {
  return (
    <PRDialog
      header={header}
      visible={visible}
      onHide={onHide}
      style={style}
      footer={footer}
    >
      {children}
    </PRDialog>
  );
}
