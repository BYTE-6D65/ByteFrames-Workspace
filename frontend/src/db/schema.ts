/**
 * Database schema - handled by Wails backend
 * This file is kept for compatibility but is now a no-op
 */

export async function initSchema(): Promise<void> {
  // Schema is initialized by the Go backend on startup
  return Promise.resolve();
}
