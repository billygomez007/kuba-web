// Real-implementation-path integration tests for the canonical inbound
// email webhook (app/api/integrations/email/webhook/route.ts) and its
// supporting correlation engine (lib/email/inbound-correlation.ts).
//
// Unlike the WhatsApp webhook, this route makes zero Mastra/AI calls, so
// its actual exported POST handler is invoked directly against a real,
// disposable local SQLite database — mirroring
// tests/outreach-campaign-worker-integration.test.mjs's fixture-bootstrap
// pattern exactly.
import { register } from "node:module";
import { pathToFileURL } from "node:url";
import { execFileSync } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import assert from "node:assert/strict";
import test from "node:test";
import { and, eq } from "drizzle-orm";

const REPO_ROOT = path.resolve(new URL("..", import.meta.url).pathname);
register(pathToFileURL(path.join(REPO_ROOT, "tests/helpers/alias-loader.mjs")));

const INBOUND_DOMAIN = "reply.superkuba.test";
const WEBHOOK_SECRET_KEY = crypto.randomBytes(24); // raw key bytes backing RESEND_WEBHOOK_SECRET
const WEBHOOK_SECRET = `whsec_${WEBHOOK_SECRET_KEY.toString("base64")}`;

let tempDir;
let db, schema, replyToken, suppression, webhookRoute;

const BIZ_A = "kora-os"; // tenant-isolation fixture business #1
const BIZ_B = "realtegic-works"; // tenant-isolation fixture business #2

function id(label) {
  return `${label}-${Math.random().toString(36).slice(2, 10)}`;
}

function signWebhookBody(rawBody) {
  const svixId = `msg_${id("evt")}`;
  const svixTimestamp = String(Math.floor(Date.now() / 1000));
  const signedContent = `${svixId}.${svixTimestamp}.${rawBody}`;
  const signature = crypto.createHmac("sha256", WEBHOOK_SECRET_KEY).update(signedContent).digest("base64");
  return {
    "svix-id": svixId,
    "svix-timestamp": svixTimestamp,
    "svix-signature": `v1,${signature}`,
  };
}

function postWebhook(event, { validSignature = true, headerOverrides = {} } = {}) {
  const rawBody = JSON.stringify(event);
  const signed = validSignature ? signWebhookBody(rawBody) : { "svix-id": "x", "svix-timestamp": String(Math.floor(Date.now() / 1000)), "svix-signature": "v1,bm90LXZhbGlk" };
  const headers = new Headers({ "content-type": "application/json", ...signed, ...headerOverrides });
  const request = new Request("https://app.superkuba.test/api/integrations/email/webhook", {
    method: "POST",
    headers,
    body: rawBody,
  });
  return webhookRoute.POST(request);
}

async function seedBusiness(businessId, name) {
  const now = new Date();
  await db.insert(schema.businesses).values({ id: businessId, name, slug: businessId, status: "active", createdAt: now, updatedAt: now });
}

async function seedEmailIntegration(businessId, alias) {
  const now = new Date();
  const integrationId = id("integration");
  await db.insert(schema.integrations).values({
    id: integrationId,
    businessId,
    provider: "email",
    status: "active",
    externalAccountId: alias,
    displayName: "Email",
    createdAt: now,
    updatedAt: now,
  });
  return integrationId;
}

async function seedCampaignScenario(businessId) {
  const now = new Date();
  const prospectId = id("prospect");
  const contactId = id("contact");
  const campaignId = id("camp");
  const stepId = id("step");
  const recipientId = id("recip");
  const sendId = id("send");
  const email = `prospect-${recipientId}@customer.example`;

  // A business must have an active Email integration row before campaign
  // replies can resolve (getOrLookupEmailIntegration in the webhook route) —
  // real production state after the owner activates Email in Settings.
  // Idempotent per-business: harmless if the caller already seeded one.
  const existingIntegration = await db
    .select({ id: schema.integrations.id })
    .from(schema.integrations)
    .where(and(eq(schema.integrations.businessId, businessId), eq(schema.integrations.provider, "email")))
    .limit(1);
  if (!existingIntegration[0]) {
    await seedEmailIntegration(businessId, `campaigns-${businessId}@${INBOUND_DOMAIN}`);
  }

  await db.insert(schema.outreachProspects).values({
    id: prospectId,
    businessId,
    employeeId: "emp-outreach",
    companyName: "Prospect Co",
    normalizedCompanyName: "prospect co",
    createdAt: now,
    updatedAt: now,
  });
  await db.insert(schema.outreachContacts).values({
    id: contactId,
    businessId,
    prospectId,
    email,
    contactType: "business",
    doNotContact: false,
    consentStatus: "explicit",
    createdAt: now,
    updatedAt: now,
  });
  await db.insert(schema.outreachCampaigns).values({
    id: campaignId,
    businessId,
    employeeId: "emp-outreach",
    name: "Reply correlation test campaign",
    status: "running",
    createdAt: now,
    updatedAt: now,
  });
  await db.insert(schema.outreachSequenceSteps).values({
    id: stepId,
    businessId,
    campaignId,
    stepNumber: 1,
    delayHours: 0,
    subjectTemplate: "Hi {{displayName}}",
    bodyTemplate: "Body",
    createdAt: now,
    updatedAt: now,
  });
  await db.insert(schema.outreachCampaignRecipients).values({
    id: recipientId,
    businessId,
    campaignId,
    contactId,
    prospectId,
    destinationChannel: "email",
    destinationIdentity: email,
    displayName: "Prospect Person",
    status: "scheduled",
    currentStepNumber: 1,
    enrolledAt: now,
    createdAt: now,
    updatedAt: now,
  });
  await db.insert(schema.outreachCampaignSends).values({
    id: sendId,
    businessId,
    campaignId,
    recipientId,
    sequenceStepId: stepId,
    status: "sent",
    scheduledAt: now,
    attemptCount: 1,
    externalMessageId: id("provider-msg"),
    createdAt: now,
    updatedAt: now,
  });

  return { prospectId, contactId, campaignId, recipientId, sendId, email };
}

test.before(async () => {
  tempDir = await mkdtemp(path.join(os.tmpdir(), "kuba-email-webhook-"));
  const databasePath = path.join(tempDir, "database.db");
  execFileSync("node", [path.join(REPO_ROOT, "scripts/bootstrap-clean-database.mjs")], {
    cwd: REPO_ROOT,
    env: { ...process.env, CLEAN_BOOTSTRAP_DATABASE_URL: `file:${databasePath}`, CLEAN_BOOTSTRAP_KEEP: "1" },
    stdio: "pipe",
  });
  process.env.TURSO_DATABASE_URL = `file:${databasePath}`;
  process.env.TURSO_AUTH_TOKEN = "";
  process.env.BETTER_AUTH_SECRET = process.env.BETTER_AUTH_SECRET || "test-secret-for-email-webhook-suite";
  process.env.EMAIL_FROM = process.env.EMAIL_FROM || "campaigns@superkuba.test";
  process.env.RESEND_INBOUND_DOMAIN = INBOUND_DOMAIN;
  process.env.RESEND_WEBHOOK_SECRET = WEBHOOK_SECRET;
  delete process.env.RESEND_API_KEY;

  ({ db } = await import("@/db"));
  schema = await import("@/db/schema");
  replyToken = await import("@/lib/email/reply-token");
  suppression = await import("@/lib/outreach/suppression");
  webhookRoute = await import("@/app/api/integrations/email/webhook/route");

  await seedBusiness(BIZ_A, "Kora OS");
  await seedBusiness(BIZ_B, "Realtegic Works");
});

test.after(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

test("SECURITY: a request with an invalid webhook signature is rejected with 401 and nothing is persisted", async () => {
  const response = await postWebhook(
    { type: "email.received", data: { email_id: id("evt"), from: "someone@customer.example", to: ["reply+bogus@" + INBOUND_DOMAIN], text: "hi" } },
    { validSignature: false },
  );
  assert.equal(response.status, 401);
});

test("a verified reply-token address resolves MATCHED_CAMPAIGN, creates the conversation, marks the recipient replied, and persists an inbound message", async () => {
  const { campaignId, recipientId, sendId, email } = await seedCampaignScenario(BIZ_A);
  const conversationId = `email-campaign-${recipientId}`;
  const token = replyToken.createReplyToken({ businessId: BIZ_A, conversationId, campaignId, recipientId, sendId });
  const replyToAddress = replyToken.buildReplyToAddress(token, INBOUND_DOMAIN);
  const providerEventId = id("evt");

  const response = await postWebhook({
    type: "email.received",
    data: { email_id: providerEventId, from: email, to: [replyToAddress], subject: "Re: Hi", text: "I'm interested, tell me more!" },
  });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.correlation, "MATCHED_CAMPAIGN");

  const recipientRow = (await db.select().from(schema.outreachCampaignRecipients).where(eq(schema.outreachCampaignRecipients.id, recipientId)).limit(1))[0];
  assert.equal(recipientRow.status, "replied");

  const conversationRow = (await db.select().from(schema.conversations).where(eq(schema.conversations.id, conversationId)).limit(1))[0];
  assert.ok(conversationRow, "conversation row should be created");
  assert.equal(conversationRow.businessId, BIZ_A);
  assert.equal(conversationRow.customerEmail, email.toLowerCase());

  const messageRows = await db.select().from(schema.messages).where(eq(schema.messages.externalMessageId, providerEventId));
  assert.equal(messageRows.length, 1);
  assert.equal(messageRows[0].direction, "inbound");
  assert.equal(messageRows[0].content, "I'm interested, tell me more!");
  assert.equal(messageRows[0].businessId, BIZ_A);
});

test("IDEMPOTENCY: redelivering the same provider event id is treated as a duplicate, not a second message", async () => {
  const { campaignId, recipientId, sendId, email } = await seedCampaignScenario(BIZ_A);
  const conversationId = `email-campaign-${recipientId}`;
  const token = replyToken.createReplyToken({ businessId: BIZ_A, conversationId, campaignId, recipientId, sendId });
  const replyToAddress = replyToken.buildReplyToAddress(token, INBOUND_DOMAIN);
  const providerEventId = id("evt");
  const event = { type: "email.received", data: { email_id: providerEventId, from: email, to: [replyToAddress], text: "first delivery" } };

  const first = await postWebhook(event);
  assert.equal((await first.json()).correlation, "MATCHED_CAMPAIGN");

  const second = await postWebhook(event);
  const secondBody = await second.json();
  assert.equal(secondBody.duplicate, true);

  const messageRows = await db.select().from(schema.messages).where(eq(schema.messages.externalMessageId, providerEventId));
  assert.equal(messageRows.length, 1, "a redelivered webhook must never insert a second message row");
});

test("a reply to an already-threaded campaign conversation updates the existing conversation instead of inserting a duplicate one", async () => {
  const { campaignId, recipientId, sendId, email } = await seedCampaignScenario(BIZ_A);
  const conversationId = `email-campaign-${recipientId}`;
  const token = replyToken.createReplyToken({ businessId: BIZ_A, conversationId, campaignId, recipientId, sendId });
  const replyToAddress = replyToken.buildReplyToAddress(token, INBOUND_DOMAIN);

  await postWebhook({ type: "email.received", data: { email_id: id("evt"), from: email, to: [replyToAddress], text: "first reply" } });
  const response = await postWebhook({ type: "email.received", data: { email_id: id("evt"), from: email, to: [replyToAddress], text: "second reply, same thread" } });
  assert.equal((await response.json()).correlation, "MATCHED_CAMPAIGN");

  const conversationRows = await db.select().from(schema.conversations).where(eq(schema.conversations.id, conversationId));
  assert.equal(conversationRows.length, 1, "no duplicate conversation should be created for the second reply on the same thread");

  const messageRows = await db.select().from(schema.messages).where(eq(schema.messages.conversationId, conversationId));
  assert.equal(messageRows.length, 2);
});

test("cold inbound mail to a business's own alias with no prior thread resolves NEW_CONVERSATION and creates a customer", async () => {
  const alias = `hello@${INBOUND_DOMAIN}`;
  await seedEmailIntegration(BIZ_A, alias);
  const senderEmail = `cold-sender-${id("s")}@customer.example`;

  const response = await postWebhook({ type: "email.received", data: { email_id: id("evt"), from: senderEmail, to: [alias], subject: "Question", text: "Do you offer X?" } });
  const body = await response.json();
  assert.equal(body.correlation, "NEW_CONVERSATION");

  const customerRows = await db.select().from(schema.customers).where(and(eq(schema.customers.businessId, BIZ_A), eq(schema.customers.email, senderEmail.toLowerCase())));
  assert.equal(customerRows.length, 1);
});

test("a second email from the same sender to the same alias resolves MATCHED_CONTACT and reuses the existing conversation (no duplicate contact/conversation)", async () => {
  const alias = `hello2@${INBOUND_DOMAIN}`;
  await seedEmailIntegration(BIZ_A, alias);
  const senderEmail = `repeat-sender-${id("s")}@customer.example`;

  const first = await postWebhook({ type: "email.received", data: { email_id: id("evt"), from: senderEmail, to: [alias], text: "first message" } });
  const firstBody = await first.json();
  assert.equal(firstBody.correlation, "NEW_CONVERSATION");

  const second = await postWebhook({ type: "email.received", data: { email_id: id("evt"), from: senderEmail, to: [alias], text: "second message" } });
  const secondBody = await second.json();
  assert.equal(secondBody.correlation, "MATCHED_CONTACT");

  const customerRows = await db.select().from(schema.customers).where(and(eq(schema.customers.businessId, BIZ_A), eq(schema.customers.email, senderEmail.toLowerCase())));
  assert.equal(customerRows.length, 1, "no duplicate contact should be created on a repeated reply");

  const conversationRows = await db.select().from(schema.conversations).where(and(eq(schema.conversations.businessId, BIZ_A), eq(schema.conversations.customerEmail, senderEmail.toLowerCase())));
  assert.equal(conversationRows.length, 1, "no duplicate conversation should be created on a repeated reply");
});

test("SAFETY: an email addressed to neither a valid reply token nor any known business alias is UNMATCHED_REVIEW_REQUIRED and nothing is persisted under any business", async () => {
  const unknownAddress = `unrouted@${INBOUND_DOMAIN}`;
  const providerEventId = id("evt");
  const response = await postWebhook({ type: "email.received", data: { email_id: providerEventId, from: "nobody@customer.example", to: [unknownAddress], text: "hello?" } });
  const body = await response.json();
  assert.equal(body.correlation, "UNMATCHED_REVIEW_REQUIRED");

  const messageRows = await db.select().from(schema.messages).where(eq(schema.messages.externalMessageId, providerEventId));
  assert.equal(messageRows.length, 0);
});

test("TENANT ISOLATION: a reply-token minted for business A can never resolve to business B, even if business B has a matching alias for the same sender", async () => {
  const aliasA = `iso-a@${INBOUND_DOMAIN}`;
  const aliasB = `iso-b@${INBOUND_DOMAIN}`;
  await seedEmailIntegration(BIZ_A, aliasA);
  await seedEmailIntegration(BIZ_B, aliasB);

  const { campaignId, recipientId, sendId, email } = await seedCampaignScenario(BIZ_A);
  const conversationId = `email-campaign-${recipientId}`;
  const token = replyToken.createReplyToken({ businessId: BIZ_A, conversationId, campaignId, recipientId, sendId });
  const replyToAddress = replyToken.buildReplyToAddress(token, INBOUND_DOMAIN);

  // Same sender also happens to have interacted with business B's alias —
  // proves the token match takes priority and never leaks into business B.
  await postWebhook({ type: "email.received", data: { email_id: id("evt"), from: email, to: [aliasB], text: "hi B" } });

  const response = await postWebhook({ type: "email.received", data: { email_id: id("evt"), from: email, to: [replyToAddress], text: "reply meant for A only" } });
  const body = await response.json();
  assert.equal(body.correlation, "MATCHED_CAMPAIGN");

  const conversationRowsForB = await db.select().from(schema.conversations).where(and(eq(schema.conversations.businessId, BIZ_B), eq(schema.conversations.customerEmail, email.toLowerCase())));
  const messagesUnderB = await db
    .select()
    .from(schema.messages)
    .where(and(eq(schema.messages.businessId, BIZ_B), eq(schema.messages.content, "reply meant for A only")));
  assert.equal(messagesUnderB.length, 0, "business A's campaign reply must never appear under business B");
  assert.equal(conversationRowsForB.length, 1, "business B's own earlier conversation with this sender is untouched, not merged with A's");
});

test("delivery-status bounce event suppresses the recipient and updates the message status, without needing an inbound reply", async () => {
  const now = new Date();
  const conversationId = id("conv");
  const integrationId = await seedEmailIntegration(BIZ_A, `bounce-alias@${INBOUND_DOMAIN}`);
  await db.insert(schema.conversations).values({
    id: conversationId,
    businessId: BIZ_A,
    integrationId,
    customerEmail: "bounced-recipient@customer.example",
    status: "open",
    createdAt: now,
    updatedAt: now,
  });
  const externalMessageId = id("provider-msg");
  await db.insert(schema.messages).values({
    id: id("msg"),
    businessId: BIZ_A,
    conversationId,
    integrationId,
    externalMessageId,
    direction: "outbound",
    senderType: "ai_employee",
    content: "campaign body",
    createdAt: now,
  });
  const { recipientId } = await seedCampaignScenario(BIZ_A);
  await db.update(schema.outreachCampaignSends).set({ externalMessageId }).where(eq(schema.outreachCampaignSends.recipientId, recipientId));

  const response = await postWebhook({ type: "email.bounced", data: { email_id: externalMessageId, to: "bounced-recipient@customer.example" } });
  assert.equal(response.status, 200);

  const isNowSuppressed = await suppression.isSuppressed(BIZ_A, "email", "bounced-recipient@customer.example");
  assert.equal(isNowSuppressed, true);

  const messageRow = (await db.select().from(schema.messages).where(eq(schema.messages.externalMessageId, externalMessageId)).limit(1))[0];
  assert.equal(messageRow.status, "bounced");
});

test("Message-ID/In-Reply-To/References headers are persisted in the message metadata, not discarded", async () => {
  const { campaignId, recipientId, sendId, email } = await seedCampaignScenario(BIZ_A);
  const conversationId = `email-campaign-${recipientId}`;
  const token = replyToken.createReplyToken({ businessId: BIZ_A, conversationId, campaignId, recipientId, sendId });
  const replyToAddress = replyToken.buildReplyToAddress(token, INBOUND_DOMAIN);
  const providerEventId = id("evt");
  const messageId = `<${id("msg")}@customer.example>`;
  const inReplyTo = `<${id("orig")}@superkuba.test>`;
  const references = `${inReplyTo} <${id("prev")}@superkuba.test>`;

  await postWebhook({
    type: "email.received",
    data: {
      email_id: providerEventId,
      from: email,
      to: [replyToAddress],
      subject: "Re: Hi",
      text: "Threading test reply",
      headers: [
        { name: "Message-ID", value: messageId },
        { name: "In-Reply-To", value: inReplyTo },
        { name: "References", value: references },
      ],
    },
  });

  const messageRow = (await db.select().from(schema.messages).where(eq(schema.messages.externalMessageId, providerEventId)).limit(1))[0];
  assert.ok(messageRow, "message should be persisted");
  const metadata = JSON.parse(messageRow.metadata);
  assert.equal(metadata.messageIdHeader, messageId);
  assert.equal(metadata.inReplyTo, inReplyTo);
  assert.equal(metadata.references, references);
});

test("a payload with headers as a flat object (not an array) is still read correctly", async () => {
  const alias = `headers-object@${INBOUND_DOMAIN}`;
  await seedEmailIntegration(BIZ_A, alias);
  const providerEventId = id("evt");
  const messageId = `<${id("msg")}@customer.example>`;

  await postWebhook({
    type: "email.received",
    data: { email_id: providerEventId, from: `sender-${id("s")}@customer.example`, to: [alias], text: "hi", headers: { "Message-ID": messageId } },
  });

  const messageRow = (await db.select().from(schema.messages).where(eq(schema.messages.externalMessageId, providerEventId)).limit(1))[0];
  const metadata = JSON.parse(messageRow.metadata);
  assert.equal(metadata.messageIdHeader, messageId);
});

test("a complaint event suppresses the recipient and updates the message status, distinctly from a bounce", async () => {
  const now = new Date();
  const conversationId = id("conv");
  const integrationId = await seedEmailIntegration(BIZ_A, `complaint-alias@${INBOUND_DOMAIN}`);
  await db.insert(schema.conversations).values({
    id: conversationId,
    businessId: BIZ_A,
    integrationId,
    customerEmail: "complainer@customer.example",
    status: "open",
    createdAt: now,
    updatedAt: now,
  });
  const externalMessageId = id("provider-msg");
  await db.insert(schema.messages).values({
    id: id("msg"),
    businessId: BIZ_A,
    conversationId,
    integrationId,
    externalMessageId,
    direction: "outbound",
    senderType: "ai_employee",
    content: "campaign body",
    createdAt: now,
  });
  const { recipientId } = await seedCampaignScenario(BIZ_A);
  await db.update(schema.outreachCampaignSends).set({ externalMessageId }).where(eq(schema.outreachCampaignSends.recipientId, recipientId));

  const response = await postWebhook({ type: "email.complained", data: { email_id: externalMessageId, to: "complainer@customer.example" } });
  assert.equal(response.status, 200);

  const isNowSuppressed = await suppression.isSuppressed(BIZ_A, "email", "complainer@customer.example");
  assert.equal(isNowSuppressed, true);
  const suppressionRow = (
    await db
      .select({ reason: schema.outreachSuppressions.reason })
      .from(schema.outreachSuppressions)
      .where(and(eq(schema.outreachSuppressions.businessId, BIZ_A), eq(schema.outreachSuppressions.normalizedIdentity, "complainer@customer.example")))
      .limit(1)
  )[0];
  assert.equal(suppressionRow.reason, "complained");

  const messageRow = (await db.select().from(schema.messages).where(eq(schema.messages.externalMessageId, externalMessageId)).limit(1))[0];
  assert.equal(messageRow.status, "complained");
});

test("a redelivered complaint webhook does not create a second suppression row (idempotent)", async () => {
  const now = new Date();
  const integrationId = await seedEmailIntegration(BIZ_A, `complaint-alias-2@${INBOUND_DOMAIN}`);
  const externalMessageId = id("provider-msg");
  await db.insert(schema.messages).values({
    id: id("msg"),
    businessId: BIZ_A,
    conversationId: id("conv"),
    integrationId,
    externalMessageId,
    direction: "outbound",
    senderType: "ai_employee",
    content: "campaign body",
    createdAt: now,
  });
  const { recipientId } = await seedCampaignScenario(BIZ_A);
  await db.update(schema.outreachCampaignSends).set({ externalMessageId }).where(eq(schema.outreachCampaignSends.recipientId, recipientId));

  const event = { type: "email.complained", data: { email_id: externalMessageId, to: "repeat-complainer@customer.example" } };
  await postWebhook(event);
  await postWebhook(event);

  const suppressionRows = await db
    .select()
    .from(schema.outreachSuppressions)
    .where(and(eq(schema.outreachSuppressions.businessId, BIZ_A), eq(schema.outreachSuppressions.normalizedIdentity, "repeat-complainer@customer.example")));
  assert.equal(suppressionRows.length, 1, "a redelivered complaint webhook must never create a second suppression row");
});

test("an unrecognized webhook event type is acknowledged (200) without throwing, so the provider does not retry forever", async () => {
  const response = await postWebhook({ type: "email.some_future_event", data: {} });
  assert.equal(response.status, 200);
});

test("a payload missing 'from' or 'to' is acknowledged and ignored rather than erroring", async () => {
  const response = await postWebhook({ type: "email.received", data: { email_id: id("evt"), from: "someone@customer.example", to: [] } });
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.ignored, "missing_from_or_to");
});
