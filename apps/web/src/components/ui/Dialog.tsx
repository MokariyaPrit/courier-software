'use client';

import { Dialog as PRDialog } from 'primereact/dialog';
import type { CSSProperties, ReactNode } from 'react';

interface AppDialogProps {
  header?: ReactNode;
  visible: boolean;
  onHide: () => void;
  style?: CSSProperties;
  contentStyle?: CSSProperties;
  children?: ReactNode;
  footer?: ReactNode;
}

export function Dialog({
  header,
  visible,
  onHide,
  style,
  contentStyle,
  children,
  footer,
}: AppDialogProps) {
  return (
    <PRDialog
      header={header}
      visible={visible}
      onHide={onHide}
      modal
      blockScroll
      draggable={false}
      style={{ width: 'min(720px, 96vw)', ...style }}
      contentStyle={{
        maxHeight: 'min(70vh, 720px)',
        overflowY: 'auto',
        ...contentStyle,
      }}
      footer={footer}
    >
      {children}
    </PRDialog>
  );
}
