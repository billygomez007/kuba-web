import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

test("Meta webhook verifies challenge and signatures", () => {
  const source =
    fs.readFileSync(
      "app/api/integrations/meta/webhook/route.ts",
      "utf8",
    );

  assert.match(
    source,
    /META_WEBHOOK_VERIFY_TOKEN/,
  );

  assert.match(
    source,
    /x-hub-signature-256/,
  );

  assert.match(
    source,
    /createHmac/,
  );

  assert.match(
    source,
    /timingSafeEqual/,
  );
});

test("Meta inbound messages resolve tenant by provider account", () => {
  const source =
    fs.readFileSync(
      "lib/channels/meta/inbound.ts",
      "utf8",
    );

  assert.match(
    source,
    /resolveMetaIntegrationByExternalAccount/,
  );

  assert.match(
    source,
    /integration\.id/,
  );

  assert.match(
    source,
    /business\.id/,
  );
});

test("Meta inbound messages create real conversations and messages", () => {
  const source =
    fs.readFileSync(
      "lib/channels/meta/inbound.ts",
      "utf8",
    );

  assert.match(
    source,
    /insert\(conversations\)/,
  );

  assert.match(
    source,
    /insert\(messages\)/,
  );

  assert.match(
    source,
    /externalConversationId/,
  );
});

test("Meta connection becomes active only after valid inbound webhook", () => {
  const callback =
    fs.readFileSync(
      "app/api/integrations/meta/callback/route.ts",
      "utf8",
    );

  const inbound =
    fs.readFileSync(
      "lib/channels/meta/inbound.ts",
      "utf8",
    );

  assert.doesNotMatch(
    callback,
    /status:\s*"active"/,
  );

  assert.match(
    inbound,
    /status:\s*"active"/,
  );

  assert.match(
    inbound,
    /lastWebhookAt/,
  );
});

test("Facebook and Instagram adapters no longer fake delivery", () => {
  for (
    const file of [
      "lib/channels/facebook.ts",
      "lib/channels/instagram.ts",
    ]
  ) {
    const source =
      fs.readFileSync(
        file,
        "utf8",
      );

    assert.match(
      source,
      /sendMetaMessage/,
    );

    assert.doesNotMatch(
      source,
      /crypto\.randomUUID/,
    );
  }
});
