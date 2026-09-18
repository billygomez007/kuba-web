import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const ROUTE = path.join(
  process.cwd(),
  "app/api/integrations/whatsapp/wati/webhook/route.ts",
);

let source;

test.before(async () => {
  source = await readFile(ROUTE, "utf8");
});

test("WATI has a dedicated webhook adapter while remaining the WhatsApp channel", () => {
  assert.match(
    source,
    /processWhatsAppInbound/,
  );
  assert.match(
    source,
    /getWhatsAppTransportProvider/,
  );
});

test("WATI inbound tenant resolution uses channelPhoneNumber, never a payload businessId", () => {
  assert.match(
    source,
    /channelPhoneNumber/,
  );
  assert.match(
    source,
    /resolveWhatsAppIntegrationByPhoneNumberId/,
  );
  assert.doesNotMatch(
    source,
    /payload\.businessId/,
  );
});

test("the resolved integration must explicitly be the WATI transport", () => {
  assert.match(
    source,
    /getWhatsAppTransportProvider[\s\S]*!==\s*"wati"/,
  );
});

test("unregistered or inactive tenant connections fail closed", () => {
  assert.match(
    source,
    /!resolved/,
  );
  assert.match(
    source,
    /resolved\.business\.status\s*!==\s*"active"/,
  );
  assert.match(
    source,
    /status:\s*404/,
  );
});

test("WATI accepts inbound messages and documented status callbacks while ignoring unrelated events", () => {
  assert.match(
    source,
    /eventType\s*===\s*"messageReceived"/,
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
  assert.match(
    source,
    /ignored:\s*true/,
  );
});

test("WATI message IDs are normalized for shared idempotency handling", () => {
  assert.match(
    source,
    /whatsappMessageId/,
  );
  assert.match(
    source,
    /messageId/,
  );
  assert.match(
    source,
    /externalMessageId/,
  );
});

test("unsupported inbound content is stored but cannot be fabricated as AI-readable text", () => {
  assert.match(
    source,
    /Viewing this content type is not yet supported/,
  );
  assert.match(
    source,
    /customerMessage:/,
  );
  assert.match(
    source,
    /messageType:\s*text\s*\?\s*"text"\s*:\s*"unsupported"/,
  );
  assert.match(
    source,
    /canGenerateAiReply:\s*Boolean\(text\)/,
  );
});


test("WATI delivery states normalize into the shared WhatsApp status contract", () => {
  assert.match(
    source,
    /sentMessageDELIVERED_v2:\s*"delivered"/,
  );
  assert.match(
    source,
    /sentMessageREAD_v2:\s*"read"/,
  );
  assert.match(
    source,
    /sentMessageFAILED_v2:\s*"failed"/,
  );
  assert.match(
    source,
    /statusUpdates:\s*\[statusUpdate\]/,
  );
});

test("WATI status correlation prefers whatsappMessageId and can fall back to localMessageId", () => {
  const whatsappIndex = source.indexOf(
    'asString(payload.whatsappMessageId)',
  );
  const localIndex = source.indexOf(
    'asString(payload.localMessageId)',
  );

  assert.ok(
    whatsappIndex >= 0,
    "whatsappMessageId must be supported",
  );
  assert.ok(
    localIndex > whatsappIndex,
    "localMessageId must be a fallback after whatsappMessageId",
  );
});

test("WATI status callbacks remain tenant-resolved before shared status persistence", () => {
  const resolveIndex = source.indexOf(
    "resolveWhatsAppIntegrationByPhoneNumberId",
    source.indexOf("export async function POST"),
  );
  const processStatusIndex = source.indexOf(
    "statusUpdates: [statusUpdate]",
  );

  assert.ok(
    resolveIndex >= 0 && processStatusIndex > resolveIndex,
    "tenant resolution must happen before status persistence",
  );

  assert.doesNotMatch(
    source,
    /payload\.businessId/,
  );
});

test("the adapter does not invent Meta HMAC verification for WATI", () => {
  assert.doesNotMatch(
    source,
    /verifyMetaSignature/,
  );
  assert.doesNotMatch(
    source,
    /x-hub-signature-256/,
  );
});

test("the adapter contains no direct AI agent execution or direct provider send", () => {
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
    /graph\.facebook\.com/,
  );
  assert.doesNotMatch(
    source,
    /live-mt-server\.wati\.io/,
  );
});
