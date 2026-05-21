export type OutboxOp = 'create' | 'update' | 'delete';

export interface OutboxEntry {
  id: number;
  op: OutboxOp;
  favoriteId: string;
  payload: unknown;
  createdAt: string;
  attempts: number;
  lastError: string | null;
  lastAttemptedAt: string | null;
  blocked: boolean;
}

export interface FavoritePayload {
  id: string;
  displayName: string;
  namedayKey: string;
  birthDate: string | null;
  relationship: string | null;
  notes: string | null;
}
