import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

test("Meta integration no longer presents as Coming Soon", () => {
  const overview = fs.readFileSync(
    "app/dashboard/integrations/page.tsx",
    "utf8",
  );

  const metaBlock = overview.slice(
    overview.indexOf('name: "Facebook & Instagram"'),
    overview.indexOf('name: "Telegram"'),
  );

  assert.ok(metaBlock);
  assert.doesNotMatch(
    metaBlock,
    /coming-soon/,
  );
});

test("Meta connection is tenant-scoped", () => {
  const route = fs.readFileSync(
    "app/api/integrations/meta/route.ts",
    "utf8",
  );

  assert.match(
    route,
    /membership\.businessId/,
  );
  assert.match(
    route,
    /integrations\.provider/,
  );
});

test("Meta OAuth does not claim connection before verification", () => {
  const callback = fs.readFileSync(
    "app/api/integrations/meta/callback/route.ts",
    "utf8",
  );

  assert.match(
    callback,
    /status:\s*"pending"/,
  );

  assert.doesNotMatch(
    callback,
    /status:\s*"active"/,
  );
});
