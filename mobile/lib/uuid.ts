// Prefer the Hermes/JSC native crypto.randomUUID when available (RN 0.74+ Hermes exposes it as a
// global), otherwise fall back to a Math.random()-based v4. The fallback isn't cryptographically
// secure but the IDs only need to be globally unique with very high probability — they're
// opaque keys to the server.

interface RandomUUIDCrypto {
  randomUUID?: () => string;
}

export function uuidv4(): string {
  const g = (globalThis as { crypto?: RandomUUIDCrypto }).crypto;
  if (g?.randomUUID) return g.randomUUID();

  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
