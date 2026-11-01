export type ToastSeverity = 'success' | 'info' | 'warn' | 'error';

export type ToastShowOptions = {
  severity?: ToastSeverity;
  summary: string;
  detail?: string;
  life?: number;
};

type ToastShowFn = (opts: ToastShowOptions) => void;

let showFn: ToastShowFn | null = null;

export function registerToast(fn: ToastShowFn | null) {
  showFn = fn;
}

export function showToast(opts: ToastShowOptions) {
  if (typeof window === 'undefined') return;
  showFn?.(opts);
}

export function toastSuccess(summary: string, detail?: string) {
  showToast({ severity: 'success', summary, detail, life: 3000 });
}

export function toastError(summary: string, detail?: string) {
  showToast({ severity: 'error', summary, detail, life: 6000 });
}

export function toastInfo(summary: string, detail?: string) {
  showToast({ severity: 'info', summary, detail, life: 3500 });
}

export function apiErrorMessage(err: unknown, fallback = 'Something went wrong') {
  const data = (
    err as {
      response?: {
        data?: {
          error?: { message?: string | string[] };
          message?: string | string[];
        };
      };
      message?: string;
    }
  )?.response?.data;
  const raw =
    data?.error?.message ??
    data?.message ??
    (err as { message?: string })?.message;
  if (Array.isArray(raw)) return raw.join(', ');
  if (typeof raw === 'string' && raw.trim()) return raw;
  return fallback;
}
