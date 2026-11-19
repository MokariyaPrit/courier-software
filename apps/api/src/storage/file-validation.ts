export const ALLOWED_UPLOAD_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
] as const;

export type AllowedUploadMime = (typeof ALLOWED_UPLOAD_MIME_TYPES)[number];

const MAX_BATCH = 20;

export function isAllowedUploadMime(value: string): value is AllowedUploadMime {
  return (ALLOWED_UPLOAD_MIME_TYPES as readonly string[]).includes(
    value.toLowerCase(),
  );
}

export function sanitizeFileName(filename: string): string {
  const base = filename.split(/[/\\]/).pop() || '';
  const cleaned = base
    .replace(/[^\w.\- ()[\]]+/g, '_')
    .replace(/^\.+/, '')
    .trim();
  if (!cleaned || cleaned === '.' || cleaned === '..') {
    return 'file';
  }
  return cleaned.slice(0, 180);
}

export function extensionFromMime(mime: string): string {
  const m = mime.toLowerCase();
  if (m.includes('png')) return 'png';
  if (m.includes('webp')) return 'webp';
  if (m.includes('pdf')) return 'pdf';
  return 'jpg';
}

export function assertBatchSize(count: number) {
  if (count < 1) {
    throw new Error('At least one file is required');
  }
  if (count > MAX_BATCH) {
    throw new Error(`At most ${MAX_BATCH} files per request`);
  }
}
