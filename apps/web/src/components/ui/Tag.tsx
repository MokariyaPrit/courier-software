'use client';

import { Tag as PRTag } from 'primereact/tag';
import type { ReactNode } from 'react';

type TagSeverity =
  | 'secondary'
  | 'success'
  | 'info'
  | 'warning'
  | 'warn'
  | 'danger'
  | 'contrast';

interface AppTagProps {
  value?: ReactNode;
  children?: ReactNode;
  severity?: TagSeverity;
  rounded?: boolean;
  className?: string;
}

/** Accepts either `value` or children (pages migrated from v11 use children). */
export function Tag({ value, children, severity, rounded, className }: AppTagProps) {
  const content = children ?? value;
  const mapped =
    severity === 'warn' ? 'warning' : severity === 'warning' ? 'warning' : severity;

  return (
    <PRTag
      value={content as string}
      severity={mapped}
      rounded={rounded}
      className={className}
    />
  );
}
