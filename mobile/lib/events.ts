type Listener = () => void;

const listeners = new Map<string, Set<Listener>>();

export function emit(event: string): void {
  const set = listeners.get(event);
  if (!set) return;
  for (const fn of set) fn();
}

export function on(event: string, fn: Listener): () => void {
  let set = listeners.get(event);
  if (!set) {
    set = new Set();
    listeners.set(event, set);
  }
  set.add(fn);
  return () => set!.delete(fn);
}
