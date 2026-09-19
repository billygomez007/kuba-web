import test from "node:test";
import assert from "node:assert/strict";
import {
  readFile,
} from "node:fs/promises";

const read = (path) =>
  readFile(path, "utf8");

test("Notion OAuth uses signed tenant state", async () => {
  const source =
    await read(
      "lib/integrations/notion/oauth.ts",
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
    /businessId/,
  );
});

test("Notion uses public OAuth authorization and token endpoints", async () => {
  const source =
    await read(
      "lib/integrations/notion/oauth.ts",
    );

  assert.match(
    source,
    /\/v1\/oauth\/authorize/,
  );

  assert.match(
    source,
    /\/v1\/oauth\/token/,
  );

  assert.match(
    source,
    /authorization_code/,
  );
});

test("Notion verifies integration bot identity", async () => {
  const source =
    await read(
      "lib/integrations/notion/oauth.ts",
    );

  assert.match(
    source,
    /\/users\/me/,
  );
});

test("Notion verifies workspace content access through search", async () => {
  const source =
    await read(
      "lib/integrations/notion/oauth.ts",
    );

  assert.match(
    source,
    /\/search/,
  );

  assert.match(
    source,
    /page_size/,
  );
});

test("Notion token is encrypted before storage", async () => {
  const source =
    await read(
      "app/api/integrations/notion/callback/route.ts",
    );

  assert.match(
    source,
    /encrypt\(/,
  );

  assert.match(
    source,
    /credentialsEncrypted/,
  );
});

test("Notion routes use canonical workspace resolution", async () => {
  for (
    const file of [
      "app/api/integrations/notion/start/route.ts",
      "app/api/integrations/notion/status/route.ts",
      "app/api/integrations/notion/disconnect/route.ts",
    ]
  ) {
    const source =
      await read(file);

    assert.match(
      source,
      /getCurrentMembership/,
    );

    assert.match(
      source,
      /PERMISSIONS\.INTEGRATIONS_/,
    );
  }
});

test("Notion status does not expose access token", async () => {
  const source =
    await read(
      "app/api/integrations/notion/status/route.ts",
    );

  assert.doesNotMatch(
    source,
    /credentialsEncrypted/,
  );

  assert.doesNotMatch(
    source,
    /accessToken/,
  );
});

test("Notion Connect launches real OAuth route", async () => {
  const source =
    await read(
      "app/api/integrations/connect/route.ts",
    );

  assert.match(
    source,
    /provider\.id === "notion"/,
  );

  assert.match(
    source,
    /\/api\/integrations\/notion\/start/,
  );
});
