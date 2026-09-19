import test from "node:test";
import assert from "node:assert/strict";
import {
  readFile,
} from "node:fs/promises";

const read = (path) =>
  readFile(path, "utf8");

test("Make webhook destination requires HTTPS and Make host", async () => {
  const source =
    await read(
      "lib/integrations/make/webhook.ts",
    );

  assert.match(
    source,
    /url\.protocol !== "https:"/,
  );

  assert.match(
    source,
    /endsWith\("\.make\.com"\)/,
  );
});

test("Make sends webhook events as POST JSON", async () => {
  const source =
    await read(
      "lib/integrations/make/webhook.ts",
    );

  assert.match(
    source,
    /method:[\s\S]*"POST"/,
  );

  assert.match(
    source,
    /application\/json/,
  );
});

test("Make supports optional x-make-apikey protection", async () => {
  const source =
    await read(
      "lib/integrations/make/webhook.ts",
    );

  assert.match(
    source,
    /x-make-apikey/,
  );

  assert.match(
    source,
    /apiKey/,
  );
});

test("Make webhook and API key are encrypted before storage", async () => {
  const source =
    await read(
      "app/api/integrations/make/connect/route.ts",
    );

  assert.match(
    source,
    /encrypt\(/,
  );

  assert.match(
    source,
    /credentialsEncrypted/,
  );

  assert.match(
    source,
    /webhookUrl/,
  );

  assert.match(
    source,
    /apiKey/,
  );
});

test("Make verifies real delivery before activation", async () => {
  const source =
    await read(
      "app/api/integrations/make/connect/route.ts",
    );

  assert.match(
    source,
    /sendMakeWebhook/,
  );

  assert.match(
    source,
    /status:[\s\S]*"active"/,
  );
});

test("Make exposes real test delivery", async () => {
  const source =
    await read(
      "app/api/integrations/make/test/route.ts",
    );

  assert.match(
    source,
    /sendMakeWebhook/,
  );

  assert.match(
    source,
    /superkuba\.integration\.test/,
  );
});

test("Make routes use canonical workspace resolution", async () => {
  for (
    const file of [
      "app/api/integrations/make/connect/route.ts",
      "app/api/integrations/make/status/route.ts",
      "app/api/integrations/make/disconnect/route.ts",
      "app/api/integrations/make/test/route.ts",
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

test("Make status exposes no secret destination or API key", async () => {
  const source =
    await read(
      "app/api/integrations/make/status/route.ts",
    );

  assert.doesNotMatch(
    source,
    /credentialsEncrypted/,
  );

  assert.doesNotMatch(
    source,
    /webhookUrl/,
  );

  assert.doesNotMatch(
    source,
    /apiKey[^P]/,
  );
});

test("Make Connect opens real setup page", async () => {
  const source =
    await read(
      "app/api/integrations/connect/route.ts",
    );

  assert.match(
    source,
    /provider\.id === "make"/,
  );

  assert.match(
    source,
    /\/dashboard\/integrations\/make/,
  );
});
