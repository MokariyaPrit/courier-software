/** Display name for a record's creating branch manager / user. */
export function ownerDisplayName(createdBy?: {
  email?: string | null;
  userInfo?: { fullName?: string | null } | null;
} | null): string {
  return createdBy?.userInfo?.fullName || createdBy?.email || '—';
}
