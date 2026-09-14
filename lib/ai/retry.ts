import { classifyAIProviderError } from "@/lib/ai/provider-error";

/**
 * A single bounded retry for genuinely transient OpenAI failures (Phase 18
 * of the OpenAI production-readiness audit) — never more than one retry,
 * and never for a failure category that a retry cannot fix. Retrying a
 * missing/invalid API key, a rate limit, or a quota exhaustion just spends
 * a second call on a guaranteed-identical failure; only "timeout" and
 * "provider_error" (a 5xx from OpenAI itself) are genuinely worth one more
 * attempt. Deliberately no exponential backoff/jitter machinery — this is
 * one short, fixed delay, not a resilience framework.
 */
const RETRYABLE_CATEGORIES = new Set(["timeout", "provider_error"]);

export async function withBoundedRetry<T>(
  fn: () => Promise<T>,
  { retryDelayMs = 500 }: { retryDelayMs?: number } = {},
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (!RETRYABLE_CATEGORIES.has(classifyAIProviderError(error))) {
      throw error;
    }
    await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
    return fn();
  }
}
