// Unit tests for lib/email/error-classification.ts (Phase 29): safe,
// internal error categories for Resend failures. Never expose raw
// provider secrets/responses to customers or logs — safeEmailErrorMessage
// is the one thing allowed to reach a user-facing surface.
import { register } from "node:module";
import { pathToFileURL } from "node:url";
import path from "node:path";
import assert from "node:assert/strict";
import test from "node:test";

const REPO_ROOT = path.resolve(new URL("..", import.meta.url).pathname);
register(pathToFileURL(path.join(REPO_ROOT, "tests/helpers/alias-loader.mjs")));

const { classifyEmailProviderError, safeEmailErrorMessage, toSendWorkerFailureCode } = await import("@/lib/email/error-classification");

test("classifies known Resend error names correctly", () => {
  assert.equal(classifyEmailProviderError({ name: "invalid_api_key" }), "AUTH_ERROR");
  assert.equal(classifyEmailProviderError({ name: "restricted_api_key" }), "AUTH_ERROR");
  assert.equal(classifyEmailProviderError({ name: "rate_limit_exceeded" }), "RATE_LIMIT");
  assert.equal(classifyEmailProviderError({ name: "domain_not_verified" }), "DOMAIN_NOT_VERIFIED");
  assert.equal(classifyEmailProviderError({ name: "invalid_to_address" }), "INVALID_ADDRESS");
  assert.equal(classifyEmailProviderError({ name: "internal_server_error" }), "PROVIDER_ERROR");
  assert.equal(classifyEmailProviderError({ name: "validation_error" }), "RECIPIENT_REJECTED");
});

test("classifies a timeout from message content and AbortError", () => {
  assert.equal(classifyEmailProviderError(new Error("Request timed out after 10s")), "TIMEOUT");
  const abortError = new Error("aborted");
  abortError.name = "AbortError";
  assert.equal(classifyEmailProviderError(abortError), "TIMEOUT");
});

test("classifies a bounce from message content when no structured name is present", () => {
  assert.equal(classifyEmailProviderError(new Error("message bounce detected")), "BOUNCE");
});

test("falls back to UNKNOWN for an unrecognized error shape, never throwing", () => {
  assert.equal(classifyEmailProviderError({ name: "some_future_error_code" }), "UNKNOWN");
  assert.doesNotThrow(() => classifyEmailProviderError(null));
  assert.doesNotThrow(() => classifyEmailProviderError(undefined));
  assert.doesNotThrow(() => classifyEmailProviderError("a plain string error"));
  assert.doesNotThrow(() => classifyEmailProviderError(42));
});

test("SECURITY: safeEmailErrorMessage never includes the raw error message/response, only a fixed safe string per category", () => {
  for (const category of ["AUTH_ERROR", "RATE_LIMIT", "DOMAIN_NOT_VERIFIED", "RECIPIENT_REJECTED", "INVALID_ADDRESS", "BOUNCE", "TIMEOUT", "PROVIDER_ERROR", "UNKNOWN"]) {
    const message = safeEmailErrorMessage(category);
    assert.equal(typeof message, "string");
    assert.ok(message.length > 0);
    // None of the safe messages should ever contain provider-specific
    // jargon (api key, secret, token) that could hint at internals.
    assert.equal(/api[_ ]?key|secret|token/i.test(message), false);
  }
});

test("toSendWorkerFailureCode bridges every category into the existing send-worker's FailureCode shape without throwing", () => {
  const categories = ["AUTH_ERROR", "RATE_LIMIT", "DOMAIN_NOT_VERIFIED", "RECIPIENT_REJECTED", "INVALID_ADDRESS", "BOUNCE", "TIMEOUT", "PROVIDER_ERROR", "UNKNOWN"];
  const validWorkerCodes = new Set(["rate_limited", "provider_5xx", "invalid_recipient", "provider_rejected_permanent"]);
  for (const category of categories) {
    const code = toSendWorkerFailureCode(category);
    assert.ok(validWorkerCodes.has(code), `${category} -> ${code} must be a valid send-worker FailureCode`);
  }
});

test("toSendWorkerFailureCode never classifies a permanent invalid-address failure as retryable", () => {
  assert.equal(toSendWorkerFailureCode("INVALID_ADDRESS"), "invalid_recipient");
  assert.equal(toSendWorkerFailureCode("RECIPIENT_REJECTED"), "invalid_recipient");
});

test("toSendWorkerFailureCode classifies rate limits and transient provider errors as retryable-shaped codes", () => {
  assert.equal(toSendWorkerFailureCode("RATE_LIMIT"), "rate_limited");
  assert.equal(toSendWorkerFailureCode("PROVIDER_ERROR"), "provider_5xx");
  assert.equal(toSendWorkerFailureCode("TIMEOUT"), "provider_5xx");
});
