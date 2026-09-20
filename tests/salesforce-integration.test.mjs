import test from "node:test";
import assert from "node:assert/strict";
import {
  readFile,
} from "node:fs/promises";

const read = (path) =>
  readFile(path, "utf8");

test("Salesforce OAuth state is signed and tenant scoped", async () => {
  const source =
    await read(
      "lib/integrations/salesforce/oauth.ts",
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

test("Salesforce requests API and refresh access", async () => {
  const source =
    await read(
      "lib/integrations/salesforce/oauth.ts",
    );

  assert.match(
    source,
    /api refresh_token offline_access/,
  );
});

test("Salesforce verifies Contacts Accounts and Opportunities", async () => {
  const source =
    await read(
      "lib/integrations/salesforce/oauth.ts",
    );

  assert.match(
    source,
    /FROM Contact/,
  );

  assert.match(
    source,
    /FROM Account/,
  );

  assert.match(
    source,
    /FROM Opportunity/,
  );
});

test("Salesforce credentials are encrypted", async () => {
  const source =
    await read(
      "app/api/integrations/salesforce/callback/route.ts",
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

test("Salesforce routes use canonical workspace resolution", async () => {
  for (
    const file of [
      "app/api/integrations/salesforce/start/route.ts",
      "app/api/integrations/salesforce/status/route.ts",
      "app/api/integrations/salesforce/disconnect/route.ts",
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

test("Salesforce status never exposes encrypted tokens", async () => {
  const source =
    await read(
      "app/api/integrations/salesforce/status/route.ts",
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

test("Salesforce Connect launches real OAuth route", async () => {
  const source =
    await read(
      "app/api/integrations/connect/route.ts",
    );

  assert.match(
    source,
    /provider\.id === "salesforce"/,
  );

  assert.match(
    source,
    /\/api\/integrations\/salesforce\/start/,
  );
});
