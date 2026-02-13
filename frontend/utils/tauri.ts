/**
 * Check if running in Tauri environment
 */
export function isTauriAvailable(): boolean {
  return typeof window !== 'undefined' && window.__TAURI__ !== undefined;
}
