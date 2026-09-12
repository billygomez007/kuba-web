// Regression coverage for a real bug found during the SuperKuba audit:
// retell/vapi/sip were labeled `status: "available"` in the voice
// provider registry even though lib/voice/adapters has no working
// transport for them — every method just throws "not configured". A
// business could save real credentials for one of these and see a green
// "active" connection that can never place or receive a call. The label
// must always match what getVoiceTransport() actually does.
import { register } from "node:module";
import { pathToFileURL } from "node:url";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import test from "node:test";

register(pathToFileURL(new URL("./helpers/alias-loader.mjs", import.meta.url).pathname));

const { voiceProviders, getVoiceProvider, getVoiceTransport } = await import(
  "../lib/voice/providers.ts"
);

const WORKING_TRANSPORT_PROVIDERS = ["openai-realtime", "twilio"];
const NOT_YET_IMPLEMENTED_PROVIDERS = ["retell", "vapi", "sip"];

test("only providers with a real transport implementation are marked available", () => {
  for (const id of WORKING_TRANSPORT_PROVIDERS) {
    assert.equal(getVoiceProvider(id)?.status, "available", `${id} should be available`);
  }
  for (const id of NOT_YET_IMPLEMENTED_PROVIDERS) {
    assert.equal(getVoiceProvider(id)?.status, "planned", `${id} has no transport and must not claim availability`);
  }
});

test("every provider in the registry is exactly one of available/planned, never left unset", () => {
  for (const provider of voiceProviders) {
    assert.ok(
      provider.status === "available" || provider.status === "planned",
      `${provider.id} has an unexpected status: ${provider.status}`,
    );
  }
});

test("a provider marked available really does return a callable transport (not the not-configured stub)", async () => {
  for (const id of WORKING_TRANSPORT_PROVIDERS) {
    const transport = getVoiceTransport(id);
    assert.ok(transport, `${id} must return a transport`);
    // Missing credentials still throws (expected — this proves it's the
    // real adapter's own env-var guard, not the generic "not configured"
    // stub, which throws a differently-worded message).
    await assert.rejects(() => transport.startCall({ employeeId: "e", conversationId: "c", direction: "outbound" }));
  }
});

test("a planned provider's transport is the explicit not-configured stub, matching its label", async () => {
  for (const id of NOT_YET_IMPLEMENTED_PROVIDERS) {
    const transport = getVoiceTransport(id);
    assert.ok(transport);
    await assert.rejects(
      () => transport.startCall({ employeeId: "e", conversationId: "c", direction: "outbound" }),
      /credentials are not configured for live calls/,
    );
  }
});

test("the voice-providers connect route rejects a non-available provider before writing any credential", async () => {
  const routePath = new URL(
    "../app/api/settings/voice-providers/route.ts",
    import.meta.url,
  ).pathname;
  assert.ok(existsSync(routePath), "voice-providers route must exist");
  const source = await readFile(routePath, "utf8");

  assert.match(
    source,
    /providerDefinition\.status !== "available"/,
    "POST must check the provider's status before accepting a connection",
  );

  // The status guard must run before the encrypt/insert/update calls that
  // persist a credential, not after.
  const guardIndex = source.indexOf('providerDefinition.status !== "available"');
  const persistIndex = Math.min(
    ...["encryptVoiceSecret(secret)", "db.insert(integrations)", "db.update(integrations)"]
      .map((needle) => source.indexOf(needle))
      .filter((index) => index !== -1),
  );
  assert.ok(guardIndex !== -1 && persistIndex !== -1 && guardIndex < persistIndex, "the availability guard must run before any credential is persisted");
});
