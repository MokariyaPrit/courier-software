'use client';

import { ToggleSwitch as PRToggle } from '@primereact/ui/toggleswitch';

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
    <PRToggle.Root
      checked={checked}
      disabled={disabled}
      inputId={inputId}
      onCheckedChange={(e: { checked?: boolean }) =>
        onChange({ value: Boolean(e.checked) })
      }
    >
      <PRToggle.Control>
        <PRToggle.Handle />
      </PRToggle.Control>
    </PRToggle.Root>
  );
}
