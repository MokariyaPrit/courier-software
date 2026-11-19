import {
  BadRequestException,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  CopyObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { UPLOADS_ROOT, ensureUploadsDirs } from '../common/uploads';
import {
  assertBatchSize,
  extensionFromMime,
  isAllowedUploadMime,
  sanitizeFileName,
} from './file-validation';
import type { StoredFileDto } from './stored-file';

export type StoredObject = {
  key: string;
  /** Legacy public/local URL if available. */
  url: string;
};

export type PresignUploadItem = {
  filename: string;
  contentType: string;
  fileSize: number;
};

export type PresignUploadResult = {
  key: string;
  uploadUrl: string;
  method: 'PUT';
  requiredHeaders: { 'Content-Type': string };
  expiresInSeconds: number;
  expiresInMinutes: number;
  maxFileSizeBytes: number;
};

export type HeadObjectMeta = {
  key: string;
  contentLength: number;
  contentType: string | null;
};

@Injectable()
export class R2StorageService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(R2StorageService.name);
  private readonly client: S3Client | null;
  private readonly bucket: string;
  private readonly publicBase: string;
  private readonly localFallback: boolean;
  private readonly uploadExpirySeconds: number;
  private readonly viewExpirySeconds: number;
  private readonly maxFileSizeBytes: number;
  private readonly tempCleanupAgeMs: number;
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;

  constructor(private readonly config: ConfigService) {
    const accountId = (config.get<string>('R2_ACCOUNT_ID') || '').trim();
    const accessKeyId = (config.get<string>('R2_ACCESS_KEY_ID') || '').trim();
    const secretAccessKey = (
      config.get<string>('R2_SECRET_ACCESS_KEY') || ''
    ).trim();
    const bucket = (config.get<string>('R2_BUCKET') || '').trim();
    const endpoint =
      (config.get<string>('R2_ENDPOINT') || '').trim() ||
      (accountId
        ? `https://${accountId}.r2.cloudflarestorage.com`
        : '');

    this.bucket = bucket;
    this.publicBase = (config.get<string>('R2_PUBLIC_BASE_URL') || '')
      .trim()
      .replace(/\/$/, '');
    this.uploadExpirySeconds = Math.max(
      60,
      Number(config.get('R2_PRESIGNED_URL_EXPIRY') || 600) || 600,
    );
    this.viewExpirySeconds = Math.max(
      60,
      Number(config.get('R2_SIGNED_GET_EXPIRY') || 3600) || 3600,
    );
    this.maxFileSizeBytes = Math.max(
      1024,
      Number(config.get('R2_MAX_FILE_SIZE') || 524288000) || 524288000,
    );
    const cleanupHours = Math.max(
      1,
      Number(config.get('R2_TEMP_CLEANUP_AGE_HOURS') || 24) || 24,
    );
    this.tempCleanupAgeMs = cleanupHours * 60 * 60 * 1000;

    if (accountId && accessKeyId && secretAccessKey && bucket && endpoint) {
      this.client = new S3Client({
        region: 'auto',
        endpoint,
        credentials: { accessKeyId, secretAccessKey },
        forcePathStyle: true,
      });
      this.localFallback = false;
      this.logger.log(`R2 storage enabled (bucket=${bucket})`);
    } else {
      this.client = null;
      this.localFallback = true;
      ensureUploadsDirs();
      this.logger.warn(
        'R2 env incomplete — using local uploads/ fallback for Anjani files',
      );
    }
  }

  onModuleInit() {
    if (!this.client) return;
    // Run shortly after boot, then every 6 hours.
    void this.purgeExpiredTempObjects().catch((err) =>
      this.logger.warn(`Temp cleanup failed: ${String(err)}`),
    );
    this.cleanupTimer = setInterval(
      () => {
        void this.purgeExpiredTempObjects().catch((err) =>
          this.logger.warn(`Temp cleanup failed: ${String(err)}`),
        );
      },
      6 * 60 * 60 * 1000,
    );
  }

  onModuleDestroy() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }

  isR2Enabled() {
    return Boolean(this.client);
  }

  getMaxFileSizeBytes() {
    return this.maxFileSizeBytes;
  }

  requireR2() {
    if (!this.client) {
      throw new ServiceUnavailableException(
        'Cloudflare R2 is not configured. Set R2_* env vars to enable uploads.',
      );
    }
    return this.client;
  }

  buildTempKey(userId: string, filename: string): string {
    const safeName = sanitizeFileName(filename);
    return `temp/${userId}/${randomUUID()}-${safeName}`;
  }

  isOwnedTempKey(key: string, userId: string): boolean {
    const normalized = key.replace(/^\/+/, '');
    return normalized.startsWith(`temp/${userId}/`);
  }

  isOwnedFinalPrefix(key: string, prefixes: string[]): boolean {
    const normalized = key.replace(/^\/+/, '');
    return prefixes.some((p) => normalized.startsWith(p.replace(/^\/+/, '')));
  }

  async createPresignedUploadUrls(
    items: PresignUploadItem[],
    userId: string,
  ): Promise<PresignUploadResult[]> {
    const client = this.requireR2();
    try {
      assertBatchSize(items.length);
    } catch (err) {
      throw new BadRequestException(String(err instanceof Error ? err.message : err));
    }

    const results: PresignUploadResult[] = [];
    for (const item of items) {
      const filename = (item.filename || '').trim();
      const contentType = (item.contentType || '').trim().toLowerCase();
      const fileSize = Number(item.fileSize);

      if (!filename) {
        throw new BadRequestException('filename is required');
      }
      if (filename.includes('..') || filename.includes('\0')) {
        throw new BadRequestException('Invalid filename');
      }
      if (!isAllowedUploadMime(contentType)) {
        throw new BadRequestException(
          `Unsupported contentType: ${contentType || '(empty)'}`,
        );
      }
      if (!Number.isFinite(fileSize) || fileSize <= 0) {
        throw new BadRequestException('fileSize must be a positive number');
      }
      if (fileSize > this.maxFileSizeBytes) {
        throw new BadRequestException(
          `File exceeds max size of ${this.maxFileSizeBytes} bytes`,
        );
      }

      const key = this.buildTempKey(userId, filename);
      const uploadUrl = await getSignedUrl(
        client,
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          ContentType: contentType,
        }),
        { expiresIn: this.uploadExpirySeconds },
      );

      results.push({
        key,
        uploadUrl,
        method: 'PUT',
        requiredHeaders: { 'Content-Type': contentType },
        expiresInSeconds: this.uploadExpirySeconds,
        expiresInMinutes: Math.round(this.uploadExpirySeconds / 60),
        maxFileSizeBytes: this.maxFileSizeBytes,
      });
    }
    return results;
  }

  async headObject(key: string): Promise<HeadObjectMeta> {
    const client = this.requireR2();
    const normalized = key.replace(/^\/+/, '');
    if (!normalized) {
      throw new BadRequestException('Object key is required');
    }
    try {
      const res = await client.send(
        new HeadObjectCommand({
          Bucket: this.bucket,
          Key: normalized,
        }),
      );
      return {
        key: normalized,
        contentLength: Number(res.ContentLength || 0),
        contentType: res.ContentType || null,
      };
    } catch {
      throw new BadRequestException('Uploaded file not found in storage');
    }
  }

  /**
   * Verify a temp upload exists and belongs to the user, then move to final key.
   */
  async promoteTempToFinal(
    tempKey: string,
    finalKey: string,
    userId: string,
    opts?: { maxBytes?: number; allowedMimePrefix?: string[] },
  ): Promise<string> {
    const from = (tempKey || '').replace(/^\/+/, '');
    const to = (finalKey || '').replace(/^\/+/, '');
    if (!from || !to) {
      throw new BadRequestException('Invalid storage key');
    }
    if (!this.isOwnedTempKey(from, userId)) {
      throw new BadRequestException('Invalid temporary upload key');
    }

    const meta = await this.headObject(from);
    if (opts?.maxBytes && meta.contentLength > opts.maxBytes) {
      throw new BadRequestException('Uploaded file is too large');
    }
    if (opts?.allowedMimePrefix?.length && meta.contentType) {
      const ok = opts.allowedMimePrefix.some((p) =>
        meta.contentType!.toLowerCase().startsWith(p.toLowerCase()),
      );
      if (!ok) {
        throw new BadRequestException(
          `Unexpected content type: ${meta.contentType}`,
        );
      }
    }

    const moved = await this.moveObject(from, to);
    if (!moved) {
      throw new BadRequestException('Failed to finalize uploaded file');
    }
    return moved;
  }

  /**
   * Accept temp key (promote) or already-final owned key (HEAD verify).
   */
  async resolveUploadKey(
    key: string | null | undefined,
    userId: string,
    finalKey: string,
    ownedFinalPrefixes: string[],
    opts?: { maxBytes?: number; allowedMimePrefix?: string[] },
  ): Promise<string | null> {
    const normalized = (key || '').replace(/^\/+/, '');
    if (!normalized) return null;

    if (this.isOwnedTempKey(normalized, userId)) {
      return this.promoteTempToFinal(normalized, finalKey, userId, opts);
    }

    if (
      normalized === finalKey.replace(/^\/+/, '') ||
      this.isOwnedFinalPrefix(normalized, ownedFinalPrefixes)
    ) {
      await this.headObject(normalized);
      return normalized;
    }

    throw new BadRequestException('Invalid file key for this account');
  }

  async getViewUrl(key: string, expiresInSeconds?: number): Promise<string> {
    const normalized = key.replace(/^\/+/, '');
    if (!normalized) return '';

    // Prefer custom CDN so responses never expose the R2 bucket name.
    if (this.publicBase) {
      return this.publicUrlFor(normalized);
    }

    const expires = expiresInSeconds ?? this.viewExpirySeconds;
    if (this.client) {
      return getSignedUrl(
        this.client,
        new GetObjectCommand({
          Bucket: this.bucket,
          Key: normalized,
        }),
        { expiresIn: expires },
      );
    }

    return `/uploads/${normalized}`;
  }

  async getDownloadUrl(
    key: string,
    fileLabel?: string | null,
    expiresInSeconds?: number,
  ): Promise<string> {
    const normalized = key.replace(/^\/+/, '');
    if (!normalized) return '';
    const filename = sanitizeFileName(fileLabel || path.basename(normalized));
    const disposition = `attachment; filename="${filename.replace(/"/g, '')}"`;

    // CDN URL hides bucket name (same pattern as signedUrl + download hint).
    if (this.publicBase) {
      const base = this.publicUrlFor(normalized);
      return `${base}?response-content-disposition=${encodeURIComponent(disposition)}`;
    }

    const expires = expiresInSeconds ?? this.viewExpirySeconds;
    if (this.client) {
      return getSignedUrl(
        this.client,
        new GetObjectCommand({
          Bucket: this.bucket,
          Key: normalized,
          ResponseContentDisposition: disposition,
        }),
        { expiresIn: expires },
      );
    }

    return `/uploads/${normalized}`;
  }

  /** @deprecated Prefer getViewUrl for private objects. */
  async getSignedDownloadUrl(
    key: string,
    expiresInSeconds = 3600,
  ): Promise<string> {
    return this.getViewUrl(key, expiresInSeconds);
  }

  async toStoredFile(
    key: string | null | undefined,
    fileLabel?: string | null,
  ): Promise<StoredFileDto | null> {
    const normalized = (key || '').replace(/^\/+/, '');
    if (!normalized) return null;
    const [signedUrl, downloadUrl] = await Promise.all([
      this.getViewUrl(normalized),
      this.getDownloadUrl(normalized, fileLabel),
    ]);
    return {
      key: normalized,
      fileLabel: fileLabel || null,
      signedUrl,
      downloadUrl,
    };
  }

  private publicUrlFor(key: string): string {
    if (!this.publicBase) return '';
    return `${this.publicBase}/${key.replace(/^\//, '')}`;
  }

  async putObject(
    key: string,
    body: Buffer,
    contentType: string,
  ): Promise<StoredObject> {
    const normalized = key.replace(/^\/+/, '');

    if (this.client) {
      await this.client.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: normalized,
          Body: body,
          ContentType: contentType,
        }),
      );
      return { key: normalized, url: this.publicUrlFor(normalized) };
    }

    const abs = path.join(UPLOADS_ROOT, normalized);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, body);
    return { key: normalized, url: `/uploads/${normalized}` };
  }

  /**
   * Move any live object under the single `archive/` prefix.
   * Examples:
   * - logos/u/logo.png → archive/logos/u/logo.png
   * - anjani/u/b/source.pdf → archive/anjani/u/b/source.pdf
   */
  toArchiveKey(key: string): string {
    const normalized = key.replace(/^\/+/, '');
    if (!normalized) return '';
    if (normalized.startsWith('archive/')) return normalized;
    return `archive/${normalized}`;
  }

  async archiveObject(key: string | null | undefined): Promise<string | null> {
    const normalized = (key || '').replace(/^\/+/, '');
    if (!normalized) return null;
    if (normalized.startsWith('archive/')) return normalized;
    return this.moveObject(normalized, this.toArchiveKey(normalized));
  }

  /** Copy into another key, then remove the original. Returns the new key. */
  async moveObject(fromKey: string, toKey: string): Promise<string | null> {
    const from = (fromKey || '').replace(/^\/+/, '');
    const to = (toKey || '').replace(/^\/+/, '');
    if (!from || !to) return null;
    if (from === to) return to;

    try {
      if (this.client) {
        await this.client.send(
          new CopyObjectCommand({
            Bucket: this.bucket,
            Key: to,
            CopySource: encodeURI(`${this.bucket}/${from}`),
          }),
        );
        await this.deleteObject(from);
        return to;
      }

      const src = path.join(UPLOADS_ROOT, from);
      if (!fs.existsSync(src)) return null;
      const dest = path.join(UPLOADS_ROOT, to);
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.renameSync(src, dest);
      return to;
    } catch (err) {
      this.logger.warn(`Move failed ${from} -> ${to}: ${String(err)}`);
      return null;
    }
  }

  async deleteObject(key: string | null | undefined): Promise<void> {
    const normalized = (key || '').replace(/^\/+/, '');
    if (!normalized) return;

    if (this.client) {
      try {
        await this.client.send(
          new DeleteObjectCommand({
            Bucket: this.bucket,
            Key: normalized,
          }),
        );
      } catch (err) {
        this.logger.warn(`R2 delete failed for ${normalized}: ${String(err)}`);
      }
      return;
    }

    const abs = path.join(UPLOADS_ROOT, normalized);
    if (fs.existsSync(abs)) fs.unlinkSync(abs);
  }

  async purgeExpiredTempObjects(): Promise<{ deleted: number }> {
    if (!this.client) return { deleted: 0 };
    const cutoff = Date.now() - this.tempCleanupAgeMs;
    let deleted = 0;
    let continuationToken: string | undefined;

    do {
      const page = await this.client.send(
        new ListObjectsV2Command({
          Bucket: this.bucket,
          Prefix: 'temp/',
          ContinuationToken: continuationToken,
          MaxKeys: 100,
        }),
      );

      for (const obj of page.Contents || []) {
        if (!obj.Key || !obj.LastModified) continue;
        if (obj.LastModified.getTime() > cutoff) continue;
        await this.deleteObject(obj.Key);
        deleted += 1;
      }

      continuationToken = page.IsTruncated
        ? page.NextContinuationToken
        : undefined;
    } while (continuationToken);

    if (deleted > 0) {
      this.logger.log(`Purged ${deleted} expired temp/ object(s)`);
    }
    return { deleted };
  }

  logoFinalKey(userId: string, contentType: string): string {
    const ext = extensionFromMime(contentType);
    return `logos/${userId}/logo-${randomUUID()}.${ext}`;
  }

  isR2ObjectKey(value: string | null | undefined): boolean {
    const v = (value || '').trim();
    if (!v) return false;
    if (/^https?:\/\//i.test(v)) return false;
    if (v.startsWith('/uploads/')) return false;
    return (
      v.startsWith('logos/') ||
      v.startsWith('anjani/') ||
      v.startsWith('temp/') ||
      v.startsWith('archive/')
    );
  }
}
