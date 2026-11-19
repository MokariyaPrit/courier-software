import { UserInfo } from '../entities/user-info.entity';

export type PublicUserInfo = Omit<UserInfo, 'smtpPasswordEnc' | 'logoKey'> & {
  smtpConfigured: boolean;
  /** Signed CDN/view URL resolved at read time (not stored). */
  logoUrl?: string | null;
  smtpPasswordEnc?: never;
  logoKey?: never;
};

/** Strip secrets / storage keys; expose smtpConfigured for the client. */
export function sanitizeUserInfo(
  info: UserInfo | null | undefined,
): PublicUserInfo | null {
  if (!info) return null;
  const { smtpPasswordEnc: _, logoKey: __, ...rest } = info;
  return {
    ...rest,
    logoUrl: null,
    smtpConfigured: Boolean(
      info.smtpHost?.trim() &&
        info.smtpUser?.trim() &&
        info.smtpPasswordEnc?.trim(),
    ),
  };
}
