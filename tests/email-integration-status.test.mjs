// Pure unit tests for classifyEmailIntegrationStatus
// (lib/email/inbound-config.ts) — the single place
// app/api/integrations/email/route.ts's GET and PUT handlers both derive
// the Email Integration UI's status from, so the two can never disagree.
import { register } from "node:module";
import { pathToFileURL } from "node:url";
import path from "node:path";
import assert from "node:assert/strict";
import test from "node:test";

const REPO_ROOT = path.resolve(new URL("..", import.meta.url).pathname);
register(pathToFileURL(path.join(REPO_ROOT, "tests/helpers/alias-loader.mjs")));

const { classifyEmailIntegrationStatus } = await import("@/lib/email/inbound-config");

test("ERROR when sending itself is not configured, regardless of integration/inbound state", () => {
  assert.equal(classifyEmailIntegrationStatus({ sendingConfigured: false, hasIntegration: false, inboundReady: false }), "ERROR");
  assert.equal(classifyEmailIntegrationStatus({ sendingConfigured: false, hasIntegration: true, inboundReady: true }), "ERROR");
});

test("NOT_CONFIGURED when sending works but the business has not activated the integration row", () => {
  assert.equal(classifyEmailIntegrationStatus({ sendingConfigured: true, hasIntegration: false, inboundReady: false }), "NOT_CONFIGURED");
  assert.equal(classifyEmailIntegrationStatus({ sendingConfigured: true, hasIntegration: false, inboundReady: true }), "NOT_CONFIGURED");
});

test("CONFIGURED when activated but the platform's inbound domain/webhook secret are not both set", () => {
  assert.equal(classifyEmailIntegrationStatus({ sendingConfigured: true, hasIntegration: true, inboundReady: false }), "CONFIGURED");
});

test("ACTIVE only when sending is configured, the business activated the integration, AND inbound is platform-ready", () => {
  assert.equal(classifyEmailIntegrationStatus({ sendingConfigured: true, hasIntegration: true, inboundReady: true }), "ACTIVE");
});
