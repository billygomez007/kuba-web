import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

test("Facebook Page discovery subscribes the Page to Meta webhooks", () => {
  const callback =
    fs.readFileSync(
      "app/api/integrations/meta/callback/route.ts",
      "utf8",
    );

  assert.match(
    callback,
    /subscribeFacebookPage/,
  );
});

test("Meta graph helper uses subscribed_apps endpoint", () => {
  const graph =
    fs.readFileSync(
      "lib/channels/meta/graph.ts",
      "utf8",
    );

  assert.match(
    graph,
    /subscribed_apps/,
  );

  assert.match(
    graph,
    /messages/,
  );

  assert.match(
    graph,
    /messaging_postbacks/,
  );
});

test("Meta readiness requires a verified webhook", () => {
  const route =
    fs.readFileSync(
      "app/api/integrations/meta/readiness/route.ts",
      "utf8",
    );

  assert.match(
    route,
    /lastWebhookAt/,
  );

  assert.match(
    route,
    /status === "active"/,
  );
});
