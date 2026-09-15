import { register } from "node:module";
import { pathToFileURL } from "node:url";
import assert from "node:assert/strict";
import test from "node:test";

register(pathToFileURL(new URL("./helpers/alias-loader.mjs", import.meta.url).pathname));

const { buildAnswerResponse, buildUnavailableResponse, buildStreamResponse, getVoiceGatewayStreamUrl } = await import("../lib/voice/plivo-xml.ts");

test("buildAnswerResponse returns an honest fallback when no media gateway is configured", () => {
  const original = process.env.VOICE_GATEWAY_STREAM_URL;
  delete process.env.VOICE_GATEWAY_STREAM_URL;
  try {
    const xml = buildAnswerResponse();
    assert.match(xml, /<Speak>/);
    assert.match(xml, /<Hangup\/>/);
    assert.doesNotMatch(xml, /<Stream/);
  } finally {
    if (original !== undefined) process.env.VOICE_GATEWAY_STREAM_URL = original;
  }
});

test("buildAnswerResponse connects to the configured gateway when one is set", () => {
  const original = process.env.VOICE_GATEWAY_STREAM_URL;
  process.env.VOICE_GATEWAY_STREAM_URL = "wss://voice-gateway.example.com/stream";
  try {
    const xml = buildAnswerResponse();
    assert.match(xml, /<Stream/);
    assert.match(xml, /wss:\/\/voice-gateway\.example\.com\/stream/);
  } finally {
    if (original === undefined) delete process.env.VOICE_GATEWAY_STREAM_URL;
    else process.env.VOICE_GATEWAY_STREAM_URL = original;
  }
});

test("buildUnavailableResponse never leaves the caller with dead air silently — always speaks a message before hanging up", () => {
  const xml = buildUnavailableResponse("Custom message");
  assert.match(xml, /<Speak>Custom message<\/Speak>/);
  assert.match(xml, /<Hangup\/>/);
});

test("buildUnavailableResponse escapes XML-significant characters in the message (never invalid XML from a template value)", () => {
  const xml = buildUnavailableResponse(`<script>alert("x")</script> & "quoted"`);
  assert.doesNotMatch(xml, /<script>/);
  assert.match(xml, /&lt;script&gt;/);
  assert.match(xml, /&amp;/);
  assert.match(xml, /&quot;quoted&quot;/);
});

test("buildStreamResponse escapes the URL and returns well-formed XML", () => {
  const xml = buildStreamResponse("wss://gateway.example.com/x?a=1&b=2");
  assert.match(xml, /^<Response><Stream[^>]*>.*<\/Stream><\/Response>$/);
  assert.match(xml, /&amp;b=2/);
});

test("getVoiceGatewayStreamUrl returns null when unset, and trims/returns the value when set", () => {
  const original = process.env.VOICE_GATEWAY_STREAM_URL;
  delete process.env.VOICE_GATEWAY_STREAM_URL;
  assert.equal(getVoiceGatewayStreamUrl(), null);
  process.env.VOICE_GATEWAY_STREAM_URL = "  wss://x.example.com  ";
  assert.equal(getVoiceGatewayStreamUrl(), "wss://x.example.com");
  if (original === undefined) delete process.env.VOICE_GATEWAY_STREAM_URL;
  else process.env.VOICE_GATEWAY_STREAM_URL = original;
});
