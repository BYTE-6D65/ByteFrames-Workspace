/**
 * Timeout wrapper for debugging hanging calls
 */

export function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  operation: string
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(
        () => reject(new Error(`Operation timed out after ${timeoutMs}ms: ${operation}`)),
        timeoutMs
      )
    )
  ])
}
