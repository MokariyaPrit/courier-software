import { api, unwrap } from '@/lib/api';

export type UploadedFile = {
  originalName: string;
  contentType: string;
  size: number;
  key: string;
};

type PresignItem = {
  key: string;
  uploadUrl: string;
  method: 'PUT';
  requiredHeaders: { 'Content-Type': string };
  expiresInSeconds: number;
  maxFileSizeBytes: number;
};

const DEFAULT_ALLOWED = [
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
];

const DEFAULT_MAX = 524288000;

function inferContentType(file: File): string {
  const typed = (file.type || '').toLowerCase().trim();
  if (typed) return typed;
  const name = file.name.toLowerCase();
  if (name.endsWith('.png')) return 'image/png';
  if (name.endsWith('.webp')) return 'image/webp';
  if (name.endsWith('.jpg') || name.endsWith('.jpeg')) return 'image/jpeg';
  if (name.endsWith('.pdf')) return 'application/pdf';
  return '';
}

async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;

  async function run() {
    while (next < items.length) {
      const index = next;
      next += 1;
      results[index] = await worker(items[index], index);
    }
  }

  const runners = Array.from(
    { length: Math.min(concurrency, items.length) },
    () => run(),
  );
  await Promise.all(runners);
  return results;
}

export async function uploadFiles(
  files: File[],
  options?: {
    concurrency?: number;
    allowedTypes?: string[];
    maxFileSizeBytes?: number;
  },
): Promise<UploadedFile[]> {
  if (!files.length) return [];

  const allowed = options?.allowedTypes || DEFAULT_ALLOWED;
  const maxSize = options?.maxFileSizeBytes ?? DEFAULT_MAX;
  const concurrency = options?.concurrency ?? 3;
  const maxMb = Math.round((maxSize / (1024 * 1024)) * 10) / 10;

  const prepared = files.map((file) => ({
    file,
    contentType: inferContentType(file),
  }));

  for (const { file, contentType } of prepared) {
    if (!allowed.includes(contentType)) {
      throw new Error(
        `Unsupported file type for ${file.name}. Use PNG, JPG, or WEBP.`,
      );
    }
    if (file.size <= 0) {
      throw new Error(`Empty file: ${file.name}`);
    }
    if (file.size > maxSize) {
      const sizeMb = Math.round((file.size / (1024 * 1024)) * 10) / 10;
      throw new Error(
        `${file.name} is ${sizeMb} MB. Maximum allowed size is ${maxMb} MB.`,
      );
    }
  }

  const res = await api.post(
    '/storage/generate-presigned-urls',
    prepared.map(({ file, contentType }) => ({
      filename: file.name,
      contentType,
      fileSize: file.size,
    })),
    { skipToast: true },
  );
  const slots = unwrap<PresignItem[]>(res.data);
  if (!Array.isArray(slots) || slots.length !== files.length) {
    throw new Error('Failed to generate upload URLs');
  }

  return mapPool(prepared, concurrency, async ({ file, contentType }, index) => {
    const slot = slots[index];
    let putRes: Response;
    try {
      putRes = await fetch(slot.uploadUrl, {
        method: 'PUT',
        headers: {
          'Content-Type':
            slot.requiredHeaders?.['Content-Type'] || contentType,
        },
        body: file,
      });
    } catch {
      throw new Error(
        `Could not upload ${file.name}. Check R2 CORS allows PUT from this site.`,
      );
    }
    if (!putRes.ok) {
      throw new Error(
        `Upload failed for ${file.name} (HTTP ${putRes.status}). Check R2 CORS / file size.`,
      );
    }
    return {
      originalName: file.name,
      contentType,
      size: file.size,
      key: slot.key,
    };
  });
}

export async function uploadFile(
  file: File,
  options?: {
    allowedTypes?: string[];
    maxFileSizeBytes?: number;
  },
): Promise<UploadedFile> {
  const [uploaded] = await uploadFiles([file], options);
  return uploaded;
}
