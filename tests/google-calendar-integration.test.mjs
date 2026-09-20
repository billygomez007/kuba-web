import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(path, "utf8");

test("Google Calendar OAuth uses signed tenant state", async () => {
  const source = await read("lib/integrations/google-calendar/oauth.ts");
  assert.match(source, /createHmac/);
  assert.match(source, /timingSafeEqual/);
  assert.match(source, /businessId/);
  assert.match(source, /15 \* 60 \* 1000/);
});

test("Google Calendar requests offline Calendar access", async () => {
  const source = await read("lib/integrations/google-calendar/oauth.ts");
  assert.match(source, /calendar/);
  assert.match(source, /access_type/);
  assert.match(source, /offline/);
  assert.match(source, /prompt/);
  assert.match(source, /consent/);
});

test("Google credentials are encrypted before persistence", async () => {
  const source = await read(
    "app/api/integrations/google-calendar/callback/route.ts",
  );
  assert.match(source, /encrypt\(JSON\.stringify/);
  assert.match(source, /credentialsEncrypted/);
});

test("Google Calendar persistence is tenant scoped", async () => {
  const callback = await read(
    "app/api/integrations/google-calendar/callback/route.ts",
  );
  const status = await read(
    "app/api/integrations/google-calendar/status/route.ts",
  );
  const disconnect = await read(
    "app/api/integrations/google-calendar/disconnect/route.ts",
  );

  for (const source of [callback, status, disconnect]) {
    assert.match(source, /businessId/);
    assert.match(source, /google_calendar/);
  }
});

test("Google Calendar status never returns encrypted credentials", async () => {
  const source = await read(
    "app/api/integrations/google-calendar/status/route.ts",
  );
  assert.doesNotMatch(
    source.split("return NextResponse.json({")[2] || "",
    /credentialsEncrypted/,
  );
});

test("Google Calendar Connect launches the real OAuth start route", async () => {
  const route = await read(
    "app/api/integrations/connect/route.ts",
  );

  const grid = await read(
    "app/components/integrations/ProviderGrid.tsx",
  );

  assert.match(
    route,
    /provider\.id === "google_calendar"/,
  );

  assert.match(
    route,
    /\/api\/integrations\/google-calendar\/start/,
  );

  assert.match(
    grid,
    /window\.location\.assign/,
  );
});

test("Google Calendar routes use the canonical current-workspace resolver", async () => {
  for (
    const file of [
      "app/api/integrations/google-calendar/start/route.ts",
      "app/api/integrations/google-calendar/status/route.ts",
      "app/api/integrations/google-calendar/disconnect/route.ts",
    ]
  ) {
    const source =
      await read(file);

    assert.match(
      source,
      /getCurrentMembership/,
    );

    assert.doesNotMatch(
      source,
      /db\.query\.members/,
    );

    assert.doesNotMatch(
      source,
      /import\s*\{[^}]*members[^}]*\}\s*from\s*"@\/db\/schema"/,
    );
  }
});
