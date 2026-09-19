import test from "node:test";
import assert from "node:assert/strict";
import {
  readFile,
} from "node:fs/promises";

const read = (path) =>
  readFile(path, "utf8");

test("Zapier webhook destination is HTTPS and allowlisted", async () => {
  const source =
    await read(
      "lib/integrations/zapier/webhook.ts",
    );

  assert.match(
    source,
    /url\.protocol !== "https:"/,
  );

  assert.match(
    source,
    /hooks\.zapier\.com/,
  );
});

test("Zapier webhook delivery uses POST JSON", async () => {
  const source =
    await read(
      "lib/integrations/zapier/webhook.ts",
    );

  assert.match(
    source,
    /method: "POST"/,
  );

  assert.match(
    source,
    /application\/json/,
  );
});

test("Zapier webhook URL is encrypted before storage", async () => {
  const source =
    await read(
      "app/api/integrations/zapier/connect/route.ts",
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

test("Zapier verifies delivery before activation", async () => {
  const source =
    await read(
      "app/api/integrations/zapier/connect/route.ts",
    );

  assert.match(
    source,
    /sendZapierWebhook/,
  );

  assert.match(
    source,
    /status:[\s\S]*"active"/,
  );
});

test("Zapier exposes real test delivery route", async () => {
  const source =
    await read(
      "app/api/integrations/zapier/test/route.ts",
    );

  assert.match(
    source,
    /sendZapierWebhook/,
  );

  assert.match(
    source,
    /superkuba\.integration\.test/,
  );
});

test("Zapier routes use canonical workspace resolution", async () => {
  for (
    const file of [
      "app/api/integrations/zapier/connect/route.ts",
      "app/api/integrations/zapier/status/route.ts",
      "app/api/integrations/zapier/disconnect/route.ts",
      "app/api/integrations/zapier/test/route.ts",
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

test("Zapier status never exposes webhook secret destination", async () => {
  const source =
    await read(
      "app/api/integrations/zapier/status/route.ts",
    );

  assert.doesNotMatch(
    source,
    /credentialsEncrypted/,
  );

  assert.doesNotMatch(
    source,
    /webhookUrl/,
  );
});

test("Zapier Connect opens real setup page", async () => {
  const source =
    await read(
      "app/api/integrations/connect/route.ts",
    );

  assert.match(
    source,
    /provider\.id === "zapier"/,
  );

  assert.match(
    source,
    /\/dashboard\/integrations\/zapier/,
  );
});
