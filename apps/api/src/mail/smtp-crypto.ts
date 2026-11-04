import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';

const ALGO = 'aes-256-gcm';
const IV_LEN = 12;

function keyFromSecret(secret: string): Buffer {
  return createHash('sha256').update(secret).digest();
}

export function resolveSmtpCryptoSecret(
  smtpCryptoSecret?: string | null,
  jwtAccessSecret?: string | null,
): string {
  const secret = (smtpCryptoSecret || jwtAccessSecret || '').trim();
  if (!secret) {
    throw new Error('SMTP_CRYPTO_SECRET or JWT_ACCESS_SECRET is required');
  }
  return secret;
}

/** Encrypt plaintext SMTP password → `iv:tag:ciphertext` (hex parts). */
export function encryptSmtpPassword(plaintext: string, secret: string): string {
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, keyFromSecret(secret), iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
}

export function decryptSmtpPassword(payload: string, secret: string): string {
  const parts = payload.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted SMTP password');
  }
  const [ivHex, tagHex, dataHex] = parts;
  const iv = Buffer.from(ivHex, 'hex');
  const tag = Buffer.from(tagHex, 'hex');
  const data = Buffer.from(dataHex, 'hex');
  const decipher = createDecipheriv(ALGO, keyFromSecret(secret), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString(
    'utf8',
  );
}
