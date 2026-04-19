/**
 * Retry an async fetch-like call once on 5xx with jittered backoff.
 * 4xx is never retried (it's a client or auth problem — retrying won't fix it).
 * Network errors count as retryable.
 */

export async function fetchWithRetry(input, init, { baseMs = 500, jitterMs = 250, attempts = 2 } = {}) {
  let lastErr;
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(input, init);
      if (res.status < 500 || i === attempts - 1) return res;
      // 5xx: drain the body and retry
      res.body?.cancel?.();
    } catch (e) {
      lastErr = e;
      if (i === attempts - 1) throw e;
    }
    const sleep = baseMs * Math.pow(2, i) + Math.random() * jitterMs;
    await new Promise((r) => setTimeout(r, sleep));
  }
  if (lastErr) throw lastErr;
  // Unreachable — last iteration of loop either returned or threw.
  throw new Error("fetchWithRetry exhausted attempts");
}
