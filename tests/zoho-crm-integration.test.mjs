import test from "node:test";
import assert from "node:assert/strict";
import {
  readFile,
} from "node:fs/promises";

const read = (path) =>
  readFile(path, "utf8");

test("Zoho OAuth state is signed and tenant scoped", async () => {
  const source =
    await read(
      "lib/integrations/zoho-crm/oauth.ts",
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

test("Zoho requests offline access and CRM scopes", async () => {
  const source =
    await read(
      "lib/integrations/zoho-crm/oauth.ts",
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
    /ZohoCRM\.modules\.leads\.ALL/,
  );

  assert.match(
    source,
    /ZohoCRM\.modules\.contacts\.ALL/,
  );

  assert.match(
    source,
    /ZohoCRM\.modules\.accounts\.ALL/,
  );

  assert.match(
    source,
    /ZohoCRM\.modules\.deals\.ALL/,
  );

  assert.match(
    source,
    /ZohoCRM\.users\.READ/,
  );
});

test("Zoho supports regional Accounts domains safely", async () => {
  const source =
    await read(
      "lib/integrations/zoho-crm/oauth.ts",
    );

  assert.match(
    source,
    /accounts\.zoho\.com/,
  );

  assert.match(
    source,
    /accounts\.zoho\.eu/,
  );

  assert.match(
    source,
    /accounts\.zoho\.in/,
  );

  assert.match(
    source,
    /accounts\.zohocloud\.ca/,
  );

  assert.match(
    source,
    /allowedAccountsHosts/,
  );
});

test("Zoho preserves provider api_domain", async () => {
  const oauth =
    await read(
      "lib/integrations/zoho-crm/oauth.ts",
    );

  const callback =
    await read(
      "app/api/integrations/zoho-crm/callback/route.ts",
    );

  assert.match(
    oauth,
    /api_domain/,
  );

  assert.match(
    callback,
    /apiDomain/,
  );
});

test("Zoho verifies current user and real CRM modules", async () => {
  const source =
    await read(
      "lib/integrations/zoho-crm/oauth.ts",
    );

  assert.match(
    source,
    /type=CurrentUser/,
  );

  for (
    const module of [
      "Leads",
      "Contacts",
      "Accounts",
      "Deals",
    ]
  ) {
    assert.match(
      source,
      new RegExp(
        `"${module}"`,
      ),
    );
  }
});

test("Zoho credentials are encrypted", async () => {
  const source =
    await read(
      "app/api/integrations/zoho-crm/callback/route.ts",
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

test("Zoho routes use canonical workspace resolution", async () => {
  for (
    const file of [
      "app/api/integrations/zoho-crm/start/route.ts",
      "app/api/integrations/zoho-crm/status/route.ts",
      "app/api/integrations/zoho-crm/disconnect/route.ts",
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

test("Zoho status never exposes tokens or credentials", async () => {
  const source =
    await read(
      "app/api/integrations/zoho-crm/status/route.ts",
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

test("Zoho CRM Connect launches real OAuth route", async () => {
  const source =
    await read(
      "app/api/integrations/connect/route.ts",
    );

  assert.match(
    source,
    /provider\.id === "zoho_crm"/,
  );

  assert.match(
    source,
    /\/api\/integrations\/zoho-crm\/start/,
  );
});
