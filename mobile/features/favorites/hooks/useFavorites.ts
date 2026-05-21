import { useCallback, useEffect, useState } from 'react';

import { on } from '@/lib/events';

import * as repo from '../db/favorites.repo';
import type { Favorite } from '../db/favorites.repo';

interface UseFavorites {
  favorites: Favorite[];
  loading: boolean;
  reload: () => Promise<void>;
}

export function useFavorites(): UseFavorites {
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    const list = await repo.listLive();
    setFavorites(list);
    setLoading(false);
  }, []);

  useEffect(() => {
    reload();
    const off = on('favorites:changed', () => {
      reload();
    });
    return off;
  }, [reload]);

  return { favorites, loading, reload };
}
