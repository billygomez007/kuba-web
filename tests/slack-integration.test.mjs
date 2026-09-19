import test from "node:test";
import assert from "node:assert/strict";
import {
  readFile,
} from "node:fs/promises";

const read = (path) =>
  readFile(path, "utf8");

test("Slack uses v2 OAuth and signed tenant state", async () => {
  const source =
    await read(
      "lib/integrations/slack/oauth.ts",
    );

  assert.match(
    source,
    /oauth\/v2\/authorize/,
  );

  assert.match(
    source,
    /oauth\.v2\.access/,
  );

  assert.match(
    source,
    /createHmac/,
  );

  assert.match(
    source,
    /timingSafeEqual/,
  );
});

test("Slack requests granular workspace permissions", async () => {
  const source =
    await read(
      "lib/integrations/slack/oauth.ts",
    );

  assert.match(
    source,
    /chat:write/,
  );

  assert.match(
    source,
    /channels:read/,
  );

  assert.match(
    source,
    /groups:read/,
  );

  assert.match(
    source,
    /users:read/,
  );
});

test("Slack verifies workspace identity and channel access", async () => {
  const source =
    await read(
      "lib/integrations/slack/oauth.ts",
    );

  assert.match(
    source,
    /auth\.test/,
  );

  assert.match(
    source,
    /conversations\.list/,
  );
});

test("Slack supports outbound channel messages", async () => {
  const source =
    await read(
      "lib/integrations/slack/oauth.ts",
    );

  assert.match(
    source,
    /chat\.postMessage/,
  );
});

test("Slack token is encrypted before storage", async () => {
  const source =
    await read(
      "app/api/integrations/slack/callback/route.ts",
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

test("Slack routes use canonical workspace resolution", async () => {
  for (
    const file of [
      "app/api/integrations/slack/start/route.ts",
      "app/api/integrations/slack/status/route.ts",
      "app/api/integrations/slack/disconnect/route.ts",
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

test("Slack status never exposes credentials", async () => {
  const source =
    await read(
      "app/api/integrations/slack/status/route.ts",
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

test("Slack Connect launches the real OAuth route", async () => {
  const source =
    await read(
      "app/api/integrations/connect/route.ts",
    );

  assert.match(
    source,
    /provider\.id === "slack"/,
  );

  assert.match(
    source,
    /\/api\/integrations\/slack\/start/,
  );
});
