'use client';

import { Dropdown } from 'primereact/dropdown';
import { MultiSelect as PRMultiSelect } from 'primereact/multiselect';
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
  filter?: boolean;
  showClear?: boolean;
}

export function Select({
  value,
  options,
  onChange,
  placeholder,
  className,
  style,
  disabled,
  filter,
  showClear,
}: SelectProps) {
  return (
    <Dropdown
      value={value}
      options={options}
      onChange={(e) => onChange({ value: e.value })}
      placeholder={placeholder}
      className={className}
      style={style}
      disabled={disabled}
      filter={filter}
      showClear={showClear}
    />
  );
}

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
  return (
    <PRMultiSelect
      value={value}
      options={options}
      onChange={(e) => onChange({ value: e.value })}
      placeholder={placeholder}
      className={className}
      style={style}
      disabled={disabled}
      display="chip"
    />
  );
}
