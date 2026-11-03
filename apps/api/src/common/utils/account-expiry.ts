/** Local calendar YYYY-MM-DD */
export function localDateKey(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Normalize PG date / Date / string to YYYY-MM-DD */
export function toDateKey(value: unknown): string | null {
  if (value == null || value === '') return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return localDateKey(value);
  }
  const s = String(value);
  const m = s.match(/(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : null;
}

/**
 * Account is expired when today is after expiredOn.
 * Still allowed to log in on the expiry date itself.
 */
export function isAccountExpired(expiredOn: unknown): boolean {
  const key = toDateKey(expiredOn);
  if (!key) return false;
  return localDateKey() > key;
}
