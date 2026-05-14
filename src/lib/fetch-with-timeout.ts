/** 客户端「防卡住」默认超时：超时后 fetch 会 Abort，由调用方重试或提示 */
export const FETCH_LOAD_TIMEOUT_MS = 5000;

export function isAbortError(e: unknown): boolean {
  return e instanceof DOMException && e.name === "AbortError";
}

/**
 * 带超时的 fetch；超时抛出 AbortError（与手动 abort 一致）。
 */
export async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit | undefined = undefined,
  timeoutMs: number = FETCH_LOAD_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}
