// Unit tests for lib/voice/employee-config.ts — in particular
// getBaseRoleInstructions, which fixes a real leak: any chat/voice route
// that reads aiEmployeeSettings.roleInstructions raw also reads whatever
// VoiceConfig JSON blob happens to be appended after the marker (an
// implementation detail of how Voice settings are stored), which must
// never reach a model prompt as if it were part of the business's own
// authored instructions.
import { register } from "node:module";
import { pathToFileURL } from "node:url";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const REPO_ROOT = path.resolve(new URL("..", import.meta.url).pathname);
register(pathToFileURL(path.join(REPO_ROOT, "tests/helpers/alias-loader.mjs")));

const { parseVoiceConfig, serializeVoiceConfig, getBaseRoleInstructions, defaultVoiceConfig, voiceConfigMarker } = await import("@/lib/voice/employee-config");

test("getBaseRoleInstructions returns the full string unchanged when no VoiceConfig marker is present", () => {
  assert.equal(getBaseRoleInstructions("Be warm and helpful."), "Be warm and helpful.");
});

test("SECURITY: getBaseRoleInstructions strips the appended VoiceConfig JSON blob entirely", () => {
  const stored = serializeVoiceConfig(null, { ...defaultVoiceConfig, enabled: true, provider: "plivo", phoneNumber: "+15550001234" });
  const base = getBaseRoleInstructions(stored);
  assert.equal(base, "");
  assert.doesNotMatch(base, /provider/);
  assert.doesNotMatch(base, /plivo/);
  assert.doesNotMatch(base, /\+15550001234/);
});

test("SECURITY: getBaseRoleInstructions preserves the real, authored instructions and strips only the appended config", () => {
  const authored = "Always greet the caller by the business name and ask how you can help.";
  const stored = serializeVoiceConfig(authored, { ...defaultVoiceConfig, enabled: true, provider: "plivo" });
  assert.equal(getBaseRoleInstructions(stored), authored);
});

test("getBaseRoleInstructions handles null/undefined/empty input safely", () => {
  assert.equal(getBaseRoleInstructions(null), "");
  assert.equal(getBaseRoleInstructions(undefined), "");
  assert.equal(getBaseRoleInstructions(""), "");
});

test("getBaseRoleInstructions trims surrounding whitespace left by the marker boundary", () => {
  const stored = `Some instructions.   ${voiceConfigMarker}${JSON.stringify(defaultVoiceConfig)}`;
  assert.equal(getBaseRoleInstructions(stored), "Some instructions.");
});

test("parseVoiceConfig round-trips through serializeVoiceConfig", () => {
  const config = { ...defaultVoiceConfig, enabled: true, provider: "twilio", callDirection: "outbound" };
  const stored = serializeVoiceConfig("Authored text.", config);
  assert.deepEqual(parseVoiceConfig(stored), config);
});

test("parseVoiceConfig returns defaults for a string with no marker at all", () => {
  assert.deepEqual(parseVoiceConfig("just some plain instructions"), defaultVoiceConfig);
});

// --- Regression: the receptionist chat route must never read roleInstructions raw ---

test("REGRESSION: app/api/ai/receptionist/route.ts never inserts the raw, unstripped roleInstructions field into its prompt", async () => {
  const source = await readFile(path.join(REPO_ROOT, "app/api/ai/receptionist/route.ts"), "utf8");
  assert.match(source, /getBaseRoleInstructions\(employeeSettings\?\.roleInstructions\)/, "the ROLE INSTRUCTIONS section must go through getBaseRoleInstructions");
  assert.doesNotMatch(source, /\$\{\s*employeeSettings\?\.roleInstructions\s*\|\|/, "must never interpolate the raw roleInstructions field directly");
});
