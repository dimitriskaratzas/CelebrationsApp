import NetInfo from '@react-native-community/netinfo';
import { createContext, createElement, useContext, useEffect, useState, type ReactNode } from 'react';

import { setAccessToken } from '@/lib/api/client';
import { toAppError } from '@/lib/api/error';
import { clearTokens, getTokens, saveTokens } from '@/lib/auth/tokens';
import { getSyncState, setSyncState } from '@/lib/db/sync-state';

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

      // Fast path: existing tokens. Surface the app immediately from cached state and
      // refresh in the background. A network or 5xx failure during refresh is NOT a
      // reason to clear tokens — only an actual 401 from the server is.
      const existing = await getTokens();
      if (existing) {
        setAccessToken(existing.access);
        const stored = await getStoredUser();
        if (!cancelled) {
          setUser(stored);
          setIsReady(true);
        }

        // Background refresh — best effort, no UI block.
        try {
          const r = await refresh(existing.refresh);
          if (cancelled) return;
          await saveTokens({ access: r.accessToken, refresh: r.refreshToken });
          setAccessToken(r.accessToken);
        } catch (e) {
          const err = toAppError(e);
          if (err.status === 401) {
            // Refresh token rejected by server. Force re-auth on next opportunity by
            // clearing tokens; the response interceptor on the next request will then
            // fall through to a 401 which the user can recover from via UI.
            await clearTokens();
            setAccessToken(null);
          }
          // Network / 5xx / timeout: keep the existing access token. Sync will retry.
        }
        return;
      }

      // Slow path: no tokens. We have to anonymous-auth before the app is usable, so
      // this one blocks boot. If it fails, surface the error screen with auto-retry.
      try {
        const a = await anonymous();
        if (cancelled) return;
        await saveTokens({ access: a.accessToken, refresh: a.refreshToken });
        setAccessToken(a.accessToken);
        await setSyncState('user_id', a.user.id);
        if (!cancelled) {
          setUser(a.user);
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

  // Auto-retry when connectivity is restored, but only while we're in the error
  // state (no user resolved). Once the user is in the app, the sync engine handles
  // its own NetInfo events — we don't want to re-run the auth flow.
  useEffect(() => {
    if (!error || user) return;
    const sub = NetInfo.addEventListener((state) => {
      if (state.isConnected) {
        setIsReady(false);
        setAttempt((n) => n + 1);
      }
    });
    return () => sub();
  }, [error, user]);

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
