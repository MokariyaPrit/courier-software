/** Trim string fields; keep non-strings as-is. Nested objects/arrays supported. */
export function trimFormData<T>(value: T): T {
  if (typeof value === 'string') {
    return value.trim() as T;
  }
  if (Array.isArray(value)) {
    return value.map((item) => trimFormData(item)) as T;
  }
  if (value && typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      result[key] = trimFormData(nested);
    }
    return result as T;
  }
  return value;
}
