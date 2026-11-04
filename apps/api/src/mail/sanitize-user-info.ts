import { UserInfo } from '../entities/user-info.entity';

export type PublicUserInfo = Omit<UserInfo, 'smtpPasswordEnc'> & {
  smtpConfigured: boolean;
  smtpPasswordEnc?: never;
};

/** Strip encrypted SMTP password; expose smtpConfigured for the client. */
export function sanitizeUserInfo(
  info: UserInfo | null | undefined,
): PublicUserInfo | null {
  if (!info) return null;
  const { smtpPasswordEnc: _, ...rest } = info;
  return {
    ...rest,
    smtpConfigured: Boolean(
      info.smtpHost?.trim() &&
        info.smtpUser?.trim() &&
        info.smtpPasswordEnc?.trim(),
    ),
  };
}
