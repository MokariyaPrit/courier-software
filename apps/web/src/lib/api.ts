import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { apiErrorMessage, toastError, toastSuccess } from '@/lib/toast';

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';

type RetryConfig = InternalAxiosRequestConfig & {
  _retry?: boolean;
  /** Set true (or header X-Skip-Toast: 1) to suppress auto toasts */
  skipToast?: boolean;
  /** Override toast title (first line) */
  toastSummary?: string;
  /** Override toast description (second line) */
  toastDetail?: string;
};

export const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

function isAuthBootstrapUrl(url?: string) {
  const path = String(url || '');
  return (
    path.includes('/auth/login') ||
    path.includes('/auth/refresh') ||
    path.includes('/auth/logout')
  );
}

function shouldToast(config?: RetryConfig) {
  if (!config) return false;
  if (config.skipToast) return false;
  const skipHeader =
    config.headers?.['X-Skip-Toast'] ?? config.headers?.['x-skip-toast'];
  if (skipHeader === '1' || skipHeader === 1 || skipHeader === true) return false;
  if (isAuthBootstrapUrl(config.url)) return false;
  const method = String(config.method || 'get').toLowerCase();
  return ['post', 'put', 'patch', 'delete'].includes(method);
}

function normalizePath(url?: string) {
  if (!url) return '';
  try {
    if (url.startsWith('http')) return new URL(url).pathname;
  } catch {
    /* ignore */
  }
  return url.split('?')[0];
}

type ResourceInfo = { noun: string; createVerb: string };

function resolveResource(path: string): ResourceInfo {
  const p = path.toLowerCase();

  if (p.includes('/consignments')) {
    return { noun: 'Booking', createVerb: 'created' };
  }
  if (p.includes('/quotations') && p.includes('/issue')) {
    return { noun: 'Quotation', createVerb: 'issued' };
  }
  if (p.includes('/quotation-templates/cash')) {
    return { noun: 'Cash rates', createVerb: 'saved' };
  }
  if (p.includes('/quotation-templates')) {
    return { noun: 'Rate template', createVerb: 'saved' };
  }
  if (p.includes('/quotations')) {
    return { noun: 'Quotation', createVerb: 'saved' };
  }
  if (p.includes('/customers')) {
    return { noun: 'Party', createVerb: 'saved' };
  }
  if (p.includes('/receivers')) {
    return { noun: 'Receiver', createVerb: 'saved' };
  }
  if (p.includes('/sender-locations')) {
    return { noun: 'Centers', createVerb: 'saved' };
  }
  if (p.includes('/rate-columns')) {
    return { noun: 'Rate columns', createVerb: 'saved' };
  }
  if (p.includes('/courier-companies')) {
    return { noun: 'Courier company', createVerb: 'saved' };
  }
  if (p.includes('/states')) {
    return { noun: 'State', createVerb: 'saved' };
  }
  if (p.includes('/cities')) {
    return { noun: 'City', createVerb: 'saved' };
  }
  if (p.includes('/users')) {
    return { noun: 'User', createVerb: 'saved' };
  }
  if (p.includes('/billing/invoices/generate')) {
    return { noun: 'Bill', createVerb: 'generated' };
  }
  if (p.includes('/email') || p.includes('/smtp/test')) {
    return { noun: 'Email', createVerb: 'sent' };
  }
  if (p.includes('/billing') || p.includes('/invoices')) {
    return { noun: 'Invoice', createVerb: 'created' };
  }
  if (p.includes('/auth/profile')) {
    return { noun: 'Profile', createVerb: 'saved' };
  }
  return { noun: 'Record', createVerb: 'saved' };
}

function successToast(config: RetryConfig) {
  if (config.toastSummary || config.toastDetail) {
    return {
      summary: config.toastSummary || 'Success',
      detail: config.toastDetail,
    };
  }

  const method = String(config.method || '').toLowerCase();
  const path = normalizePath(config.url);
  const { noun, createVerb } = resolveResource(path);

  if (method === 'delete') {
    return {
      summary: 'Success',
      detail: `${noun} deleted successfully.`,
    };
  }
  if (method === 'post') {
    if (path.includes('/issue')) {
      return {
        summary: 'Success',
        detail: `${noun} issued successfully.`,
      };
    }
    return {
      summary: 'Success',
      detail: `${noun} ${createVerb} successfully.`,
    };
  }
  // put / patch
  return {
    summary: 'Success',
    detail: `${noun} updated successfully.`,
  };
}

function errorToast(config: RetryConfig | undefined, err: unknown) {
  const path = normalizePath(config?.url);
  const { noun } = resolveResource(path);
  const method = String(config?.method || '').toLowerCase();
  let action = 'save';
  if (method === 'delete') action = 'delete';
  else if (method === 'post' && path.includes('/issue')) action = 'issue';
  else if (method === 'post') action = 'create';
  else if (method === 'put' || method === 'patch') action = 'update';

  return {
    summary: 'Error',
    detail: apiErrorMessage(err, `Could not ${action} ${noun.toLowerCase()}.`),
  };
}

api.interceptors.response.use(
  (res) => {
    const config = res.config as RetryConfig;
    if (shouldToast(config)) {
      const msg = successToast(config);
      toastSuccess(msg.summary, msg.detail);
    }
    return res;
  },
  async (error: AxiosError) => {
    const original = error.config as RetryConfig | undefined;

    // Never try to refresh again on auth bootstrap endpoints (avoids refresh loops → 429)
    if (
      error.response?.status === 401 &&
      original &&
      !original._retry &&
      !isAuthBootstrapUrl(original.url)
    ) {
      original._retry = true;
      try {
        await api.post('/auth/refresh', undefined, { skipToast: true });
        return api(original);
      } catch {
        if (
          typeof window !== 'undefined' &&
          !window.location.pathname.startsWith('/login')
        ) {
          window.location.href = '/login';
        }
      }
    }

    if (shouldToast(original)) {
      const msg = errorToast(original, error);
      toastError(msg.summary, msg.detail);
    }

    return Promise.reject(error);
  },
);

export function unwrap<T>(payload: { data: T } | T): T {
  if (payload && typeof payload === 'object' && 'data' in payload) {
    return (payload as { data: T }).data;
  }
  return payload as T;
}
