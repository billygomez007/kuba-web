import { register } from "node:module";
import { pathToFileURL } from "node:url";
import assert from "node:assert/strict";
import test from "node:test";

register(pathToFileURL(new URL("./helpers/alias-loader.mjs", import.meta.url).pathname));

const { classifyPlivoHangup, classifyPlivoApiError, safeVoiceFailureMessage } = await import("../lib/voice/failure-classification.ts");

test("a normal hangup cause is classified as completed, never a failure", () => {
  assert.deepEqual(classifyPlivoHangup("NORMAL_CLEARING", 42), { completed: true });
  assert.deepEqual(classifyPlivoHangup("NORMAL_HANGUP", 0), { completed: true });
});

test("busy/no-answer/rejected/invalid causes are classified into their own distinct categories", () => {
  assert.equal(classifyPlivoHangup("USER_BUSY", 0).failureCategory, "BUSY");
  assert.equal(classifyPlivoHangup("NO_ANSWER", 0).failureCategory, "NO_ANSWER");
  assert.equal(classifyPlivoHangup("ORIGINATOR_CANCEL", 0).failureCategory, "CALL_REJECTED");
  assert.equal(classifyPlivoHangup("UNALLOCATED_NUMBER", 0).failureCategory, "INVALID_DESTINATION");
});

test("SECURITY/CORRECTNESS: a call is never called completed merely because duration is 0 and the cause is unrecognized", () => {
  const result = classifyPlivoHangup("SOME_UNRECOGNIZED_CAUSE", 0);
  assert.equal(result.completed, false);
  assert.equal(result.failureCategory, "UNKNOWN");
});

test("an unrecognized cause with real elapsed duration is treated as completed (the call genuinely connected and talked)", () => {
  assert.deepEqual(classifyPlivoHangup("SOME_UNRECOGNIZED_CAUSE", 15), { completed: true });
});

test("a missing/null hangup cause with zero duration is UNKNOWN, never fabricated as success", () => {
  assert.deepEqual(classifyPlivoHangup(null, 0), { completed: false, failureCategory: "UNKNOWN" });
  assert.deepEqual(classifyPlivoHangup(undefined, 0), { completed: false, failureCategory: "UNKNOWN" });
});

test("classifyPlivoApiError maps common Plivo REST error messages to safe categories", () => {
  assert.equal(classifyPlivoApiError("Unauthorized: invalid auth id"), "PLIVO_AUTH_ERROR");
  assert.equal(classifyPlivoApiError("Invalid destination number"), "INVALID_DESTINATION");
  assert.equal(classifyPlivoApiError("request timeout"), "TIMEOUT");
  assert.equal(classifyPlivoApiError("something else entirely"), "PROVIDER_ERROR");
});

test("SECURITY: safeVoiceFailureMessage never includes provider-specific text, only a fixed safe string per category", () => {
  const categories = ["PLIVO_AUTH_ERROR", "NUMBER_NOT_CONFIGURED", "INVALID_DESTINATION", "CALL_REJECTED", "BUSY", "NO_ANSWER", "PROVIDER_ERROR", "OPENAI_ERROR", "STREAM_ERROR", "TIMEOUT", "UNKNOWN"];
  for (const category of categories) {
    const message = safeVoiceFailureMessage(category);
    assert.equal(typeof message, "string");
    assert.ok(message.length > 0);
    assert.doesNotMatch(message, /plivo|twilio|openai/i);
  }
});
