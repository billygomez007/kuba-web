import test from "node:test";
import assert from "node:assert/strict";
import {
  readFile,
} from "node:fs/promises";

const read = (path) =>
  readFile(path, "utf8");

test("Teams OAuth state is signed and tenant scoped", async () => {
  const source =
    await read(
      "lib/integrations/microsoft-teams/oauth.ts",
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

test("Teams requests Microsoft Graph team and channel scopes", async () => {
  const source =
    await read(
      "lib/integrations/microsoft-teams/oauth.ts",
    );

  assert.match(
    source,
    /Team\.ReadBasic\.All/,
  );

  assert.match(
    source,
    /Channel\.ReadBasic\.All/,
  );

  assert.match(
    source,
    /offline_access/,
  );
});

test("Teams verifies identity and discovers teams and channels", async () => {
  const source =
    await read(
      "lib/integrations/microsoft-teams/oauth.ts",
    );

  assert.match(
    source,
    /\/me\?\$select=/,
  );

  assert.match(
    source,
    /\/me\/joinedTeams/,
  );

  assert.match(
    source,
    /\/teams\/\$\{encodeURIComponent/,
  );

  assert.match(
    source,
    /\/channels/,
  );
});

test("Teams tokens are encrypted", async () => {
  const source =
    await read(
      "app/api/integrations/microsoft-teams/callback/route.ts",
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

test("Teams routes use canonical workspace resolution", async () => {
  for (
    const file of [
      "app/api/integrations/microsoft-teams/start/route.ts",
      "app/api/integrations/microsoft-teams/status/route.ts",
      "app/api/integrations/microsoft-teams/disconnect/route.ts",
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

test("Teams status never exposes tokens", async () => {
  const source =
    await read(
      "app/api/integrations/microsoft-teams/status/route.ts",
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

test("Teams Connect launches real OAuth route", async () => {
  const source =
    await read(
      "app/api/integrations/connect/route.ts",
    );

  assert.match(
    source,
    /provider\.id === "microsoft_teams"/,
  );

  assert.match(
    source,
    /\/api\/integrations\/microsoft-teams\/start/,
  );
});

test("Teams uses dedicated callback variable", async () => {
  const registry =
    await read(
      "lib/integrations/provider-registry.ts",
    );

  const block =
    registry.slice(
      registry.indexOf(
        'id: "microsoft_teams"',
      ),
    );

  assert.match(
    block,
    /MICROSOFT_TEAMS_REDIRECT_URI/,
  );
});
