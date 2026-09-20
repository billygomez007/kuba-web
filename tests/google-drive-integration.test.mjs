import test from "node:test";
import assert from "node:assert/strict";
import {
  readFile,
} from "node:fs/promises";

const read = (path) =>
  readFile(path, "utf8");

test("Google Drive OAuth state is signed and tenant scoped", async () => {
  const source =
    await read(
      "lib/integrations/google-drive/oauth.ts",
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

test("Google Drive uses narrow drive.file scope", async () => {
  const source =
    await read(
      "lib/integrations/google-drive/oauth.ts",
    );

  assert.match(
    source,
    /https:\/\/www\.googleapis\.com\/auth\/drive\.file/,
  );

  assert.doesNotMatch(
    source,
    /auth\/drive\.readonly/,
  );

  assert.doesNotMatch(
    source,
    /auth\/drive"/,
  );
});

test("Google Drive requests offline access", async () => {
  const source =
    await read(
      "lib/integrations/google-drive/oauth.ts",
    );

  assert.match(
    source,
    /access_type/,
  );

  assert.match(
    source,
    /offline/,
  );

  assert.match(
    source,
    /prompt/,
  );

  assert.match(
    source,
    /consent/,
  );
});

test("Google Drive verifies account identity", async () => {
  const source =
    await read(
      "lib/integrations/google-drive/oauth.ts",
    );

  assert.match(
    source,
    /\/about\?fields=user/,
  );
});

test("Google Drive discovers accessible files", async () => {
  const source =
    await read(
      "lib/integrations/google-drive/oauth.ts",
    );

  assert.match(
    source,
    /\/files\?/,
  );

  assert.match(
    source,
    /pageSize/,
  );

  assert.match(
    source,
    /modifiedTime desc/,
  );
});

test("Google Drive credentials are encrypted", async () => {
  const source =
    await read(
      "app/api/integrations/google-drive/callback/route.ts",
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

test("Google Drive routes use canonical workspace resolution", async () => {
  for (
    const file of [
      "app/api/integrations/google-drive/start/route.ts",
      "app/api/integrations/google-drive/status/route.ts",
      "app/api/integrations/google-drive/disconnect/route.ts",
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

test("Google Drive status never exposes tokens", async () => {
  const source =
    await read(
      "app/api/integrations/google-drive/status/route.ts",
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

test("Google Drive Connect launches real OAuth route", async () => {
  const source =
    await read(
      "app/api/integrations/connect/route.ts",
    );

  assert.match(
    source,
    /provider\.id === "google_drive"/,
  );

  assert.match(
    source,
    /\/api\/integrations\/google-drive\/start/,
  );
});

test("Google Drive uses dedicated callback variable", async () => {
  const registry =
    await read(
      "lib/integrations/provider-registry.ts",
    );

  const block =
    registry.slice(
      registry.indexOf(
        'id: "google_drive"',
      ),
    );

  assert.match(
    block,
    /GOOGLE_DRIVE_REDIRECT_URI/,
  );
});
