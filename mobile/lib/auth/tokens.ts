import * as SecureStore from 'expo-secure-store';

const ACCESS_KEY = 'auth.access_token';
const REFRESH_KEY = 'auth.refresh_token';

export interface TokenPair {
  access: string;
  refresh: string;
}

export async function saveTokens(tokens: TokenPair): Promise<void> {
  await Promise.all([
    SecureStore.setItemAsync(ACCESS_KEY, tokens.access),
    SecureStore.setItemAsync(REFRESH_KEY, tokens.refresh),
  ]);
}

export async function getTokens(): Promise<TokenPair | null> {
  const [access, refresh] = await Promise.all([
    SecureStore.getItemAsync(ACCESS_KEY),
    SecureStore.getItemAsync(REFRESH_KEY),
  ]);
  if (!access || !refresh) return null;
  return { access, refresh };
}

export async function clearTokens(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(ACCESS_KEY),
    SecureStore.deleteItemAsync(REFRESH_KEY),
  ]);
}
