import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();

const routeSource = await readFile(
  path.join(ROOT, "app/api/integrations/whatsapp/route.ts"),
  "utf8",
);

const dashboardSource = await readFile(
  path.join(
    ROOT,
    "app/dashboard/integrations/whatsapp/page.tsx",
  ),
  "utf8",
);

test("WhatsApp connection supports Meta and WATI transports", () => {
  assert.match(
    routeSource,
    /transportProvider.*"wati"/s,
  );
  assert.match(
    dashboardSource,
    /option value="meta"/,
  );
  assert.match(
    dashboardSource,
    /option value="wati"/,
  );
});

test("WATI token is encrypted before persistence", () => {
  assert.match(routeSource, /encrypt\(credential\)/);

  const metadataAssignments =
    routeSource.match(
      /metadata\s*=\s*\{[\s\S]*?\};/g,
    ) || [];

  assert.ok(
    metadataAssignments.length > 0,
    "WATI metadata assignments must remain explicit",
  );

  for (const metadataBlock of metadataAssignments) {
    assert.doesNotMatch(
      metadataBlock,
      /apiToken|accessToken|credential|credentialsEncrypted/,
    );
  }
});

test("WATI configuration stores only non-secret provider metadata", () => {
  assert.match(routeSource, /apiBaseUrl/);
  assert.match(routeSource, /channelNumber/);
  assert.match(routeSource, /transportProvider/);
});

test("WATI requires an explicit channel number for tenant-safe inbound routing", () => {
  assert.match(
    routeSource,
    /!apiBaseUrl\s*\|\|\s*!apiToken\s*\|\|\s*!channelNumber/,
  );

  assert.match(
    routeSource,
    /externalPhoneNumberId\s*=\s*channelNumber/,
  );

  assert.doesNotMatch(
    routeSource,
    /externalPhoneNumberId\s*=\s*channelNumber\s*\|\|/,
  );
});

test("WATI base URL must use HTTPS", () => {
  assert.match(
    routeSource,
    /url\.protocol !== "https:"/,
  );
});

test("tenant ownership still comes from authenticated membership", () => {
  assert.match(
    routeSource,
    /membership\.businessId/,
  );
  assert.doesNotMatch(
    routeSource,
    /formData\.get\("superKubaBusinessId"\)/,
  );
});

test("provider remains WhatsApp for the rest of SuperKuba", () => {
  assert.match(
    routeSource,
    /provider:\s*"whatsapp"/,
  );
});
