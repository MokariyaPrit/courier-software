const R2_CDN =
  process.env.NEXT_PUBLIC_R2_PUBLIC_BASE_URL ||
  'https://cdn.couriersync.in';

/** Browser URL for an R2 object key or absolute https URL. */
export function mediaUrl(path?: string | null): string {
  if (!path) return '';
  if (/^https?:\/\//i.test(path)) return path;
  if (/^(logos|anjani|temp|archive)\//i.test(path)) {
    return `${R2_CDN.replace(/\/$/, '')}/${path.replace(/^\//, '')}`;
  }
  return '';
}
