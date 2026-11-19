import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  CopyObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'crypto';
import * as path from 'path';
import {
  assertBatchSize,
  extensionFromMime,
  isAllowedUploadMime,
  sanitizeFileName,
} from './file-validation';
import type { StoredFileDto } from './stored-file';

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
export class R2StorageService {
  private readonly logger = new Logger(R2StorageService.name);
  private readonly client: S3Client | null;
  private readonly bucket: string;
  private readonly publicBase: string;
  private readonly uploadExpirySeconds: number;
  private readonly viewExpirySeconds: number;
  private readonly maxFileSizeBytes: number;

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

    if (accountId && accessKeyId && secretAccessKey && bucket && endpoint) {
      this.client = new S3Client({
        region: 'auto',
        endpoint,
        credentials: { accessKeyId, secretAccessKey },
        forcePathStyle: true,
        // Avoid signing x-amz-checksum-* headers — they break browser PUT CORS on R2.
        requestChecksumCalculation: 'WHEN_REQUIRED',
        responseChecksumValidation: 'WHEN_REQUIRED',
      });
      this.logger.log(`R2 storage enabled (bucket=${bucket})`);
    } else {
      this.client = null;
      this.logger.warn(
        'R2 env incomplete — uploads disabled until R2_* vars are set',
      );
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
      let contentType = (item.contentType || '').trim().toLowerCase();
      const fileSize = Number(item.fileSize);

      if (!filename) {
        throw new BadRequestException('filename is required');
      }
      if (filename.includes('..') || filename.includes('\0')) {
        throw new BadRequestException('Invalid filename');
      }
      // Some browsers send an empty MIME for .jpg — infer from extension.
      if (!contentType) {
        const lower = filename.toLowerCase();
        if (lower.endsWith('.png')) contentType = 'image/png';
        else if (lower.endsWith('.webp')) contentType = 'image/webp';
        else if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) {
          contentType = 'image/jpeg';
        } else if (lower.endsWith('.pdf')) contentType = 'application/pdf';
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
   * Pass `meta` when caller already HEADed the object to avoid a second Class B op.
   */
  async promoteTempToFinal(
    tempKey: string,
    finalKey: string,
    userId: string,
    opts?: {
      maxBytes?: number;
      allowedMimePrefix?: string[];
      meta?: HeadObjectMeta;
    },
  ): Promise<string> {
    const from = (tempKey || '').replace(/^\/+/, '');
    const to = (finalKey || '').replace(/^\/+/, '');
    if (!from || !to) {
      throw new BadRequestException('Invalid storage key');
    }
    if (!this.isOwnedTempKey(from, userId)) {
      throw new BadRequestException('Invalid temporary upload key');
    }

    const meta = opts?.meta ?? (await this.headObject(from));
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
    const client = this.requireR2();
    return getSignedUrl(
      client,
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: normalized,
      }),
      { expiresIn: expires },
    );
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
    const client = this.requireR2();
    return getSignedUrl(
      client,
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: normalized,
        ResponseContentDisposition: disposition,
      }),
      { expiresIn: expires },
    );
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
      const client = this.requireR2();
      await client.send(
        new CopyObjectCommand({
          Bucket: this.bucket,
          Key: to,
          CopySource: encodeURI(`${this.bucket}/${from}`),
        }),
      );
      await this.deleteObject(from);
      return to;
    } catch (err) {
      this.logger.warn(`Move failed ${from} -> ${to}: ${String(err)}`);
      return null;
    }
  }

  async deleteObject(key: string | null | undefined): Promise<void> {
    const normalized = (key || '').replace(/^\/+/, '');
    if (!normalized) return;
    if (!this.client) return;

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
  }

  logoFinalKey(userId: string, contentType: string): string {
    const ext = extensionFromMime(contentType);
    return `logos/${userId}/logo-${randomUUID()}.${ext}`;
  }

  isR2ObjectKey(value: string | null | undefined): boolean {
    const v = (value || '').trim();
    if (!v) return false;
    if (/^https?:\/\//i.test(v)) return false;
    return (
      v.startsWith('logos/') ||
      v.startsWith('anjani/') ||
      v.startsWith('temp/') ||
      v.startsWith('archive/')
    );
  }

  /** Resolve DB object key to a browser CDN/signed URL. */
  async resolveMediaUrl(
    value: string | null | undefined,
  ): Promise<string | null> {
    const raw = (value || '').trim();
    if (!raw) return null;
    if (/^https?:\/\//i.test(raw)) return raw;
    if (!this.isR2ObjectKey(raw)) return null;
    const url = await this.getViewUrl(raw);
    return url || null;
  }
}
