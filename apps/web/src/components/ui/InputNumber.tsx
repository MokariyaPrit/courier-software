'use client';

import { InputNumber as PRInputNumber } from '@primereact/ui/inputnumber';
import type { CSSProperties } from 'react';

interface AppInputNumberProps {
  value: number | null | undefined;
  onValueChange: (e: { value: number | null }) => void;
  mode?: 'decimal' | 'currency';
  currency?: string;
  locale?: string;
  min?: number;
  max?: number;
  style?: CSSProperties;
  className?: string;
  disabled?: boolean;
}

export function InputNumber({
  value,
  onValueChange,
  mode,
  currency,
  locale,
  min,
  max,
  style,
  className,
  disabled,
}: AppInputNumberProps) {
  return (
    <PRInputNumber.Root
      value={value ?? null}
      mode={mode}
      currency={currency}
      locale={locale}
      min={min}
      max={max}
      disabled={disabled}
      className={className}
      style={style}
      onValueChange={(e: { value?: number | null }) =>
        onValueChange({ value: e.value === undefined ? null : e.value })
      }
    >
      <PRInputNumber.Input style={{ width: '100%' }} />
    </PRInputNumber.Root>
  );
}
