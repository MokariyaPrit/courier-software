const API_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';

/** Absolute URL for API-hosted uploads (logos, etc.). */
export function mediaUrl(path?: string | null): string {
  if (!path) return '';
  if (/^https?:\/\//i.test(path)) return path;
  const origin = API_URL.replace(/\/api\/v1\/?$/i, '');
  return `${origin}${path.startsWith('/') ? path : `/${path}`}`;
}
