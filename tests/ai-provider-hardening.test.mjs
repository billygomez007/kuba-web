// Regression suite for the OpenAI production-readiness audit's new shared
// infrastructure: centralized model config (Phase 4), provider error
// classification (Phase 19), bounded retry (Phase 18), and usage logging
// (Phase 20). No live OpenAI network calls — the AI SDK's own error
// classes are constructed directly to exercise the classifier, matching
// "mock provider boundaries, don't depend on live network calls."
import { register } from "node:module";
import { pathToFileURL } from "node:url";
import { readFile } from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
import test from "node:test";

const REPO_ROOT = path.resolve(new URL("..", import.meta.url).pathname);
register(pathToFileURL(path.join(REPO_ROOT, "tests/helpers/alias-loader.mjs")));

async function readSource(relativePath) {
  return readFile(path.join(REPO_ROOT, relativePath), "utf8");
}

// ---- Phase 4: centralized model configuration ----

test("model-config centralizes the exact current model choices — no silent change (gpt-4o for chat agents, gpt-4o-mini for executive/summarization)", async () => {
  const { DEFAULT_CHAT_MODEL_ID, EXECUTIVE_MODEL_ID, REALTIME_MODEL_ID, REALTIME_VOICE } = await import("@/lib/ai/model-config");
  assert.equal(DEFAULT_CHAT_MODEL_ID, "gpt-4o");
  assert.equal(EXECUTIVE_MODEL_ID, "gpt-4o-mini");
  assert.equal(REALTIME_MODEL_ID, "gpt-realtime");
  assert.equal(REALTIME_VOICE, "alloy");
});

test("model-config reads its defaults from an environment override with a fallback to the current real value — verified against source, since the module already evaluated its top-level env read once at first import in this process", async () => {
  const source = await readSource("lib/ai/model-config.ts");
  assert.match(source, /process\.env\.AI_DEFAULT_CHAT_MODEL\s*\|\|\s*["']gpt-4o["']/);
  assert.match(source, /process\.env\.AI_EXECUTIVE_MODEL\s*\|\|\s*["']gpt-4o-mini["']/);
});

test("REGRESSION: no Mastra agent hardcodes a model string inline anymore — every conversational agent imports defaultChatModel() from the centralized config", async () => {
  const agentFiles = [
    "mastra/agents/receptionist.ts",
    "mastra/agents/sales.ts",
    "mastra/agents/customer-support.ts",
    "mastra/agents/general-manager.ts",
    "mastra/agents/outreach.ts",
    "mastra/agents/outreach-researcher.ts",
  ];
  for (const file of agentFiles) {
    const source = await readSource(file);
    assert.doesNotMatch(source, /openai\(\s*["']gpt-4o["']\s*\)/, `${file} must not hardcode openai("gpt-4o") inline anymore`);
    assert.match(source, /from\s+["']@\/lib\/ai\/model-config["']/, `${file} must import from the centralized model config`);
    assert.match(source, /model:\s*defaultChatModel\(\)/, `${file} must use defaultChatModel()`);
  }
});

test("REGRESSION: the Executive Briefing and Command Center Q&A routes use the centralized executiveModel(), not an inline openai(\"gpt-4o-mini\")", async () => {
  const files = [
    "app/api/command-center/briefing/route.ts",
    "app/api/ai/command-center/route.ts",
  ];
  for (const file of files) {
    const source = await readSource(file);
    assert.doesNotMatch(source, /openai\(\s*["']gpt-4o-mini["']\s*\)/, `${file} must not hardcode openai("gpt-4o-mini") inline anymore`);
    assert.match(source, /model:\s*executiveModel\(\)/, `${file} must use the centralized executiveModel()`);
  }
});

// ---- Phase 19: provider error classification ----

test("classifyAIProviderError: a missing API key is classified as missing_api_key", async () => {
  const { classifyAIProviderError } = await import("@/lib/ai/provider-error");
  const { LoadAPIKeyError } = await import("ai");
  const error = new LoadAPIKeyError({ message: "OpenAI API key is missing." });
  assert.equal(classifyAIProviderError(error), "missing_api_key");
});

test("classifyAIProviderError: a 401 status is classified as invalid_api_key", async () => {
  const { classifyAIProviderError } = await import("@/lib/ai/provider-error");
  const { APICallError } = await import("ai");
  const error = new APICallError({ message: "Unauthorized", url: "https://api.openai.com/v1/responses", requestBodyValues: {}, statusCode: 401 });
  assert.equal(classifyAIProviderError(error), "invalid_api_key");
});

test("classifyAIProviderError: a 429 with an insufficient-quota response body is classified as insufficient_quota, not rate_limited", async () => {
  const { classifyAIProviderError } = await import("@/lib/ai/provider-error");
  const { APICallError } = await import("ai");
  const error = new APICallError({
    message: "Too Many Requests",
    url: "https://api.openai.com/v1/responses",
    requestBodyValues: {},
    statusCode: 429,
    responseBody: JSON.stringify({ error: { code: "insufficient_quota", message: "You exceeded your current quota." } }),
  });
  assert.equal(classifyAIProviderError(error), "insufficient_quota");
});

test("classifyAIProviderError: a plain 429 with no quota-specific body is classified as rate_limited", async () => {
  const { classifyAIProviderError } = await import("@/lib/ai/provider-error");
  const { APICallError } = await import("ai");
  const error = new APICallError({ message: "Too Many Requests", url: "https://api.openai.com/v1/responses", requestBodyValues: {}, statusCode: 429, responseBody: JSON.stringify({ error: { code: "rate_limit_exceeded" } }) });
  assert.equal(classifyAIProviderError(error), "rate_limited");
});

test("classifyAIProviderError: a 5xx status is classified as provider_error", async () => {
  const { classifyAIProviderError } = await import("@/lib/ai/provider-error");
  const { APICallError } = await import("ai");
  const error = new APICallError({ message: "Internal Server Error", url: "https://api.openai.com/v1/responses", requestBodyValues: {}, statusCode: 503 });
  assert.equal(classifyAIProviderError(error), "provider_error");
});

test("classifyAIProviderError: an AbortError (our own timeout signal firing) is classified as timeout", async () => {
  const { classifyAIProviderError } = await import("@/lib/ai/provider-error");
  const error = new Error("The operation was aborted.");
  error.name = "AbortError";
  assert.equal(classifyAIProviderError(error), "timeout");
});

test("classifyAIProviderError: a generic, unrecognized error is classified as unknown", async () => {
  const { classifyAIProviderError } = await import("@/lib/ai/provider-error");
  assert.equal(classifyAIProviderError(new Error("Something unrelated broke.")), "unknown");
  assert.equal(classifyAIProviderError("not even an Error instance"), "unknown");
});

test("SECURITY: safeAIErrorMessage never includes the word 'OpenAI', a status code, or the word 'provider name' — every category message is generic enough to show a customer/website visitor", async () => {
  const { safeAIErrorMessage } = await import("@/lib/ai/provider-error");
  const categories = ["missing_api_key", "invalid_api_key", "rate_limited", "insufficient_quota", "timeout", "provider_error", "unknown"];
  for (const category of categories) {
    const message = safeAIErrorMessage(category);
    assert.doesNotMatch(message, /openai/i, `message for ${category} must not name the provider`);
    assert.doesNotMatch(message, /\b[45]\d\d\b/, `message for ${category} must not include a raw HTTP status code`);
  }
});

// ---- Phase 18: bounded retry ----

test("withBoundedRetry: retries exactly once for a genuinely transient failure (timeout), then succeeds", async () => {
  const { withBoundedRetry } = await import("@/lib/ai/retry");
  let attempts = 0;
  const result = await withBoundedRetry(async () => {
    attempts += 1;
    if (attempts === 1) {
      const error = new Error("timed out");
      throw error;
    }
    return "ok";
  }, { retryDelayMs: 1 });
  assert.equal(result, "ok");
  assert.equal(attempts, 2);
});

test("withBoundedRetry: never retries more than once — a second consecutive transient failure propagates instead of looping", async () => {
  const { withBoundedRetry } = await import("@/lib/ai/retry");
  let attempts = 0;
  await assert.rejects(() =>
    withBoundedRetry(async () => {
      attempts += 1;
      throw new Error("timed out");
    }, { retryDelayMs: 1 }),
  );
  assert.equal(attempts, 2, "exactly one original attempt plus exactly one retry, never more");
});

test("withBoundedRetry: does NOT retry a non-retryable category (invalid API key) — retrying a guaranteed-identical failure just doubles cost for nothing", async () => {
  const { withBoundedRetry } = await import("@/lib/ai/retry");
  const { APICallError } = await import("ai");
  let attempts = 0;
  await assert.rejects(() =>
    withBoundedRetry(async () => {
      attempts += 1;
      throw new APICallError({ message: "Unauthorized", url: "https://api.openai.com/v1/responses", requestBodyValues: {}, statusCode: 401 });
    }, { retryDelayMs: 1 }),
  );
  assert.equal(attempts, 1, "an invalid API key must never be retried");
});

// ---- Phase 20: usage logging never includes prompt/response content ----

test("SECURITY: logAIUsage's own type signature has no field for prompt text, message content, or response text — only counts/ids/durations", async () => {
  const source = await readSource("lib/ai/usage-logging.ts");
  assert.doesNotMatch(source, /prompt\s*:/i);
  assert.doesNotMatch(source, /message\s*:/i);
  assert.doesNotMatch(source, /responseText/i);
});

test("logAIUsage emits one structured JSON console line with the documented shape", async () => {
  const { logAIUsage } = await import("@/lib/ai/usage-logging");
  const originalLog = console.log;
  const lines = [];
  console.log = (line) => lines.push(line);
  try {
    logAIUsage({ feature: "receptionist", businessId: "biz-1", employeeId: "emp-1", model: "gpt-4o", durationMs: 123, outcome: "success" });
  } finally {
    console.log = originalLog;
  }
  assert.equal(lines.length, 1);
  const parsed = JSON.parse(lines[0]);
  assert.equal(parsed.event, "kuba_ai_usage");
  assert.equal(parsed.feature, "receptionist");
  assert.equal(parsed.businessId, "biz-1");
  assert.equal(parsed.outcome, "success");
  assert.ok(parsed.timestamp);
});

test("withAIUsageLogging logs outcome:'error' with a real errorCategory on failure, and still propagates the original error to the caller", async () => {
  const { withAIUsageLogging } = await import("@/lib/ai/usage-logging");
  const { APICallError } = await import("ai");
  const originalLog = console.log;
  const lines = [];
  console.log = (line) => lines.push(line);
  try {
    await assert.rejects(() =>
      withAIUsageLogging(
        { feature: "sales", businessId: "biz-2", model: "gpt-4o" },
        async () => { throw new APICallError({ message: "Too Many Requests", url: "https://api.openai.com/v1/responses", requestBodyValues: {}, statusCode: 429 }); },
      ),
    );
  } finally {
    console.log = originalLog;
  }
  assert.equal(lines.length, 1);
  const parsed = JSON.parse(lines[0]);
  assert.equal(parsed.outcome, "error");
  assert.equal(parsed.errorCategory, "rate_limited");
});

// ---- Phase 20 gap found and fixed: no full AI response text in console logs ----

test("REGRESSION: the Receptionist route no longer logs the full AI response text to the console (only its length) — customer-facing AI output is not dumped into general server logs", async () => {
  const source = await readSource("app/api/ai/receptionist/route.ts");
  assert.doesNotMatch(source, /text:\s*result\.text,/, "must not log the raw response text");
  assert.match(source, /textLength:\s*result\.text\.length/, "must still log the length for basic diagnostics");
});

// ---- Consistency: every AI-employee-invoking route uses the same instrumentation ----

test("REGRESSION (found via a real live smoke test with an exhausted-quota key — see the final report): every direct AI employee route wraps its agent.generate() call with withAIUsageLogging, including Outreach, which was initially missed", async () => {
  const routesAndFeatures = [
    ["app/api/ai/receptionist/route.ts", "receptionist"],
    ["app/api/ai/sales/route.ts", "sales"],
    ["app/api/ai/customer-support/route.ts", "customer_support"],
    ["app/api/ai/general-manager/route.ts", "general_manager"],
    ["app/api/ai/outreach/route.ts", "outreach"],
    ["app/api/integrations/website-chat/route.ts", "website_chat"],
    ["app/api/command-center/briefing/route.ts", "executive_briefing"],
    ["app/api/ai/command-center/route.ts", "command_center_qa"],
  ];
  for (const [file, feature] of routesAndFeatures) {
    const source = await readSource(file);
    assert.match(source, /withAIUsageLogging/, `${file} must use withAIUsageLogging`);
    assert.match(source, new RegExp(`feature:\\s*["']${feature}["']`), `${file} must log with feature: "${feature}"`);
  }
});

test("REGRESSION: every direct AI employee route (and Outreach specifically) classifies its caught error for server-side diagnostics via classifyAIProviderError", async () => {
  const files = [
    "app/api/ai/receptionist/route.ts",
    "app/api/ai/sales/route.ts",
    "app/api/ai/customer-support/route.ts",
    "app/api/ai/general-manager/route.ts",
    "app/api/ai/outreach/route.ts",
  ];
  for (const file of files) {
    const source = await readSource(file);
    assert.match(source, /classifyAIProviderError\(error\)/, `${file} must classify its catch-block error`);
  }
});

test("the Website Widget's public error response prefers the AI-provider failure category over the generic database-error fallback, so a real quota/rate-limit/key failure is never misreported as 'database_or_provider_error'", async () => {
  const source = await readSource("app/api/integrations/website-chat/route.ts");
  const section = source.slice(source.indexOf('} catch (error) {\n    console.error(\n      "Website chat error:"'));
  assert.match(section, /classifyAIProviderError\(\s*error\s*\)/);
  assert.match(section, /aiFailureType !== "unknown"\s*\?\s*aiFailureType\s*:\s*classifyWebsiteChatError\(error\)/);
});
