import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const registry =
  fs.readFileSync(
    "lib/integrations/provider-registry.ts",
    "utf8",
  );

test("remaining provider catalog exists", () => {
  for (
    const provider
    of [
      "google_calendar",
      "microsoft_calendar",
      "apple_calendar",
      "stripe_merchant",
      "paystack_merchant",
      "quickbooks",
      "xero",
      "sage",
      "zoho_books",
      "hubspot",
      "salesforce",
      "pipedrive",
      "zoho_crm",
      "microsoft_dynamics",
      "slack",
      "microsoft_teams",
      "notion",
      "google_drive",
      "dropbox",
      "zapier",
      "make",
      "telegram",
      "sms_twilio",
      "voice",
      "developer_api",
    ]
  ) {
    assert.match(
      registry,
      new RegExp(
        `id: "${provider}"`,
      ),
    );
  }
});

test("OAuth integrations require provider configuration", () => {
  const source =
    fs.readFileSync(
      "app/api/integrations/connect/route.ts",
      "utf8",
    );

  assert.match(
    source,
    /PROVIDER_NOT_CONFIGURED/,
  );

  assert.doesNotMatch(
    source,
    /status:\s*"active"/,
  );
});

test("provider status is tenant scoped", () => {
  const source =
    fs.readFileSync(
      "app/api/integrations/provider-status/route.ts",
      "utf8",
    );

  assert.match(
    source,
    /membership\.businessId/,
  );

  assert.match(
    source,
    /integrations\.businessId/,
  );
});

test("placeholder category pages now use real provider surfaces", () => {
  for (
    const file
    of [
      "app/dashboard/integrations/calendar/page.tsx",
      "app/dashboard/integrations/payments/page.tsx",
      "app/dashboard/integrations/accounting/page.tsx",
      "app/dashboard/integrations/crm/page.tsx",
      "app/dashboard/integrations/external-apps/page.tsx",
      "app/dashboard/integrations/developer/page.tsx",
    ]
  ) {
    const source =
      fs.readFileSync(
        file,
        "utf8",
      );

    assert.match(
      source,
      /ProviderGrid/,
    );

    assert.doesNotMatch(
      source,
      /Coming Soon/,
    );
  }
});
