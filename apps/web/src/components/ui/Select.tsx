'use client';

import { ChevronDown } from '@primeicons/react';
import { Select as PRSelect } from '@primereact/ui/select';
import type { CSSProperties } from 'react';

export interface SelectOption {
  label: string;
  value: string | number | boolean | null;
}

interface SelectProps {
  value: unknown;
  options: SelectOption[];
  onChange: (e: { value: any }) => void;
  placeholder?: string;
  className?: string;
  style?: CSSProperties;
  disabled?: boolean;
  optionLabel?: string;
  optionValue?: string;
}

/** Dropdown-shaped Select wrapper (PrimeReact 11). */
export function Select({
  value,
  options,
  onChange,
  placeholder,
  className,
  style,
  disabled,
}: SelectProps) {
  return (
    <PRSelect.Root
      value={value}
      options={options}
      optionLabel="label"
      optionValue="value"
      disabled={disabled}
      className={className}
      style={style}
      onValueChange={(e: { value: unknown }) => onChange({ value: e.value })}
    >
      <PRSelect.Trigger style={{ width: '100%' }}>
        <PRSelect.Value placeholder={placeholder} />
        <PRSelect.Indicator>
          <ChevronDown />
        </PRSelect.Indicator>
      </PRSelect.Trigger>
      <PRSelect.Portal>
        <PRSelect.Positioner>
          <PRSelect.Popup>
            <PRSelect.List />
          </PRSelect.Popup>
        </PRSelect.Positioner>
      </PRSelect.Portal>
    </PRSelect.Root>
  );
}

/** Multi-select via Select.multiple */
export function MultiSelect({
  value,
  options,
  onChange,
  placeholder,
  className,
  style,
  disabled,
}: {
  value: unknown[];
  options: SelectOption[];
  onChange: (e: { value: any }) => void;
  placeholder?: string;
  className?: string;
  style?: CSSProperties;
  disabled?: boolean;
}) {
  const selectedLabels = options
    .filter((o) => value?.includes(o.value as never))
    .map((o) => o.label)
    .join(', ');

  return (
    <PRSelect.Root
      multiple
      value={value}
      options={options}
      optionLabel="label"
      optionValue="value"
      disabled={disabled}
      className={className}
      style={style}
      onValueChange={(e: { value: unknown }) => onChange({ value: e.value })}
    >
      <PRSelect.Trigger style={{ width: '100%' }}>
        <PRSelect.Value placeholder={placeholder}>
          {selectedLabels || null}
        </PRSelect.Value>
        <PRSelect.Indicator>
          <ChevronDown />
        </PRSelect.Indicator>
      </PRSelect.Trigger>
      <PRSelect.Portal>
        <PRSelect.Positioner>
          <PRSelect.Popup>
            <PRSelect.List />
          </PRSelect.Popup>
        </PRSelect.Positioner>
      </PRSelect.Portal>
    </PRSelect.Root>
  );
}
