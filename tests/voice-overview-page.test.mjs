import { readFile } from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
import test from "node:test";

const ROOT = path.resolve(new URL("..", import.meta.url).pathname);
const read = (file) => readFile(path.join(ROOT, file), "utf8");

test("canonical Voice overview is business-scoped and entitlement-gated", async () => {
  const source = await read("app/dashboard/voice/page.tsx");
  assert.match(source, /getCurrentMembership\(\)/);
  assert.match(source, /membership\.businessId/);
  assert.match(source, /ai_workforce\.voice/);
  assert.match(source, /redirect\("\/login/);
});

test("sidebar Voice destination is the canonical overview", async () => {
  const source = await read("app/dashboard/layout.tsx");
  assert.match(source, /label: "Voice", href: "\/dashboard\/voice"/);
  assert.match(source, /"\/dashboard\/voice": "ai_workforce\.voice"/);
});

test("overview links to every existing Voice surface", async () => {
  const source = await read("app/dashboard/voice/VoiceOverviewClient.tsx");
  for (const href of [
    "/dashboard/settings/phone-numbers",
    "/dashboard/integrations/voice",
    "/dashboard/workforce/voice-testing",
    "/dashboard/workforce/live-calls",
    "/dashboard/conversations",
    "/dashboard/ai-employees",
  ]) assert.match(source, new RegExp(href.replaceAll("/", "\\/")));
});

test("readiness uses real provider and phone-number state", async () => {
  const source = await read("app/dashboard/voice/VoiceOverviewClient.tsx");
  assert.match(source, /api\/settings\/phone-numbers/);
  assert.match(source, /api\/settings\/voice-providers/);
  assert.match(source, /status === "active"/);
  assert.match(source, /Setup required/);
});
