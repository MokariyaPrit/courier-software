/** App always uses Google Workspace / Gmail SMTP for outgoing mail. */
export const GMAIL_SMTP = {
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,
} as const;

/** Gmail app passwords are often pasted with spaces — strip them. */
export function normalizeGmailAppPassword(value: string) {
  return value.replace(/\s+/g, '');
}
