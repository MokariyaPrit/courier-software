'use client';

import { InputSwitch } from 'primereact/inputswitch';

interface ToggleSwitchProps {
  checked: boolean;
  onChange: (e: { value: boolean }) => void;
  disabled?: boolean;
  inputId?: string;
}

export function ToggleSwitch({
  checked,
  onChange,
  disabled,
  inputId,
}: ToggleSwitchProps) {
  return (
    <InputSwitch
      checked={checked}
      disabled={disabled}
      inputId={inputId}
      onChange={(e) => onChange({ value: Boolean(e.value) })}
    />
  );
}
