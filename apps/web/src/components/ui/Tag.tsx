'use client';

import { Tag as PRTag } from '@primereact/ui/tag';
import type { ReactNode } from 'react';

interface AppTagProps {
  value?: ReactNode;
  children?: ReactNode;
  severity?: 'secondary' | 'success' | 'info' | 'warn' | 'danger' | 'contrast';
  rounded?: boolean;
  className?: string;
}

export function Tag({ value, children, severity, rounded, className }: AppTagProps) {
  return (
    <PRTag severity={severity} rounded={rounded} className={className}>
      {children ?? value}
    </PRTag>
  );
}
