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

  for (const file of files) {
    const type = (file.type || '').toLowerCase();
    if (!allowed.includes(type)) {
      throw new Error(`Unsupported file type: ${file.type || file.name}`);
    }
    if (file.size <= 0) {
      throw new Error(`Empty file: ${file.name}`);
    }
    if (file.size > maxSize) {
      throw new Error(`File too large: ${file.name}`);
    }
  }

  const res = await api.post(
    '/storage/generate-presigned-urls',
    files.map((file) => ({
      filename: file.name,
      contentType: file.type,
      fileSize: file.size,
    })),
    { skipToast: true },
  );
  const slots = unwrap<PresignItem[]>(res.data);
  if (!Array.isArray(slots) || slots.length !== files.length) {
    throw new Error('Failed to generate upload URLs');
  }

  return mapPool(files, concurrency, async (file, index) => {
    const slot = slots[index];
    const putRes = await fetch(slot.uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Type':
          slot.requiredHeaders?.['Content-Type'] || file.type,
      },
      body: file,
    });
    if (!putRes.ok) {
      throw new Error(`Upload failed for ${file.name} (${putRes.status})`);
    }
    return {
      originalName: file.name,
      contentType: file.type,
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
