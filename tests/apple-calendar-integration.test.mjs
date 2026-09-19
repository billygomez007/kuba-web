import test from "node:test";
import assert from "node:assert/strict";
import {
  readFile,
} from "node:fs/promises";

const read = (path) =>
  readFile(path, "utf8");

test("Apple Calendar verifies CalDAV over HTTPS", async () => {
  const source =
    await read(
      "lib/integrations/apple-calendar/caldav.ts",
    );

  assert.match(
    source,
    /PROPFIND/,
  );

  assert.match(
    source,
    /current-user-principal/,
  );

  assert.match(
    source,
    /calendar-home-set/,
  );

  assert.match(
    source,
    /url\.protocol !== "https:"/,
  );
});

test("Apple credentials are encrypted before storage", async () => {
  const source =
    await read(
      "app/api/integrations/apple-calendar/connect/route.ts",
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

test("Apple Calendar uses canonical workspace resolver and permissions", async () => {
  for (
    const file of [
      "app/api/integrations/apple-calendar/connect/route.ts",
      "app/api/integrations/apple-calendar/status/route.ts",
      "app/api/integrations/apple-calendar/disconnect/route.ts",
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

test("Apple Calendar status never exposes credentials", async () => {
  const source =
    await read(
      "app/api/integrations/apple-calendar/status/route.ts",
    );

  assert.doesNotMatch(
    source,
    /password/,
  );

  assert.doesNotMatch(
    source,
    /credentialsEncrypted/,
  );
});

test("Apple Calendar connect opens real credential page", async () => {
  const source =
    await read(
      "app/api/integrations/connect/route.ts",
    );

  assert.match(
    source,
    /provider\.id === "apple_calendar"/,
  );

  assert.match(
    source,
    /\/dashboard\/integrations\/apple-calendar/,
  );
});
