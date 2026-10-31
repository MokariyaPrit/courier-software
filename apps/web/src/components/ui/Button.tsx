'use client';

import { Button as PRButton } from '@primereact/ui/button';
import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from 'react';

type Severity =
  | 'secondary'
  | 'info'
  | 'success'
  | 'warn'
  | 'help'
  | 'danger'
  | 'contrast';

export interface AppButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  label?: string;
  icon?: string;
  iconPos?: 'left' | 'right';
  severity?: Severity;
  /** v10 `text` / `outlined` / `link` → v11 `variant` */
  text?: boolean;
  outlined?: boolean;
  link?: boolean;
  rounded?: boolean;
  raised?: boolean;
  plain?: boolean;
  size?: 'small' | 'normal' | 'large';
  loading?: boolean;
  fluid?: boolean;
  children?: ReactNode;
  style?: CSSProperties;
  className?: string;
}

export function Button({
  label,
  icon,
  iconPos = 'left',
  text,
  outlined,
  link,
  loading,
  disabled,
  children,
  ...rest
}: AppButtonProps) {
  const variant = link
    ? 'link'
    : text
      ? 'text'
      : outlined
        ? 'outlined'
        : undefined;

  const iconEl = loading ? (
    <i className="pi pi-spin pi-spinner" />
  ) : icon ? (
    <i className={icon} />
  ) : null;

  const content = (
    <>
      {iconEl && iconPos !== 'right' ? iconEl : null}
      {label ?? children}
      {iconEl && iconPos === 'right' ? iconEl : null}
    </>
  );

  return (
    <PRButton
      {...rest}
      variant={variant}
      disabled={disabled || loading}
    >
      {content}
    </PRButton>
  );
}
