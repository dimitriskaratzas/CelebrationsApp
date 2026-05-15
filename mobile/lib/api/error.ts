import axios, { type AxiosError } from 'axios';

export interface AppError {
  code: string;
  message: string;
  status?: number;
}

interface BackendErrorBody {
  code?: string;
  message?: string;
  error?: string;
}

export function toAppError(e: unknown): AppError {
  if (axios.isAxiosError(e)) {
    const axErr = e as AxiosError<BackendErrorBody>;
    const status = axErr.response?.status;
    const body = axErr.response?.data;

    if (status) {
      return {
        code: body?.code ?? `http_${status}`,
        message: body?.message ?? body?.error ?? axErr.message,
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
