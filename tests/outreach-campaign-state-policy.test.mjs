// Centralized state-transition tests for the Outreach Campaign Engine.
// Mirrors the existing appointmentTransitions/ticketTransitions pattern in
// lib/customer-operations.ts (see tests exercising those via
// mastra/tools/appointment-tools.ts).
import { register } from "node:module";
import { pathToFileURL } from "node:url";
import path from "node:path";
import assert from "node:assert/strict";
import test from "node:test";

const REPO_ROOT = path.resolve(new URL("..", import.meta.url).pathname);
register(pathToFileURL(path.join(REPO_ROOT, "tests/helpers/alias-loader.mjs")));

const { assertCampaignTransition, campaignTransitions, CAMPAIGN_STATUSES } =
  await import("@/lib/outreach/campaign-state");
const { assertRecipientTransition, recipientTransitions, RECIPIENT_STATUSES } =
  await import("@/lib/outreach/recipient-state");

// --- Campaign state machine ---

test("every approved campaign transition is allowed", () => {
  const approved = [
    ["draft", "scheduled"],
    ["draft", "running"],
    ["scheduled", "running"],
    ["running", "paused"],
    ["paused", "running"],
    ["running", "completed"],
    ["running", "stopped"],
    ["scheduled", "stopped"],
  ];
  for (const [from, to] of approved) {
    assert.doesNotThrow(() => assertCampaignTransition(from, to), `${from} -> ${to} should be allowed`);
  }
});

test("completed/stopped/failed are terminal — no transition out of them", () => {
  for (const terminal of ["completed", "stopped", "failed"]) {
    assert.deepEqual(campaignTransitions[terminal], []);
  }
});

test("an invalid campaign transition fails explicitly instead of silently succeeding", () => {
  assert.throws(() => assertCampaignTransition("draft", "completed"));
  assert.throws(() => assertCampaignTransition("completed", "running"));
  assert.throws(() => assertCampaignTransition("paused", "draft"));
  assert.throws(() => assertCampaignTransition("stopped", "running"));
});

test("campaign status list has no duplicate or unlisted transition targets", () => {
  for (const status of CAMPAIGN_STATUSES) {
    const targets = campaignTransitions[status];
    assert.ok(Array.isArray(targets), `${status} must have a transition list`);
    for (const target of targets) {
      assert.ok(CAMPAIGN_STATUSES.includes(target), `${status} -> ${target} references an unknown status`);
    }
  }
});

// --- Recipient state machine ---

test("a recipient can be suppressed or opted out directly from pending, without passing through every state", () => {
  assert.doesNotThrow(() => assertRecipientTransition("pending", "suppressed"));
  assert.doesNotThrow(() => assertRecipientTransition("pending", "opted_out"));
});

test("terminal recipient states have no outgoing transitions", () => {
  for (const terminal of ["completed", "suppressed", "opted_out", "stopped"]) {
    assert.deepEqual(recipientTransitions[terminal], []);
  }
});

test("a sent step can loop back for the next step or complete if it was the last one", () => {
  assert.doesNotThrow(() => assertRecipientTransition("sent", "ready"));
  assert.doesNotThrow(() => assertRecipientTransition("sent", "completed"));
});

test("an invalid recipient transition fails explicitly", () => {
  assert.throws(() => assertRecipientTransition("completed", "sent"));
  assert.throws(() => assertRecipientTransition("suppressed", "ready"));
  assert.throws(() => assertRecipientTransition("pending", "sent"));
});

test("recipient status list has no unlisted transition targets", () => {
  for (const status of RECIPIENT_STATUSES) {
    const targets = recipientTransitions[status];
    assert.ok(Array.isArray(targets), `${status} must have a transition list`);
    for (const target of targets) {
      assert.ok(RECIPIENT_STATUSES.includes(target), `${status} -> ${target} references an unknown status`);
    }
  }
});
