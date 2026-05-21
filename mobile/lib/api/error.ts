import axios, { type AxiosError } from 'axios';

export interface AppError {
  code: string;
  message: string;
  status?: number;
}

// Forward-compatible across two backend error shapes:
//  - Legacy:        { error: "..."  }                 — pre-hardening backend.
//  - ProblemDetails: { title, code, type, status, ...} — RFC 7807, post-hardening backend.
interface BackendErrorBody {
  code?: string;
  message?: string;
  error?: string;
  title?: string;
  detail?: string;
  type?: string;
}

function extractCode(body: BackendErrorBody | undefined, status: number): string {
  if (body?.code) return body.code;
  // ProblemDetails `type` is "about:blank#CODE"; pull the fragment.
  if (body?.type) {
    const hash = body.type.indexOf('#');
    if (hash >= 0) return body.type.slice(hash + 1);
  }
  return `http_${status}`;
}

function extractMessage(body: BackendErrorBody | undefined, fallback: string): string {
  return body?.title ?? body?.message ?? body?.error ?? body?.detail ?? fallback;
}

export function toAppError(e: unknown): AppError {
  if (axios.isAxiosError(e)) {
    const axErr = e as AxiosError<BackendErrorBody>;
    const status = axErr.response?.status;
    const body = axErr.response?.data;

    if (status) {
      return {
        code: extractCode(body, status),
        message: extractMessage(body, axErr.message),
        status,
      };
    }

    if (axErr.code === 'ECONNABORTED') {
      return { code: 'timeout', message: 'Έληξε ο χρόνος σύνδεσης.' };
    }

    return { code: 'network', message: 'Δεν υπάρχει σύνδεση στο διαδίκτυο.' };
  }

  if (e instanceof Error) {
    return { code: 'unknown', message: e.message };
  }

  return { code: 'unknown', message: String(e) };
}
