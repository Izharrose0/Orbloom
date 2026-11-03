// First-time discoveries. Stored locally only (never in the save row), so this
// adds no schema change; losing it just means a caption may be shown again.

const KEY = 'orbloom.discoveries';

let cache: Set<string> | null = null;

function load(): Set<string> {
  if (cache) return cache;
  try {
    cache = new Set(JSON.parse(localStorage.getItem(KEY) ?? '[]'));
  } catch {
    cache = new Set();
  }
  return cache;
}

export function hasDiscovered(id: string): boolean {
  return load().has(id);
}

/** Marks `id` discovered. Returns true if it was new. */
export function discover(id: string): boolean {
  const set = load();
  if (set.has(id)) return false;
  set.add(id);
  try {
    localStorage.setItem(KEY, JSON.stringify([...set]));
  } catch {
    /* ignore quota */
  }
  return true;
}

export function discoveryCount(): number {
  return load().size;
}
