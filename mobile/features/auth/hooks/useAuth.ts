import { createContext, createElement, useContext, useEffect, useState, type ReactNode } from 'react';

import { setAccessToken } from '@/lib/api/client';
import { toAppError } from '@/lib/api/error';
import { clearTokens, getTokens, saveTokens } from '@/lib/auth/tokens';
import { setSyncState } from '@/lib/db/sync-state';

import { anonymous, refresh, type User } from '../api/auth.api';

interface AuthState {
  user: User | null;
  isReady: boolean;
  isAnonymous: boolean;
  error: string | null;
  retry: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setError(null);
      try {
        const existing = await getTokens();

        if (existing) {
          try {
            const r = await refresh(existing.refresh);
            await saveTokens({ access: r.accessToken, refresh: r.refreshToken });
            setAccessToken(r.accessToken);
          } catch {
            await clearTokens();
            setAccessToken(null);
          }
        }

        let currentTokens = await getTokens();
        let resolvedUser: User | null = null;

        if (!currentTokens) {
          const a = await anonymous();
          await saveTokens({ access: a.accessToken, refresh: a.refreshToken });
          setAccessToken(a.accessToken);
          resolvedUser = a.user;
          currentTokens = { access: a.accessToken, refresh: a.refreshToken };
        } else {
          setAccessToken(currentTokens.access);
        }

        if (!resolvedUser) {
          const stored = await getStoredUser();
          resolvedUser = stored;
        }

        if (resolvedUser) {
          await setSyncState('user_id', resolvedUser.id);
        }

        if (!cancelled) {
          setUser(resolvedUser);
          setIsReady(true);
        }
      } catch (e) {
        if (!cancelled) {
          setError(toAppError(e).message);
          setIsReady(true);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const value: AuthState = {
    user,
    isReady,
    isAnonymous: user?.isAnonymous ?? true,
    error,
    retry: () => {
      setIsReady(false);
      setAttempt((n) => n + 1);
    },
  };

  return createElement(AuthContext.Provider, { value }, children);
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}

async function getStoredUser(): Promise<User | null> {
  const { getSyncState } = await import('@/lib/db/sync-state');
  const id = await getSyncState('user_id');
  if (!id) return null;
  return {
    id,
    email: null,
    isAnonymous: true,
    status: 'anonymous',
    createdAt: '',
    updatedAt: null,
  };
}
