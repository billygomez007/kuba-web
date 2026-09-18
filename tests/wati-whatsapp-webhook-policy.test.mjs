import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const ROUTE =
  "app/api/integrations/whatsapp/wati/webhook/route.ts";

const CORE =
  "lib/channels/whatsapp.ts";

let source;
let coreSource;

test.before(async () => {
  source = await readFile(ROUTE, "utf8");
  coreSource = await readFile(CORE, "utf8");
});

test("WATI remains a WhatsApp transport with a dedicated inbound adapter", () => {
  assert.match(
    source,
    /getWhatsAppTransportProvider/,
  );

  assert.match(
    source,
    /!== "wati"/,
  );
});

test("WATI never trusts a webhook businessId for tenant ownership", () => {
  assert.doesNotMatch(
    source,
    /payload\.businessId\s*[),]/,
  );

  assert.match(
    source,
    /resolveWatiWhatsAppIntegrationByChannelNumber/,
  );
});

test("WATI tenant lookup canonicalizes the stored channel number", () => {
  assert.match(
    coreSource,
    /resolveWatiWhatsAppIntegrationByChannelNumber/,
  );

  assert.match(
    coreSource,
    /replace\(\/\\D\/g, ""\)/,
  );
});

test("only active WATI integrations can resolve inbound callbacks", () => {
  assert.match(
    coreSource,
    /eq\(integrations\.status, "active"\)/,
  );

  assert.match(
    coreSource,
    /getWhatsAppTransportProvider/,
  );
});

test("WATI accepts only supported inbound and status events", () => {
  assert.match(
    source,
    /messageReceived/,
  );

  assert.match(
    source,
    /sentMessageDELIVERED_v2/,
  );

  assert.match(
    source,
    /sentMessageREAD_v2/,
  );

  assert.match(
    source,
    /sentMessageFAILED_v2/,
  );
});

test("WATI status correlation prefers localMessageId", () => {
  const localIndex =
    source.indexOf(
      "payload.localMessageId",
    );

  const whatsappIndex =
    source.indexOf(
      "payload.whatsappMessageId",
      localIndex,
    );

  assert.ok(localIndex >= 0);
  assert.ok(whatsappIndex > localIndex);
});

test("unsupported WATI events are ignored before tenant processing", () => {
  const postIndex =
    source.indexOf(
      "export async function POST",
    );

  const supportedIndex =
    source.indexOf(
      "!isMessageReceived",
      postIndex,
    );

  const resolveIndex =
    source.indexOf(
      "await resolveWatiWhatsAppIntegrationByChannelNumber",
      postIndex,
    );

  assert.ok(postIndex >= 0);
  assert.ok(supportedIndex > postIndex);
  assert.ok(resolveIndex > supportedIndex);
});

test("WATI delegates messageReceived to the shared inbound processor without direct AI generation or provider send", () => {
  assert.match(
    source,
    /processWhatsAppInboundMessage\s*\(/,
  );

  assert.match(
    source,
    /resolved[\s\S]*incomingMessage:[\s\S]*customerPhone[\s\S]*externalMessageId[\s\S]*customerMessage/,
  );

  assert.doesNotMatch(
    source,
    /\.generate\(/,
  );

  assert.doesNotMatch(
    source,
    /sendWhatsAppText\(/,
  );

  assert.doesNotMatch(
    source,
    /sendWhatsAppViaProvider\(/,
  );
});


test("WATI status callbacks persist through the shared tenant-scoped helper", () => {
  assert.match(
    source,
    /updateWhatsAppMessageStatus\s*\(\s*\{[\s\S]*?integrationId:\s*resolved\.integration\.id[\s\S]*?externalMessageId[\s\S]*?status/,
  );
});

test("shared WhatsApp status persistence is scoped by integration and external message id", () => {
  assert.match(
    coreSource,
    /export async function updateWhatsAppMessageStatus/,
  );
  assert.match(
    coreSource,
    /eq\(messages\.integrationId,\s*integrationId\)/,
  );
  assert.match(
    coreSource,
    /eq\(messages\.externalMessageId,\s*externalMessageId\)/,
  );
  assert.match(
    coreSource,
    /statusUpdatedAt:\s*new Date\(\)/,
  );
});

test("WATI accepts both documented inbound message event names", () => {
  assert.match(
    source,
    /eventType\s*===\s*"messageReceived"/,
  );

  assert.match(
    source,
    /eventType\s*===\s*"message"/,
  );
});
