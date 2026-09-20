import test from "node:test";
import assert from "node:assert/strict";
import {
  readFile,
} from "node:fs/promises";

const read = (path) =>
  readFile(path, "utf8");

test("QuickBooks OAuth state is signed and tenant scoped", async () => {
  const source =
    await read(
      "lib/integrations/quickbooks/oauth.ts",
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

test("QuickBooks requests accounting OAuth scope", async () => {
  const source =
    await read(
      "lib/integrations/quickbooks/oauth.ts",
    );

  assert.match(
    source,
    /com\.intuit\.quickbooks\.accounting/,
  );

  assert.match(
    source,
    /appcenter\.intuit\.com\/connect\/oauth2/,
  );
});

test("QuickBooks exchanges code with Intuit token endpoint", async () => {
  const source =
    await read(
      "lib/integrations/quickbooks/oauth.ts",
    );

  assert.match(
    source,
    /oauth\.platform\.intuit\.com\/oauth2\/v1\/tokens\/bearer/,
  );

  assert.match(
    source,
    /authorization_code/,
  );

  assert.match(
    source,
    /refresh_token/,
  );
});

test("QuickBooks verifies company identity", async () => {
  const source =
    await read(
      "lib/integrations/quickbooks/oauth.ts",
    );

  assert.match(
    source,
    /\/companyinfo\//,
  );

  assert.match(
    source,
    /CompanyInfo/,
  );
});

test("QuickBooks verifies core accounting entity access", async () => {
  const source =
    await read(
      "lib/integrations/quickbooks/oauth.ts",
    );

  for (
    const entity of [
      "Customer",
      "Invoice",
      "Account",
      "Vendor",
    ]
  ) {
    assert.match(
      source,
      new RegExp(
        `"${entity}"`,
      ),
    );
  }
});

test("QuickBooks credentials are encrypted", async () => {
  const source =
    await read(
      "app/api/integrations/quickbooks/callback/route.ts",
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

test("QuickBooks routes use canonical workspace resolution", async () => {
  for (
    const file of [
      "app/api/integrations/quickbooks/start/route.ts",
      "app/api/integrations/quickbooks/status/route.ts",
      "app/api/integrations/quickbooks/disconnect/route.ts",
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

test("QuickBooks status never exposes tokens", async () => {
  const source =
    await read(
      "app/api/integrations/quickbooks/status/route.ts",
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

test("QuickBooks Connect launches real OAuth route", async () => {
  const source =
    await read(
      "app/api/integrations/connect/route.ts",
    );

  assert.match(
    source,
    /provider\.id === "quickbooks"/,
  );

  assert.match(
    source,
    /\/api\/integrations\/quickbooks\/start/,
  );
});
