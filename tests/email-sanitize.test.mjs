// Unit tests for lib/email/sanitize.ts — inbound email bodies are
// untrusted input (Phase 11). No sanitize-html/DOMPurify dependency exists
// in this repo, so this module extracts plain text only and never stores
// or renders raw HTML; this also eliminates tracking pixels/remote-image
// loading by construction (plain text extraction never fetches anything).
import { register } from "node:module";
import { pathToFileURL } from "node:url";
import path from "node:path";
import assert from "node:assert/strict";
import test from "node:test";

const REPO_ROOT = path.resolve(new URL("..", import.meta.url).pathname);
register(pathToFileURL(path.join(REPO_ROOT, "tests/helpers/alias-loader.mjs")));

const { htmlToSafeText, trimQuotedReply, sanitizeInboundEmailBody } = await import("@/lib/email/sanitize");

test("htmlToSafeText strips tags and preserves readable text", () => {
  const html = "<p>Hello <b>there</b></p><p>Second paragraph</p>";
  const text = htmlToSafeText(html);
  assert.equal(text, "Hello there\nSecond paragraph");
});

test("SECURITY: htmlToSafeText strips <script> and <style> blocks entirely, including their inner content", () => {
  const html = "<p>Safe text</p><script>alert('xss')</script><style>body{color:red}</style>";
  const text = htmlToSafeText(html);
  assert.equal(text.includes("alert"), false);
  assert.equal(text.includes("color:red"), false);
  assert.equal(text, "Safe text");
});

test("SECURITY: htmlToSafeText never leaves any raw tag markup in the output, however malformed", () => {
  const html = "<img src=x onerror=alert(1)><a href='javascript:alert(1)'>click</a>";
  const text = htmlToSafeText(html);
  assert.equal(text.includes("<"), false);
  assert.equal(text.includes(">"), false);
});

test("htmlToSafeText decodes common HTML entities", () => {
  assert.equal(htmlToSafeText("Tom &amp; Jerry &mdash; a &quot;classic&quot;"), 'Tom & Jerry — a "classic"');
  assert.equal(htmlToSafeText("&#65;&#66;&#67;"), "ABC");
});

test("htmlToSafeText collapses excess blank lines", () => {
  const html = "<p>One</p><br><br><br><p>Two</p>";
  const text = htmlToSafeText(html);
  assert.equal(/\n{3,}/.test(text), false);
});

test("trimQuotedReply cuts at an 'On ... wrote:' marker, keeping only the new content", () => {
  const text = "Sounds good, let's talk Tuesday.\n\nOn Mon, Jan 5, 2026, Jane Doe wrote:\n> Original message here";
  const result = trimQuotedReply(text);
  assert.equal(result.content, "Sounds good, let's talk Tuesday.");
  assert.equal(result.quotedContentTrimmed, true);
});

test("trimQuotedReply cuts at a '>' quote block", () => {
  const text = "New reply text.\n> old quoted line 1\n> old quoted line 2";
  const result = trimQuotedReply(text);
  assert.equal(result.content, "New reply text.");
  assert.equal(result.quotedContentTrimmed, true);
});

test("trimQuotedReply cuts at an Outlook '-----Original Message-----' block", () => {
  const text = "My new reply.\n\n-----Original Message-----\nFrom: someone\nSent: today";
  const result = trimQuotedReply(text);
  assert.equal(result.content, "My new reply.");
  assert.equal(result.quotedContentTrimmed, true);
});

test("trimQuotedReply returns text unchanged when no quote marker is present", () => {
  const text = "Just a plain reply with no quoting at all.";
  const result = trimQuotedReply(text);
  assert.equal(result.content, text);
  assert.equal(result.quotedContentTrimmed, false);
});

test("trimQuotedReply never fabricates a marker or returns empty content when the quote marker is at the very start", () => {
  const text = "> entirely quoted, no new content above it";
  const result = trimQuotedReply(text);
  assert.equal(result.content, text);
  assert.equal(result.quotedContentTrimmed, false);
});

test("sanitizeInboundEmailBody prefers the plain-text part when both text and html are present", () => {
  const result = sanitizeInboundEmailBody({ text: "Plain reply", html: "<p>HTML reply</p>" });
  assert.equal(result.content, "Plain reply");
  assert.equal(result.sourceFormat, "text");
});

test("sanitizeInboundEmailBody falls back to safe-extracted text from HTML when no text part exists", () => {
  const result = sanitizeInboundEmailBody({ html: "<p>Only HTML <script>alert(1)</script>here</p>" });
  assert.equal(result.content, "Only HTML here");
  assert.equal(result.sourceFormat, "html");
});

test("sanitizeInboundEmailBody returns empty content (never throws) when neither text nor html is present", () => {
  const result = sanitizeInboundEmailBody({});
  assert.equal(result.content, "");
  assert.equal(result.quotedContentTrimmed, false);
});

test("sanitizeInboundEmailBody trims quoted content from the text part too, not just HTML", () => {
  const result = sanitizeInboundEmailBody({ text: "New content\n\nOn Tue, wrote:\n> old" });
  assert.equal(result.content, "New content");
  assert.equal(result.quotedContentTrimmed, true);
});
