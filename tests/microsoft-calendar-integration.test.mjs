import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) =>
  readFile(path, "utf8");

test("Microsoft Calendar OAuth uses signed tenant state", async () => {
  const source =
    await read(
      "lib/integrations/microsoft-calendar/oauth.ts",
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

test("Microsoft Calendar requests offline calendar access", async () => {
  const source =
    await read(
      "lib/integrations/microsoft-calendar/oauth.ts",
    );

  assert.match(
    source,
    /offline_access/,
  );

  assert.match(
    source,
    /Calendars\.ReadWrite/,
  );

  assert.match(
    source,
    /User\.Read/,
  );
});

test("Microsoft Calendar credentials are encrypted", async () => {
  const source =
    await read(
      "app/api/integrations/microsoft-calendar/callback/route.ts",
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

test("Microsoft Calendar uses canonical workspace resolution", async () => {
  for (
    const file of [
      "app/api/integrations/microsoft-calendar/start/route.ts",
      "app/api/integrations/microsoft-calendar/status/route.ts",
      "app/api/integrations/microsoft-calendar/disconnect/route.ts",
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
  }
});

test("Microsoft Calendar status never returns encrypted credentials", async () => {
  const source =
    await read(
      "app/api/integrations/microsoft-calendar/status/route.ts",
    );

  const responseSection =
    source.slice(
      source.lastIndexOf(
        "return NextResponse.json",
      ),
    );

  assert.doesNotMatch(
    responseSection,
    /credentialsEncrypted/,
  );
});

test("Microsoft Calendar connect launches real OAuth route", async () => {
  const source =
    await read(
      "app/api/integrations/connect/route.ts",
    );

  assert.match(
    source,
    /provider\.id === "microsoft_calendar"/,
  );

  assert.match(
    source,
    /\/api\/integrations\/microsoft-calendar\/start/,
  );
});
