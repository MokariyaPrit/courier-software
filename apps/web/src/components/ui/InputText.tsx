'use client';

import { InputText as PRInputText } from '@primereact/ui/inputtext';
import type {
  ChangeEvent,
  FocusEvent,
  InputHTMLAttributes,
  Ref,
} from 'react';

export interface AppInputTextProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size' | 'onChange' | 'onBlur'> {
  invalid?: boolean;
  fluid?: boolean;
  onChange?: (e: ChangeEvent<HTMLInputElement>) => void;
  onBlur?: (e: FocusEvent<HTMLInputElement>) => void;
  ref?: Ref<HTMLInputElement>;
}

export function InputText(props: AppInputTextProps) {
  return <PRInputText {...(props as object)} />;
}
