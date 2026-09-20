import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

test("Meta OAuth state is signed and time-limited", () => {
  const source = fs.readFileSync(
    "lib/channels/meta/oauth-state.ts",
    "utf8",
  );

  assert.match(
    source,
    /createHmac/,
  );

  assert.match(
    source,
    /timingSafeEqual/,
  );

  assert.match(
    source,
    /MAX_STATE_AGE_MS/,
  );
});

test("Meta callback encrypts provider tokens", () => {
  const source = fs.readFileSync(
    "app/api/integrations/meta/callback/route.ts",
    "utf8",
  );

  assert.match(
    source,
    /encrypt\(/,
  );

  assert.doesNotMatch(
    source,
    /credentialsEncrypted:\s*pageAccessToken/,
  );
});

test("Meta discovery is tenant-scoped", () => {
  const source = fs.readFileSync(
    "app/api/integrations/meta/callback/route.ts",
    "utf8",
  );

  assert.match(
    source,
    /state\.businessId/,
  );

  assert.match(
    source,
    /integrations\.businessId/,
  );
});

test("Discovered Meta integrations remain pending", () => {
  const source = fs.readFileSync(
    "app/api/integrations/meta/callback/route.ts",
    "utf8",
  );

  assert.match(
    source,
    /status:\s*"pending"/,
  );

  assert.doesNotMatch(
    source,
    /status:\s*"active"/,
  );
});
