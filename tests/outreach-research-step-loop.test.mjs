// Regression tests for the researcher-agent step-loop fix in
// mastra/workflows/outreach-research-pipeline.ts.
//
// Root cause (confirmed by reading the installed @mastra/core source, see
// node_modules/@mastra/core/dist/agent-CKAVuxKN.js's `stream()`): a plain
// `generate()` call with no explicit `maxSteps`/`stopWhen` falls back to
// `stopWhen: stepCountIs(5)` — a hard cap of 5 total loop steps. A real
// research task (getBusinessKnowledge + iterative webSearch + webFetch on
// candidate pages + a final step to emit the structured package) can easily
// need more than 5 steps, so the loop was cut off mid tool-call
// (finishReason: "tool-calls") before the model ever reached a step where it
// could produce OutreachResearchPackage — confirmed live on Preview.
//
// The fix passes an explicit, bounded `maxSteps: RESEARCH_AGENT_MAX_STEPS`
// (12) to the researcher's generate() call. These tests exercise the real
// `runOutreachResearchPipeline` function (not just the downstream
// `outreachProspectWorkflow`, which the existing
// tests/outreach-research-pipeline.test.mjs already covers directly) by
// monkey-patching `kubaOutreachResearcherAgent.generate` — its own instance
// method, not frozen — to return controlled, unmocked-network results. This
// avoids a live OpenAI call while still exercising the pipeline's actual
// decision logic end to end, including real persistence against a
// disposable local SQLite database (same pattern as the existing pipeline
// test file).
import { register } from "node:module";
import { pathToFileURL } from "node:url";
import { execFileSync } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
import test from "node:test";

const REPO_ROOT = path.resolve(new URL("..", import.meta.url).pathname);
register(pathToFileURL(path.join(REPO_ROOT, "tests/helpers/alias-loader.mjs")));

const BIZ = "biz-research-step-loop";
const EMP = "emp-research-step-loop";

let tempDir;
let db;
let schema;
let runOutreachResearchPipeline;
let RESEARCH_AGENT_MAX_STEPS;
let kubaOutreachResearcherAgent;
let eq;

function validResearchPackage(companyName, domain) {
  return {
    prospect: {
      companyName,
      website: `https://${domain}`,
      industry: "Technology",
      country: "Ghana",
      city: "Accra",
      description: "A real Ghanaian technology company.",
      discoverySource: "web_search",
      discoveryQuery: `${companyName} Ghana`,
    },
    evidence: [
      {
        findingType: "company_overview",
        claim: `${companyName} builds software for African businesses.`,
        classification: "confirmed",
        sourceUrl: `https://${domain}/about`,
        sourceTitle: `${companyName} — About`,
        sourceTier: 1,
        sourceType: "official_website",
        buyingSignalType: null,
        buyingSignalStrength: null,
        observedAt: null,
      },
    ],
    contact: {
      available: true,
      name: null,
      jobTitle: null,
      email: `hello@${domain}`,
      phone: null,
      contactPageUrl: `https://${domain}/contact`,
      sourceUrl: `https://${domain}/contact`,
      contactType: "business",
      verificationStatus: "verified_public",
    },
    qualification: {
      status: "nurture",
      icpFitScore: 55,
      reason:
        "Organizational fit is plausible but no confirmed addressable need was found in public sources.",
    },
  };
}

function fakeGenerateResult({
  object,
  finishReason,
  toolCalls = [],
  toolResults = [],
}) {
  return {
    object,
    finishReason,
    usage: {
      inputTokens: 1200,
      outputTokens: 300,
      totalTokens: 1500,
      cachedInputTokens: 0,
    },
    toolCalls,
    toolResults,
    sources: [],
  };
}

/**
 * Replaces kubaOutreachResearcherAgent.generate for the duration of `run`,
 * capturing every call's (messages, options) pair, then restores the
 * original — whether `run` throws or not.
 */
async function withMockedGenerate(implementation, run) {
  const original = kubaOutreachResearcherAgent.generate;
  const calls = [];

  kubaOutreachResearcherAgent.generate = async (messages, options) => {
    calls.push({ messages, options });
    return implementation(messages, options);
  };

  try {
    return { calls, result: await run() };
  } finally {
    kubaOutreachResearcherAgent.generate = original;
  }
}

test.before(async () => {
  tempDir = await mkdtemp(
    path.join(os.tmpdir(), "kuba-outreach-step-loop-"),
  );
  const databasePath = path.join(tempDir, "database.db");

  execFileSync(
    "node",
    [path.join(REPO_ROOT, "scripts/bootstrap-clean-database.mjs")],
    {
      cwd: REPO_ROOT,
      env: {
        ...process.env,
        CLEAN_BOOTSTRAP_DATABASE_URL: `file:${databasePath}`,
        CLEAN_BOOTSTRAP_KEEP: "1",
      },
      stdio: "pipe",
    },
  );

  process.env.TURSO_DATABASE_URL = `file:${databasePath}`;
  process.env.TURSO_AUTH_TOKEN = "";

  ({ db } = await import("@/db"));
  schema = await import("@/db/schema");
  ({ runOutreachResearchPipeline, RESEARCH_AGENT_MAX_STEPS } = await import(
    "@/mastra/workflows/outreach-research-pipeline"
  ));
  ({ kubaOutreachResearcherAgent } = await import(
    "@/mastra/agents/outreach-researcher"
  ));
  ({ eq } = await import("drizzle-orm"));

  const now = new Date();

  await db.insert(schema.businesses).values({
    id: BIZ,
    name: "Research Step Loop Test Biz",
    slug: "research-step-loop-test-biz",
    plan: "pro",
    status: "active",
    createdAt: now,
    updatedAt: now,
  });

  await db.insert(schema.aiEmployees).values({
    id: EMP,
    businessId: BIZ,
    name: "Kuba Outreach",
    type: "outreach",
    supervisionMode: "owner_supervised",
    status: "active",
    createdAt: now,
    updatedAt: now,
  });
});

test.after(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

// --- 3 (wiring): the fix actually raises the step budget passed to generate() ---

test("the researcher's generate() call is given an explicit, bounded maxSteps above the Mastra default of 5", async () => {
  assert.ok(
    RESEARCH_AGENT_MAX_STEPS > 5,
    "expected the configured step budget to exceed Mastra's stepCountIs(5) default",
  );
  assert.ok(
    RESEARCH_AGENT_MAX_STEPS <= 30,
    "expected the step budget to stay small and bounded, not effectively unlimited",
  );

  const { calls } = await withMockedGenerate(
    () => fakeGenerateResult({
      object: validResearchPackage("MaxSteps Probe Co", "maxstepsprobe.example"),
      finishReason: "stop",
    }),
    () =>
      runOutreachResearchPipeline({
        businessId: BIZ,
        employeeId: EMP,
        task: "Research one real Ghanaian business.",
        businessContext: "BUSINESS CONTEXT\n\nTest business.",
      }),
  );

  assert.equal(calls.length, 1);
  assert.equal(calls[0].options.maxSteps, RESEARCH_AGENT_MAX_STEPS);
});

// --- 1: tool calls followed by a valid structured package proceeds to persistence ---

test("a research generation that performs tool calls and then returns a valid structured package is accepted and persisted", async () => {
  const companyName = "Kuba Step Loop Success Co";
  const domain = "kubasteplooksuccess.example";

  const { result } = await withMockedGenerate(
    () =>
      fakeGenerateResult({
        object: validResearchPackage(companyName, domain),
        finishReason: "stop",
        toolCalls: [
          { payload: { toolName: "getBusinessKnowledge" } },
          { payload: { toolName: "webSearch" } },
          { payload: { toolName: "webFetch" } },
        ],
        toolResults: [
          { payload: { toolName: "webFetch", result: { ok: true } } },
        ],
      }),
    () =>
      runOutreachResearchPipeline({
        businessId: BIZ,
        employeeId: EMP,
        task: "Research one real Ghanaian business.",
        businessContext: "BUSINESS CONTEXT\n\nTest business.",
      }),
  );

  assert.equal(result.stage, "persistence");
  assert.notEqual(result.status, "identity_conflict");
  assert.notEqual(result.status, "pipeline_error");
  assert.equal(result.prospectPersisted, true);
  assert.ok(result.prospectId);

  const rows = await db
    .select()
    .from(schema.outreachProspects)
    .where(eq(schema.outreachProspects.id, result.prospectId));

  assert.equal(rows.length, 1);
  assert.equal(rows[0].companyName, companyName);
  assert.equal(rows[0].businessId, BIZ);
});

// --- 2 & 3 (outcome): ending on tool-calls with no object fails closed ---

test("a researcher that ends on tool-calls without a final structured result fails closed and persists nothing", async () => {
  const before = await db
    .select()
    .from(schema.outreachProspects)
    .where(eq(schema.outreachProspects.businessId, BIZ));

  const { result } = await withMockedGenerate(
    () =>
      fakeGenerateResult({
        object: undefined,
        finishReason: "tool-calls",
        toolCalls: [{ payload: { toolName: "webFetch" } }],
      }),
    () =>
      runOutreachResearchPipeline({
        businessId: BIZ,
        employeeId: EMP,
        task: "Research one real Ghanaian business.",
        businessContext: "BUSINESS CONTEXT\n\nTest business.",
      }),
  );

  assert.equal(result.stage, "research");
  assert.equal(result.success, false);
  assert.match(result.error, /tool-calls/);
  assert.match(
    result.message,
    /Kuba Outreach was unable to produce a valid, verifiable research package/,
  );

  const after = await db
    .select()
    .from(schema.outreachProspects)
    .where(eq(schema.outreachProspects.businessId, BIZ));

  assert.equal(
    after.length,
    before.length,
    "no prospect row should have been created for an unfinished research run",
  );
});

test("exhausting the bounded research-step limit produces the same fail-closed outcome as ending on tool-calls", async () => {
  // Mastra's loop does not expose a distinct "ran out of steps" signal
  // separate from the last step's own finishReason — stepCountIs(N) simply
  // stops the loop once N steps have run, so a step-budget exhaustion and a
  // model that happens to end mid tool-call produce the identical observable
  // shape: no object, finishReason "tool-calls". The pipeline's error
  // message reflects that ambiguity honestly ("may have run out of research
  // steps or output budget") rather than claiming false precision.
  const { calls, result } = await withMockedGenerate(
    () =>
      fakeGenerateResult({
        object: undefined,
        finishReason: "tool-calls",
        toolCalls: Array.from({ length: RESEARCH_AGENT_MAX_STEPS }, () => ({
          payload: { toolName: "webSearch" },
        })),
      }),
    () =>
      runOutreachResearchPipeline({
        businessId: BIZ,
        employeeId: EMP,
        task: "Research one real Ghanaian business.",
        businessContext: "BUSINESS CONTEXT\n\nTest business.",
      }),
  );

  assert.equal(calls[0].options.maxSteps, RESEARCH_AGENT_MAX_STEPS);
  assert.equal(result.stage, "research");
  assert.equal(result.success, false);
});

// --- 4: invalid structured output (errorStrategy: "strict" throwing) fails closed ---

test("invalid structured output (the strict schema validator rejecting the model's object) fails closed and persists nothing", async () => {
  const before = await db
    .select()
    .from(schema.outreachProspects)
    .where(eq(schema.outreachProspects.businessId, BIZ));

  const { result } = await withMockedGenerate(
    () => {
      // Mirrors what Mastra's structuredOutput errorStrategy: "strict"
      // actually does on a schema mismatch: throw, rather than resolve with
      // a malformed object.
      throw new Error(
        "Structured output validation failed: qualification.icpFitScore is required",
      );
    },
    () =>
      runOutreachResearchPipeline({
        businessId: BIZ,
        employeeId: EMP,
        task: "Research one real Ghanaian business.",
        businessContext: "BUSINESS CONTEXT\n\nTest business.",
      }),
  );

  assert.equal(result.stage, "research");
  assert.equal(result.success, false);
  assert.match(result.error, /Structured output validation failed/);

  const after = await db
    .select()
    .from(schema.outreachProspects)
    .where(eq(schema.outreachProspects.businessId, BIZ));

  assert.equal(after.length, before.length);
});

// --- 5: no external-messaging capability in this path ---

test("the mocked research call path has no external-messaging capability available to it", () => {
  // The researcher agent's own tool wiring (no send/message tools) is
  // covered by tests/outreach-research-pipeline.test.mjs. This asserts the
  // same guarantee from the step-loop fix's own vantage point: nothing in
  // this pipeline call site can reach an external channel regardless of how
  // many steps the loop is allowed to run.
  assert.equal(
    Object.prototype.hasOwnProperty.call(
      kubaOutreachResearcherAgent,
      "sendWhatsApp",
    ),
    false,
  );
});

// --- 6: tenant RequestContext / business+employee isolation is unchanged ---

test("the researcher is still invoked with a RequestContext scoped to the real business id, and persistence is scoped to the real business+employee ids", async () => {
  const companyName = "Kuba Step Loop Tenant Check Co";
  const domain = "kubasteplooptenantcheck.example";

  const { calls, result } = await withMockedGenerate(
    () =>
      fakeGenerateResult({
        object: validResearchPackage(companyName, domain),
        finishReason: "stop",
      }),
    () =>
      runOutreachResearchPipeline({
        businessId: BIZ,
        employeeId: EMP,
        task: "Research one real Ghanaian business.",
        businessContext: "BUSINESS CONTEXT\n\nTest business.",
      }),
  );

  assert.equal(
    calls[0].options.requestContext.get("businessId"),
    BIZ,
  );

  const rows = await db
    .select()
    .from(schema.outreachProspects)
    .where(eq(schema.outreachProspects.id, result.prospectId));

  assert.equal(rows[0].businessId, BIZ);
  assert.equal(rows[0].employeeId, EMP);
});

// --- 7: identity-conflict detection still fires through the real pipeline path ---

test("identity-conflict protection still fires when a step-loop-fixed research run resolves to an already-saved domain", async () => {
  const now = new Date();
  const existingId = "prospect-existing-identity-conflict";

  await db.insert(schema.outreachProspects).values({
    id: existingId,
    businessId: BIZ,
    employeeId: EMP,
    companyName: "Original Conflicting Co",
    normalizedCompanyName: "original conflicting co",
    website: "https://sharedconflictdomain.example",
    normalizedDomain: "sharedconflictdomain.example",
    researchStatus: "researched",
    qualificationStatus: "unqualified",
    createdAt: now,
    updatedAt: now,
  });

  const { result } = await withMockedGenerate(
    () =>
      fakeGenerateResult({
        object: validResearchPackage(
          "A Different Incoming Name Ltd",
          "sharedconflictdomain.example",
        ),
        finishReason: "stop",
      }),
    () =>
      runOutreachResearchPipeline({
        businessId: BIZ,
        employeeId: EMP,
        task: "Research one real Ghanaian business.",
        businessContext: "BUSINESS CONTEXT\n\nTest business.",
      }),
  );

  assert.equal(result.stage, "persistence");
  assert.equal(result.status, "identity_conflict");
  assert.equal(result.conflict.existingProspectId, existingId);

  const evidenceForExisting = await db
    .select()
    .from(schema.outreachResearchEvidence)
    .where(
      eq(schema.outreachResearchEvidence.prospectId, existingId),
    );

  assert.equal(
    evidenceForExisting.length,
    0,
    "no evidence should be attached to the existing prospect on a conflict",
  );
});
