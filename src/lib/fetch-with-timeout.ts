/** 客户端「防卡住」默认超时：超时后 fetch 会 Abort，由调用方重试或提示 */
export const FETCH_LOAD_TIMEOUT_MS = 5000;

/**
 * 投票页大图：imgbb + Next 图片优化（`/_next/image`）在弱网或冷启动时可能明显超过 5s。
 * 若与 API 超时混用，会在 `onLoadingComplete` 前反复 `load()` 换题，表现为长时间只有「加载中」。
 */
export const IMAGE_DECODE_STALL_RETRY_MS = 28_000;

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
