import { client } from '@/lib/api/client';

export interface User {
  id: string;
  email: string | null;
  isAnonymous: boolean;
  status: string;
  createdAt: string;
  updatedAt: string | null;
}

interface AuthResult {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: string;
  user: User;
}

interface RefreshResult {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: string;
}

export async function anonymous(): Promise<AuthResult> {
  const resp = await client.post<AuthResult>('/auth/anonymous');
  return resp.data;
}

export async function refresh(refreshToken: string): Promise<RefreshResult> {
  const resp = await client.post<RefreshResult>('/auth/refresh', { refreshToken });
  return resp.data;
}
