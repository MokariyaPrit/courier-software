import 'axios';

declare module 'axios' {
  export interface AxiosRequestConfig {
    /** Suppress global success/error toasts for this request */
    skipToast?: boolean;
    /** Override toast title (first line) */
    toastSummary?: string;
    /** Override toast description (second line) */
    toastDetail?: string;
  }
}
