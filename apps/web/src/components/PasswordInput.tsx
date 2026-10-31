'use client';

import { InputText } from 'primereact/inputtext';
import { FocusEvent, useState } from 'react';

interface PasswordInputProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: (e: FocusEvent<HTMLInputElement>) => void;
  invalid?: boolean;
  placeholder?: string;
  autoComplete?: string;
  disabled?: boolean;
}

/** Stable password field with show/hide — avoids PrimeReact Password toggleMask reset bugs */
export function PasswordInput({
  id,
  value,
  onChange,
  onBlur,
  invalid,
  placeholder,
  autoComplete = 'new-password',
  disabled,
}: PasswordInputProps) {
  const [visible, setVisible] = useState(false);

  return (
    <div className={`password-input${invalid ? ' is-invalid' : ''}`}>
      <InputText
        id={id}
        type={visible ? 'text' : 'password'}
        value={value}
        disabled={disabled}
        placeholder={placeholder}
        autoComplete={autoComplete}
        className={invalid ? 'p-invalid' : undefined}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        style={{ width: '100%' }}
      />
      <button
        type="button"
        className="password-toggle"
        tabIndex={-1}
        aria-label={visible ? 'Hide password' : 'Show password'}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => setVisible((v) => !v)}
      >
        <i className={`pi ${visible ? 'pi-eye-slash' : 'pi-eye'}`} />
      </button>
    </div>
  );
}
