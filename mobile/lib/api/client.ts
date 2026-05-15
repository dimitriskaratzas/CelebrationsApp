import axios, { AxiosError, type AxiosInstance, type InternalAxiosRequestConfig } from 'axios';

import { clearTokens, getTokens, saveTokens } from '@/lib/auth/tokens';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL;

if (!BASE_URL) {
  console.warn('EXPO_PUBLIC_API_URL is not set — API client will fail');
}

let accessTokenRef: string | null = null;

export function setAccessToken(token: string | null): void {
  accessTokenRef = token;
}

interface RetriableConfig extends InternalAxiosRequestConfig {
  _retried?: boolean;
}

let refreshInFlight: Promise<string | null> | null = null;

async function performRefresh(): Promise<string | null> {
  const tokens = await getTokens();
  if (!tokens) return null;

  try {
    const resp = await axios.post<{ accessToken: string; refreshToken: string }>(
      `${BASE_URL}/auth/refresh`,
      { refreshToken: tokens.refresh },
      { timeout: 15000 },
    );
    await saveTokens({ access: resp.data.accessToken, refresh: resp.data.refreshToken });
    accessTokenRef = resp.data.accessToken;
    return resp.data.accessToken;
  } catch {
    await clearTokens();
    accessTokenRef = null;
    return null;
  }
}

export const client: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  timeout: 30000,
});

client.interceptors.request.use((config) => {
  if (accessTokenRef) {
    config.headers.set('Authorization', `Bearer ${accessTokenRef}`);
  }
  return config;
});

client.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as RetriableConfig | undefined;
    const status = error.response?.status;

    if (status !== 401 || !original || original._retried) {
      return Promise.reject(error);
    }

    const url = original.url ?? '';
    if (url.includes('/auth/refresh') || url.includes('/auth/anonymous')) {
      return Promise.reject(error);
    }

    original._retried = true;

    refreshInFlight ??= performRefresh().finally(() => {
      refreshInFlight = null;
    });
    const newAccess = await refreshInFlight;

    if (!newAccess) {
      return Promise.reject(error);
    }

    original.headers.set('Authorization', `Bearer ${newAccess}`);
    return client.request(original);
  },
);
