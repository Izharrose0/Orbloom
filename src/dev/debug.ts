// Debug mode flag. True if URL has ?debug or we're in dev mode.
export const DEBUG_ENABLED =
  import.meta.env.DEV ||
  (typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('debug'));

// Tiny global registry so the debug panel can call into the scene (meteor shower etc).
declare global {
  interface Window {
    __orbloom?: {
      triggerMeteorShower?: () => void;
      spawnDrifterShape?: (shape: string) => void;
    };
  }
}
