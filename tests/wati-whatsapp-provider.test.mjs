import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();

const source = await readFile(
  path.join(ROOT, "lib/channels/whatsapp-provider.ts"),
  "utf8",
);

test("WATI provider is represented as a WhatsApp transport, not a new channel", () => {
  assert.match(
    source,
    /export type WhatsAppTransportProvider = "meta" \| "wati"/,
  );
});

test("WATI credentials come from encrypted credential storage", () => {
  assert.match(source, /decrypt\(integration\.credentialsEncrypted\)/);
  assert.doesNotMatch(source, /process\.env\.WATI_API_TOKEN/);
});

test("WATI base URL comes from non-secret integration metadata", () => {
  assert.match(source, /metadata\.apiBaseUrl/);
  assert.match(source, /url\.protocol !== "https:"/);
});

test("legacy WhatsApp integrations default safely to Meta", () => {
  assert.match(
    source,
    /metadata\.transportProvider === "wati"\s*\?\s*"wati"\s*:\s*"meta"/,
  );
});

test("WATI uses the V3 conversation text endpoint", () => {
  assert.match(
    source,
    /\/api\/ext\/v3\/conversations\/messages\/text/,
  );
});

test("WATI send uses bearer authentication", () => {
  assert.match(
    source,
    /Authorization: `Bearer \$\{config\.accessToken\}`/,
  );
});

test("provider adapter never accepts or derives a SuperKuba businessId", () => {
  assert.doesNotMatch(source, /businessId/);
});

test("provider adapter contains no webhook or AI routing authority", () => {
  assert.doesNotMatch(source, /RequestContext/);
  assert.doesNotMatch(source, /routeConversationToTeam/);
  assert.doesNotMatch(source, /kubaReceptionistAgent/);
});


test("WATI outbound send reads the documented message.id response field first", () => {
  // https://docs.wati.io/reference/post_api-ext-v3-conversations-messages-text
  // returns { message: { id, conversation_id, ... } } — none of the
  // previously-checked flat/data-prefixed shapes ever matched this nested
  // field, so a successful send always fell through to "no_message_id".
  const messageDotIdIndex = source.indexOf(
    "result?.message?.id",
  );
  const localIndex = source.indexOf(
    "result?.localMessageId",
  );
  const messageIndex = source.indexOf(
    "result?.messageId",
  );
  const idIndex = source.indexOf(
    "result?.id",
  );

  assert.ok(
    messageDotIdIndex >= 0,
    "the documented message.id field must be read",
  );

  assert.ok(
    localIndex > messageDotIdIndex,
    "message.id must be checked before the localMessageId fallback",
  );

  assert.ok(
    messageIndex > localIndex,
    "messageId must only be a fallback after localMessageId",
  );

  assert.ok(
    idIndex > localIndex,
    "generic id must only be a fallback after localMessageId",
  );
});


test("Meta legacy fallback cannot cross-wire a tenant to another phone number", () => {
  assert.match(
    source,
    /integration\.externalPhoneNumberId\s*&&[\s\S]*integration\.externalPhoneNumberId\s*!==[\s\S]*legacyPhoneNumberId/,
  );

  assert.match(
    source,
    /integration\.credentialsEncrypted\s*&&[\s\S]*integration\.externalPhoneNumberId/,
  );
});

test("WATI V3 text send uses target in the JSON body", async () => {
  assert.match(
    source,
    /\/api\/ext\/v3\/conversations\/messages\/text/,
  );

  assert.doesNotMatch(
    source,
    /\?whatsappNumber=/,
  );

  assert.match(
    source,
    /const target\s*=/,
  );

  assert.match(
    source,
    /target,\s*\n\s*text:\s*message/,
  );

  assert.match(
    source,
    /\$\{config\.channelNumber\}:\$\{recipient\}/,
  );
});

test("WATI V3 strips account path from API base URL", () => {
  assert.match(
    source,
    /const apiUrl = new URL\(config\.apiBaseUrl\)/,
  );

  assert.match(
    source,
    /const v3BaseUrl = `\$\{apiUrl\.protocol\}\/\/\$\{apiUrl\.host\}`/,
  );

  assert.match(
    source,
    /fetch\(`\$\{v3BaseUrl\}\$\{path\}`/,
  );
});
