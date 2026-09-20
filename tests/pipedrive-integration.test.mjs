import test from "node:test";
import assert from "node:assert/strict";
import {
  readFile,
} from "node:fs/promises";

const read = (path) =>
  readFile(path, "utf8");

test("Pipedrive OAuth state is signed and tenant scoped", async () => {
  const source =
    await read(
      "lib/integrations/pipedrive/oauth.ts",
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

  assert.match(
    source,
    /15 \* 60 \* 1000/,
  );
});

test("Pipedrive OAuth uses official OAuth domain and Basic token authentication", async () => {
  const source =
    await read(
      "lib/integrations/pipedrive/oauth.ts",
    );

  assert.match(
    source,
    /https:\/\/oauth\.pipedrive\.com/,
  );

  assert.match(
    source,
    /Basic /,
  );

  assert.match(
    source,
    /authorization_code/,
  );
});

test("Pipedrive stores returned API domain", async () => {
  const source =
    await read(
      "app/api/integrations/pipedrive/callback/route.ts",
    );

  assert.match(
    source,
    /api_domain/,
  );

  assert.match(
    source,
    /apiDomain/,
  );
});

test("Pipedrive verifies persons organizations and deals", async () => {
  const source =
    await read(
      "lib/integrations/pipedrive/oauth.ts",
    );

  assert.match(
    source,
    /\/api\/v2\/persons\?limit=1/,
  );

  assert.match(
    source,
    /\/api\/v2\/organizations\?limit=1/,
  );

  assert.match(
    source,
    /\/api\/v2\/deals\?limit=1/,
  );
});

test("Pipedrive credentials are encrypted", async () => {
  const source =
    await read(
      "app/api/integrations/pipedrive/callback/route.ts",
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

test("Pipedrive routes use canonical workspace resolution", async () => {
  for (
    const file of [
      "app/api/integrations/pipedrive/start/route.ts",
      "app/api/integrations/pipedrive/status/route.ts",
      "app/api/integrations/pipedrive/disconnect/route.ts",
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

    assert.doesNotMatch(
      source,
      /db\.query\.members/,
    );
  }
});

test("Pipedrive status never exposes tokens", async () => {
  const source =
    await read(
      "app/api/integrations/pipedrive/status/route.ts",
    );

  assert.doesNotMatch(
    source,
    /credentialsEncrypted/,
  );

  assert.doesNotMatch(
    source,
    /accessToken/,
  );

  assert.doesNotMatch(
    source,
    /refreshToken/,
  );
});

test("Pipedrive Connect launches the real OAuth route", async () => {
  const source =
    await read(
      "app/api/integrations/connect/route.ts",
    );

  assert.match(
    source,
    /provider\.id === "pipedrive"/,
  );

  assert.match(
    source,
    /\/api\/integrations\/pipedrive\/start/,
  );
});
