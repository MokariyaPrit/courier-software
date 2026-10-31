const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type FieldErrors = Record<string, string>;

export function validateEmail(value: string): string {
  const v = value.trim();
  if (!v) return 'email should not be empty';
  if (!EMAIL_RE.test(v)) return 'email must be an email';
  return '';
}

export function validateFullName(value: string): string {
  const v = value.trim();
  if (!v) return 'fullName should not be empty';
  if (v.length < 2) return 'fullName must be longer than or equal to 2 characters';
  return '';
}

/** Create: required. Edit: blank keeps old password. */
export function validatePassword(
  value: string,
  options?: { optional?: boolean },
): string {
  const v = value.trim();
  if (!v) {
    return options?.optional ? '' : 'password should not be empty';
  }
  if (v.length < 8) {
    return 'password must be longer than or equal to 8 characters';
  }
  return '';
}

export function firstError(errors: FieldErrors): string {
  const msg = Object.values(errors).find(Boolean);
  return msg || '';
}
