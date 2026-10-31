'use client';

import { Textarea as PRTextarea } from '@primereact/ui/textarea';
import type { ChangeEvent, TextareaHTMLAttributes } from 'react';

export interface AppTextareaProps
  extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'onChange'> {
  invalid?: boolean;
  autoResize?: boolean;
  onChange?: (e: ChangeEvent<HTMLTextAreaElement>) => void;
}

export function Textarea(props: AppTextareaProps) {
  return <PRTextarea {...(props as object)} />;
}
