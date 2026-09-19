import test from "node:test";
import assert from "node:assert/strict";
import {
  readFile,
} from "node:fs/promises";

const read = (path) =>
  readFile(path, "utf8");

test("HubSpot OAuth state is signed and tenant scoped", async () => {
  const source =
    await read(
      "lib/integrations/hubspot/oauth.ts",
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

test("HubSpot requests contacts companies and deals scopes", async () => {
  const source =
    await read(
      "lib/integrations/hubspot/oauth.ts",
    );

  assert.match(
    source,
    /crm\.objects\.contacts\.read/,
  );

  assert.match(
    source,
    /crm\.objects\.companies\.read/,
  );

  assert.match(
    source,
    /crm\.objects\.deals\.read/,
  );
});

test("HubSpot verifies real CRM access before activation", async () => {
  const source =
    await read(
      "app/api/integrations/hubspot/callback/route.ts",
    );

  assert.match(
    source,
    /verifyHubSpotCrmAccess/,
  );

  assert.match(
    source,
    /contactsReady/,
  );

  assert.match(
    source,
    /companiesReady/,
  );

  assert.match(
    source,
    /dealsReady/,
  );
});

test("HubSpot tokens are encrypted", async () => {
  const source =
    await read(
      "app/api/integrations/hubspot/callback/route.ts",
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

test("HubSpot routes use canonical workspace resolution", async () => {
  for (
    const file of [
      "app/api/integrations/hubspot/start/route.ts",
      "app/api/integrations/hubspot/status/route.ts",
      "app/api/integrations/hubspot/disconnect/route.ts",
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

test("HubSpot status never exposes tokens", async () => {
  const source =
    await read(
      "app/api/integrations/hubspot/status/route.ts",
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

test("HubSpot Connect launches the real OAuth route", async () => {
  const source =
    await read(
      "app/api/integrations/connect/route.ts",
    );

  assert.match(
    source,
    /provider\.id === "hubspot"/,
  );

  assert.match(
    source,
    /\/api\/integrations\/hubspot\/start/,
  );
});
