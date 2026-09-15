import { register } from "node:module";
import { pathToFileURL } from "node:url";
import assert from "node:assert/strict";
import test from "node:test";

register(pathToFileURL(new URL("./helpers/alias-loader.mjs", import.meta.url).pathname));

const { buildAnswerResponse, buildUnavailableResponse, buildStreamResponse, buildGatewayStreamUrl, getVoiceGatewayUrl } = await import("../lib/voice/plivo-xml.ts");

test("buildAnswerResponse returns an honest fallback when no media gateway is configured", () => {
  const original = process.env.VOICE_GATEWAY_URL;
  delete process.env.VOICE_GATEWAY_URL;
  try {
    const xml = buildAnswerResponse("some-session-token");
    assert.match(xml, /<Speak>/);
    assert.match(xml, /<Hangup\/>/);
    assert.doesNotMatch(xml, /<Stream/);
  } finally {
    if (original !== undefined) process.env.VOICE_GATEWAY_URL = original;
  }
});

test("buildAnswerResponse returns the honest fallback when the gateway is configured but no session token was minted", () => {
  const original = process.env.VOICE_GATEWAY_URL;
  process.env.VOICE_GATEWAY_URL = "https://voice-gateway.example.com";
  try {
    const xml = buildAnswerResponse(null);
    assert.doesNotMatch(xml, /<Stream/);
    assert.match(xml, /<Speak>/);
  } finally {
    if (original === undefined) delete process.env.VOICE_GATEWAY_URL;
    else process.env.VOICE_GATEWAY_URL = original;
  }
});

test("buildAnswerResponse connects to the configured gateway, carrying only the opaque session token", () => {
  const original = process.env.VOICE_GATEWAY_URL;
  process.env.VOICE_GATEWAY_URL = "https://voice-gateway.example.com";
  try {
    const xml = buildAnswerResponse("signed.token123");
    assert.match(xml, /<Stream/);
    assert.match(xml, /wss:\/\/voice-gateway\.example\.com\/voice\/stream\?token=signed\.token123/);
  } finally {
    if (original === undefined) delete process.env.VOICE_GATEWAY_URL;
    else process.env.VOICE_GATEWAY_URL = original;
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

test("buildGatewayStreamUrl converts http(s) to ws(s) and carries only the token, never business data", () => {
  assert.equal(buildGatewayStreamUrl("https://gateway.example.com", "abc.def"), "wss://gateway.example.com/voice/stream?token=abc.def");
  assert.equal(buildGatewayStreamUrl("http://localhost:8080", "abc.def"), "ws://localhost:8080/voice/stream?token=abc.def");
  assert.equal(buildGatewayStreamUrl("https://gateway.example.com/", "abc.def"), "wss://gateway.example.com/voice/stream?token=abc.def");
});

test("buildGatewayStreamUrl URL-encodes the token", () => {
  const url = buildGatewayStreamUrl("https://gateway.example.com", "a+b/c=d");
  assert.match(url, /token=a%2Bb%2Fc%3Dd/);
});

test("getVoiceGatewayUrl returns null when unset, and trims/returns the value when set", () => {
  const original = process.env.VOICE_GATEWAY_URL;
  delete process.env.VOICE_GATEWAY_URL;
  assert.equal(getVoiceGatewayUrl(), null);
  process.env.VOICE_GATEWAY_URL = "  https://x.example.com  ";
  assert.equal(getVoiceGatewayUrl(), "https://x.example.com");
  if (original === undefined) delete process.env.VOICE_GATEWAY_URL;
  else process.env.VOICE_GATEWAY_URL = original;
});
