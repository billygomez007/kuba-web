import test from "node:test";
import assert from "node:assert/strict";
import {
  readFile,
} from "node:fs/promises";

const read = (path) =>
  readFile(path, "utf8");

test("Dynamics OAuth state is signed and contains tenant environment", async () => {
  const source =
    await read(
      "lib/integrations/microsoft-dynamics/oauth.ts",
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
    /environmentUrl/,
  );
});

test("Dynamics environment URLs are HTTPS and allowlisted", async () => {
  const source =
    await read(
      "lib/integrations/microsoft-dynamics/oauth.ts",
    );

  assert.match(
    source,
    /url\.protocol !== "https:"/,
  );

  assert.match(
    source,
    /\.dynamics\.com/,
  );
});

test("Dynamics requests Dataverse delegated user access", async () => {
  const source =
    await read(
      "lib/integrations/microsoft-dynamics/oauth.ts",
    );

  assert.match(
    source,
    /user_impersonation/,
  );

  assert.match(
    source,
    /offline_access/,
  );
});

test("Dynamics verifies WhoAmI and service entity sets", async () => {
  const source =
    await read(
      "lib/integrations/microsoft-dynamics/oauth.ts",
    );

  assert.match(
    source,
    /WhoAmI/,
  );

  assert.match(
    source,
    /accounts/,
  );

  assert.match(
    source,
    /contacts/,
  );

  assert.match(
    source,
    /opportunities/,
  );
});

test("Dynamics credentials are encrypted", async () => {
  const source =
    await read(
      "app/api/integrations/microsoft-dynamics/callback/route.ts",
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

test("Dynamics routes use canonical workspace resolution", async () => {
  for (
    const file of [
      "app/api/integrations/microsoft-dynamics/start/route.ts",
      "app/api/integrations/microsoft-dynamics/status/route.ts",
      "app/api/integrations/microsoft-dynamics/disconnect/route.ts",
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

test("Dynamics status never exposes tokens", async () => {
  const source =
    await read(
      "app/api/integrations/microsoft-dynamics/status/route.ts",
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

test("Dynamics Connect opens environment setup page", async () => {
  const source =
    await read(
      "app/api/integrations/connect/route.ts",
    );

  assert.match(
    source,
    /provider\.id === "microsoft_dynamics"/,
  );

  assert.match(
    source,
    /\/dashboard\/integrations\/microsoft-dynamics/,
  );
});

test("Dynamics uses its own callback redirect variable", async () => {
  const registry =
    await read(
      "lib/integrations/provider-registry.ts",
    );

  const block =
    registry.slice(
      registry.indexOf(
        'id: "microsoft_dynamics"',
      ),
    );

  assert.match(
    block,
    /MICROSOFT_DYNAMICS_REDIRECT_URI/,
  );
});
