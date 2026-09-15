import { classifyAIProviderError } from "@/lib/ai/provider-error";

/**
 * Minimal, production-grade AI usage observability (Phase 20 of the OpenAI
 * production-readiness audit). Deliberately NOT a billing system — a single
 * structured console log line per call, greppable by businessId/employeeId/
 * model, mirroring the pattern mastra/workflows/outreach-research-pipeline.ts
 * already used for the Outreach research pipeline (extracted here so the
 * other AI employee routes can use the same shape instead of inventing
 * their own).
 *
 * Never pass the customer's message, the model's response text, or any
 * other prompt content into `entry` — only counts, durations, and the
 * already-tenant-scoped identifiers below.
 */
export function logAIUsage(entry: {
  feature:
    | "receptionist"
    | "sales"
    | "customer_support"
    | "general_manager"
    | "outreach"
    | "outreach_research"
    | "executive_briefing"
    | "command_center_qa"
    | "website_chat"
    | "marketing"
    | "appointment"
    | "accountant"
    | "finance"
    | "hr"
    | "operations"
    | "custom";
  businessId: string;
  employeeId?: string | null;
  model: string;
  durationMs: number;
  outcome: "success" | "error";
  errorCategory?: string;
  tokens?: {
    input?: number;
    output?: number;
    total?: number;
  } | null;
}) {
  console.log(
    JSON.stringify({
      event: "kuba_ai_usage",
      timestamp: new Date().toISOString(),
      ...entry,
    }),
  );
}

/**
 * Wraps a single AI provider call with duration timing, success/error usage
 * logging (via logAIUsage), and safe error classification — so every
 * OpenAI-calling route gets the same observability and the same never-leak-
 * raw-provider-detail behavior without repeating the try/catch/log
 * boilerplate. The raw error is still returned to the caller (as `error` on
 * the rejected case) so route-specific handling/messaging is unaffected;
 * this only adds logging around the call.
 */
export async function withAIUsageLogging<T>(
  entry: Omit<Parameters<typeof logAIUsage>[0], "durationMs" | "outcome" | "errorCategory">,
  fn: () => Promise<T>,
): Promise<T> {
  const startedAt = Date.now();
  try {
    const result = await fn();
    logAIUsage({ ...entry, durationMs: Date.now() - startedAt, outcome: "success" });
    return result;
  } catch (error) {
    const errorCategory = classifyAIProviderError(error);
    logAIUsage({
      ...entry,
      durationMs: Date.now() - startedAt,
      outcome: "error",
      errorCategory,
    });
    throw error;
  }
}
