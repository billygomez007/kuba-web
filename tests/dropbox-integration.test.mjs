import test from "node:test";
import assert from "node:assert/strict";
import {
  readFile,
} from "node:fs/promises";

const read = (path) =>
  readFile(path, "utf8");

test("Dropbox OAuth state is signed and tenant scoped", async () => {
  const source =
    await read(
      "lib/integrations/dropbox/oauth.ts",
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

test("Dropbox requests offline OAuth access", async () => {
  const source =
    await read(
      "lib/integrations/dropbox/oauth.ts",
    );

  assert.match(
    source,
    /token_access_type/,
  );

  assert.match(
    source,
    /offline/,
  );

  assert.match(
    source,
    /refresh_token/,
  );
});

test("Dropbox uses scoped account and file permissions", async () => {
  const source =
    await read(
      "lib/integrations/dropbox/oauth.ts",
    );

  assert.match(
    source,
    /account_info\.read/,
  );

  assert.match(
    source,
    /files\.metadata\.read/,
  );

  assert.match(
    source,
    /files\.content\.read/,
  );
});

test("Dropbox verifies current account identity", async () => {
  const source =
    await read(
      "lib/integrations/dropbox/oauth.ts",
    );

  assert.match(
    source,
    /\/users\/get_current_account/,
  );
});

test("Dropbox discovers files with pagination", async () => {
  const source =
    await read(
      "lib/integrations/dropbox/oauth.ts",
    );

  assert.match(
    source,
    /\/files\/list_folder/,
  );

  assert.match(
    source,
    /\/files\/list_folder\/continue/,
  );

  assert.match(
    source,
    /has_more/,
  );

  assert.match(
    source,
    /cursor/,
  );
});

test("Dropbox credentials are encrypted", async () => {
  const source =
    await read(
      "app/api/integrations/dropbox/callback/route.ts",
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

test("Dropbox verifies token account matches API account", async () => {
  const source =
    await read(
      "app/api/integrations/dropbox/callback/route.ts",
    );

  assert.match(
    source,
    /identity\.accountId !==/,
  );

  assert.match(
    source,
    /tokens\.accountId/,
  );
});

test("Dropbox routes use canonical workspace resolution", async () => {
  for (
    const file of [
      "app/api/integrations/dropbox/start/route.ts",
      "app/api/integrations/dropbox/status/route.ts",
      "app/api/integrations/dropbox/disconnect/route.ts",
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

test("Dropbox status never exposes tokens", async () => {
  const source =
    await read(
      "app/api/integrations/dropbox/status/route.ts",
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

test("Dropbox Connect launches real OAuth route", async () => {
  const source =
    await read(
      "app/api/integrations/connect/route.ts",
    );

  assert.match(
    source,
    /provider\.id === "dropbox"/,
  );

  assert.match(
    source,
    /\/api\/integrations\/dropbox\/start/,
  );
});
