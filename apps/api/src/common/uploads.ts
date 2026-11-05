import { BadRequestException } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

export const UPLOADS_ROOT = path.join(process.cwd(), 'uploads');
export const LOGOS_DIR = path.join(UPLOADS_ROOT, 'logos');

const ALLOWED_EXT = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif']);

export function ensureUploadsDirs() {
  fs.mkdirSync(LOGOS_DIR, { recursive: true });
}

export function logoExtFromMime(mimetype: string): string {
  const map: Record<string, string> = {
    'image/png': '.png',
    'image/jpeg': '.jpg',
    'image/jpg': '.jpg',
    'image/webp': '.webp',
    'image/gif': '.gif',
  };
  const ext = map[mimetype.toLowerCase()];
  if (!ext) {
    throw new BadRequestException(
      'Logo must be a PNG, JPG, WEBP, or GIF image',
    );
  }
  return ext;
}

export function logoPublicPath(userId: string, ext: string) {
  return `/uploads/logos/${userId}${ext}`;
}

export function logoAbsolutePath(userId: string, ext: string) {
  return path.join(LOGOS_DIR, `${userId}${ext}`);
}

/** Remove any existing logo file for this user (any allowed extension). */
export function removeUserLogoFiles(userId: string) {
  for (const ext of ALLOWED_EXT) {
    const file = logoAbsolutePath(userId, ext);
    if (fs.existsSync(file)) {
      fs.unlinkSync(file);
    }
  }
}

export function writeUserLogo(
  userId: string,
  buffer: Buffer,
  mimetype: string,
): string {
  ensureUploadsDirs();
  const ext = logoExtFromMime(mimetype);
  removeUserLogoFiles(userId);
  const abs = logoAbsolutePath(userId, ext);
  fs.writeFileSync(abs, buffer);
  return logoPublicPath(userId, ext);
}
