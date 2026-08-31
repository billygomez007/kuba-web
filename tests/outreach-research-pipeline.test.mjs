// Tests for the autonomous Outreach research pipeline:
//
// - mastra/schemas/outreach-research-package.ts (the shared contract between
//   the research-only agent and the deterministic persistence workflow)
// - mastra/agents/outreach-researcher.ts (research-only agent: no
//   persistence tools, no external-messaging tools)
// - mastra/workflows/outreach-research-pipeline.ts (glue: research package ->
//   outreachProspectWorkflow -> truthful result)
// - the supervisionMode-gated Sales-promotion authority check added to
//   mastra/tools/promote-outreach-prospect-to-sales.ts
//
// Schema-validation tests below call the real zod schema directly — no
// mocking. The persistence/workflow/promotion tests use a real, disposable
// local SQLite database built from the repository's own schema (the same
// pattern as tests/customer-operations-integration.test.mjs), and never
// touch Turso or any remote database. The research-only agent itself is not
// invoked here (that would require a live OpenAI call); its tool wiring is
// instead verified by reading its own source, matching this repo's existing
// convention for auditing tool access (see tests/ai-authority-policy.test.mjs).
import { register } from "node:module";
import { pathToFileURL } from "node:url";
import { execFileSync } from "node:child_process";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
import test from "node:test";

const REPO_ROOT = path.resolve(new URL("..", import.meta.url).pathname);
register(pathToFileURL(path.join(REPO_ROOT, "tests/helpers/alias-loader.mjs")));

function fakeRequestContext(map) {
  return { get: (key) => map[key] };
}

// ---------------------------------------------------------------------------
// Static source checks: the research-only agent's tool surface and the
// pipeline's provenance guarantees.
// ---------------------------------------------------------------------------

let researcherAgentSource;
let pipelineSource;
let routeSource;

test.before(async () => {
  researcherAgentSource = await readFile(
    "mastra/agents/outreach-researcher.ts",
    "utf8",
  );
  pipelineSource = await readFile(
    "mastra/workflows/outreach-research-pipeline.ts",
    "utf8",
  );
  routeSource = await readFile("app/api/ai/outreach/route.ts", "utf8");
});

test("the research-only agent has no persistence tools", () => {
  for (const forbidden of [
    "saveOutreachProspectTool",
    "saveOutreachEvidenceTool",
    "saveOutreachContactTool",
    "qualifyOutreachProspectTool",
    "promoteOutreachProspectToSalesTool",
  ]) {
    assert.doesNotMatch(researcherAgentSource, new RegExp(forbidden));
  }
});

test("the research-only agent has no external-messaging tools", () => {
  for (const forbidden of [
    "salesExternalAction",
    "sendWhatsApp",
    "sendSms",
    "sendEmail",
  ]) {
    assert.doesNotMatch(researcherAgentSource, new RegExp(forbidden, "i"));
  }
});

test("the research-only agent only has getBusinessKnowledge, webSearch, and webFetch tools", () => {
  const toolsBlockMatch = researcherAgentSource.match(
    /tools:\s*\{([\s\S]*?)\},\n\}\);/,
  );
  assert.ok(toolsBlockMatch, "expected a tools: {...} block");
  const toolsBlock = toolsBlockMatch[1];
  assert.match(toolsBlock, /getBusinessKnowledge:/);
  assert.match(toolsBlock, /webSearch:/);
  assert.match(toolsBlock, /webFetch:/);
  // Exactly three tool entries (three colons at top level of the block).
  assert.equal((toolsBlock.match(/:\s*\w/g) || []).length, 3);
});

test("the pipeline never sources persisted ids from the research package — only from the workflow result", () => {
  // The success branch spreads workflowResult.result (the DB-verified
  // output), not researchPackage, into the returned object.
  assert.match(pipelineSource, /\.\.\.workflowResult\.result/);
  assert.doesNotMatch(pipelineSource, /researchPackage\.prospect\.id/);
  assert.doesNotMatch(pipelineSource, /researchPackage\.evidence\[[^\]]*\]\.id/);
});

test("the pipeline never imports an external-messaging tool", () => {
  for (const forbidden of [
    "sales-external-action",
    "send-whatsapp",
    "sendSms",
    "sendEmail",
  ]) {
    assert.doesNotMatch(pipelineSource, new RegExp(forbidden, "i"));
  }
});

test("the API route only runs the deterministic workflow for explicit autonomous_research requests, and the two modes are not mixed", () => {
  assert.match(routeSource, /mode === "autonomous_research"/);
  assert.match(routeSource, /runOutreachResearchPipeline/);
  // The conversational branch must still exist and still call the
  // conversational agent, unchanged.
  assert.match(routeSource, /kubaOutreachAgent\.generate/);
});

// ---------------------------------------------------------------------------
// Shared research-package schema: real zod validation, no mocking.
// ---------------------------------------------------------------------------

let outreachResearchPackageSchema;

test.before(async () => {
  ({ outreachResearchPackageSchema } = await import(
    "@/mastra/schemas/outreach-research-package"
  ));
});

function validPackage(overrides = {}) {
  return {
    prospect: { companyName: "Example Robotics Ltd", country: "Ghana" },
    evidence: [
      {
        findingType: "company_identity",
        claim: "Official site describes the company.",
        classification: "confirmed",
        sourceUrl: "https://example-robotics.example.com/about",
        sourceTier: 1,
        sourceType: "official_website",
      },
    ],
    contact: { available: false, reason: "No public contact page found." },
    qualification: {
      status: "nurture",
      icpFitScore: 50,
      reason: "Organizational fit looks reasonable but evidence is limited so far.",
    },
    ...overrides,
  };
}

test("schema rejects a package with zero evidence records", () => {
  const result = outreachResearchPackageSchema.safeParse(
    validPackage({ evidence: [] }),
  );
  assert.equal(result.success, false);
});

test("schema rejects a package with 21 evidence records", () => {
  const evidence = Array.from({ length: 21 }, (_, i) => ({
    findingType: "other",
    claim: `Finding ${i}`,
    classification: "unknown",
  }));
  const result = outreachResearchPackageSchema.safeParse(
    validPackage({ evidence }),
  );
  assert.equal(result.success, false);
});

test("schema accepts a package with exactly 20 evidence records", () => {
  const evidence = Array.from({ length: 20 }, (_, i) => ({
    findingType: "other",
    claim: `Finding ${i}`,
    classification: "unknown",
  }));
  const result = outreachResearchPackageSchema.safeParse(
    validPackage({ evidence }),
  );
  assert.equal(result.success, true);
});

test("schema rejects an invalid buyingSignalStrength", () => {
  const result = outreachResearchPackageSchema.safeParse(
    validPackage({
      evidence: [
        {
          findingType: "hiring",
          claim: "Job board lists several open customer-service roles.",
          classification: "confirmed",
          sourceTier: 2,
          buyingSignalType: "hiring",
          buyingSignalStrength: "extreme",
        },
      ],
    }),
  );
  assert.equal(result.success, false);
});

test("schema rejects an available contact with no email, phone, or contact page URL", () => {
  const result = outreachResearchPackageSchema.safeParse(
    validPackage({
      contact: {
        available: true,
        sourceUrl: "https://example-robotics.example.com/about",
        verificationStatus: "public_unverified",
      },
    }),
  );
  assert.equal(result.success, false);
});

test("schema accepts an unavailable contact", () => {
  const result = outreachResearchPackageSchema.safeParse(
    validPackage({
      contact: { available: false, reason: "No public contact route found." },
    }),
  );
  assert.equal(result.success, true);
});

test("schema accepts an available contact with a public email and a real sourceUrl", () => {
  const result = outreachResearchPackageSchema.safeParse(
    validPackage({
      contact: {
        available: true,
        email: "sales@example-robotics.example.com",
        sourceUrl: "https://example-robotics.example.com/contact",
        verificationStatus: "verified_public",
      },
    }),
  );
  assert.equal(result.success, true);
});

// The schema replaced z.string().url() (JSON Schema `format: "uri"`, which
// OpenAI's native structured-output strict mode rejects outright) with a
// plain z.string() plus an http(s) .refine(). These tests prove that swap
// did not weaken validation: a malformed or non-http(s) URL in the model's
// response is still rejected, exactly as z.string().url() would have
// rejected it.

test("schema rejects an evidence sourceUrl that is not a valid URL", () => {
  const result = outreachResearchPackageSchema.safeParse(
    validPackage({
      evidence: [
        {
          findingType: "company_identity",
          claim: "Official site describes the company.",
          classification: "confirmed",
          sourceUrl: "not-a-url",
        },
      ],
    }),
  );
  assert.equal(result.success, false);
});

test("schema rejects an evidence sourceUrl using a non-http(s) scheme", () => {
  const result = outreachResearchPackageSchema.safeParse(
    validPackage({
      evidence: [
        {
          findingType: "company_identity",
          claim: "Official site describes the company.",
          classification: "confirmed",
          sourceUrl: "javascript:alert(1)",
        },
      ],
    }),
  );
  assert.equal(result.success, false);
});

test("schema rejects an available contact with an invalid contactPageUrl", () => {
  const result = outreachResearchPackageSchema.safeParse(
    validPackage({
      contact: {
        available: true,
        contactPageUrl: "definitely not a url",
        sourceUrl: "https://example-robotics.example.com/about",
        verificationStatus: "public_unverified",
      },
    }),
  );
  assert.equal(result.success, false);
});

test("schema rejects an available contact with an invalid sourceUrl", () => {
  const result = outreachResearchPackageSchema.safeParse(
    validPackage({
      contact: {
        available: true,
        email: "sales@example-robotics.example.com",
        sourceUrl: "htp:/broken-url",
        verificationStatus: "public_unverified",
      },
    }),
  );
  assert.equal(result.success, false);
});

test("schema accepts a well-formed http(s) sourceUrl and contactPageUrl", () => {
  const result = outreachResearchPackageSchema.safeParse(
    validPackage({
      contact: {
        available: true,
        contactPageUrl: "https://example-robotics.example.com/contact-us",
        sourceUrl: "https://example-robotics.example.com/contact-us",
        verificationStatus: "verified_public",
      },
    }),
  );
  assert.equal(result.success, true);
});

// OpenAI's native structured-output strict mode marks every optional field
// as required and does NOT widen its type to allow omission — so the
// researcher agent will genuinely return `null` (not "field absent") for
// anything it honestly doesn't know, rather than being forced to invent a
// value. The schema must accept that explicit null, not just an omitted
// key, on every genuinely-optional field.
test("schema accepts explicit null (not just omission) on every optional field", () => {
  const result = outreachResearchPackageSchema.safeParse({
    prospect: {
      companyName: "Null Field Test Co",
      website: null,
      industry: null,
      country: null,
      city: null,
      description: null,
      discoverySource: null,
      discoveryQuery: null,
    },
    evidence: [
      {
        findingType: "company_identity",
        claim: "Official site confirms the company exists.",
        classification: "unknown",
        sourceUrl: null,
        sourceTitle: null,
        sourceTier: null,
        sourceType: null,
        buyingSignalType: null,
        buyingSignalStrength: null,
        observedAt: null,
      },
    ],
    contact: { available: false, reason: "No public contact page found." },
    qualification: {
      status: "nurture",
      icpFitScore: 50,
      reason: "Organizational fit looks reasonable but evidence is limited so far.",
    },
  });
  assert.equal(result.success, true);
});

test("schema rejects a qualified status with an out-of-range icpFitScore at the schema level only if non-integer/out-of-bounds (server tool enforces the status/score coupling)", () => {
  const result = outreachResearchPackageSchema.safeParse(
    validPackage({
      qualification: {
        status: "qualified",
        icpFitScore: 150,
        reason: "Score above the 0-100 bound must be rejected by the schema itself.",
      },
    }),
  );
  assert.equal(result.success, false);
});

// ---------------------------------------------------------------------------
// Real-DB integration tests: the deterministic workflow, qualification
// guardrails, and the new supervisionMode-gated Sales-promotion authority
// check, exercised against a real disposable local SQLite database.
// ---------------------------------------------------------------------------

let tempDir;
let db, schema, workflowModule, qualifyTool, promoteTool, saveProspectTool, RequestContext;

function trustedWorkflowRequestContext(businessId, employeeId) {
  return new RequestContext([
    ["businessId", businessId],
    ["employeeId", employeeId],
  ]);
}

const BIZ = "biz-outreach-pipeline";

test.before(async () => {
  tempDir = await mkdtemp(path.join(os.tmpdir(), "kuba-outreach-pipeline-"));
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
  workflowModule = await import(
    "@/mastra/workflows/outreach-prospect-workflow"
  );
  ({ qualifyOutreachProspectTool: qualifyTool } = await import(
    "@/mastra/tools/qualify-outreach-prospect"
  ));
  ({ promoteOutreachProspectToSalesTool: promoteTool } = await import(
    "@/mastra/tools/promote-outreach-prospect-to-sales"
  ));
  ({ saveOutreachProspectTool: saveProspectTool } = await import(
    "@/mastra/tools/save-outreach-prospect"
  ));
  ({ RequestContext } = await import("@mastra/core/request-context"));

  const now = new Date();
  await db.insert(schema.businesses).values({
    id: BIZ,
    name: "Outreach Pipeline Test Biz",
    slug: "outreach-pipeline-test-biz",
    plan: "pro",
    status: "active",
    createdAt: now,
    updatedAt: now,
  });

  for (const [id, mode] of [
    ["emp-owner-supervised", "owner_supervised"],
    ["emp-assistant", "assistant"],
    ["emp-operator", "operator"],
    ["emp-autonomous", "autonomous"],
  ]) {
    await db.insert(schema.aiEmployees).values({
      id,
      businessId: BIZ,
      name: "Kuba Outreach",
      type: "outreach",
      supervisionMode: mode,
      status: "active",
      createdAt: now,
      updatedAt: now,
    });
  }
});

test.after(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

test("tenant context is server-pinned: a tool call with no employeeId in requestContext throws rather than proceeding", async () => {
  await assert.rejects(() =>
    qualifyTool.execute(
      {
        prospectId: "does-not-matter",
        status: "nurture",
        icpFitScore: 50,
        reason: "Reason text long enough to pass the minimum length check.",
      },
      { requestContext: fakeRequestContext({ businessId: BIZ }) },
    ),
  );
});

test("multi-evidence persistence via the deterministic workflow returns every evidence id, independently verified in the database", async () => {
  const run = await workflowModule.outreachProspectWorkflow.createRun();
  const requestContext = trustedWorkflowRequestContext(BIZ, "emp-autonomous");

  const inputData = {
    prospect: {
      companyName: "MultiEvidence Freight Ltd",
      website: "https://multievidence-freight.example.com",
      country: "Ghana",
    },
    evidence: [
      {
        findingType: "company_identity",
        claim: "Official site confirms the company operates a logistics fleet.",
        classification: "confirmed",
        sourceUrl: "https://multievidence-freight.example.com/about",
        sourceTier: 1,
        sourceType: "official_website",
      },
      {
        findingType: "hiring",
        claim: "Careers page lists open customer-service and dispatch roles.",
        classification: "confirmed",
        sourceUrl: "https://multievidence-freight.example.com/careers",
        sourceTier: 1,
        sourceType: "official_website",
        buyingSignalType: "hiring",
        buyingSignalStrength: "medium",
      },
      {
        findingType: "expansion",
        claim: "A regional trade publication reports a new regional depot opening.",
        classification: "confirmed",
        sourceUrl: "https://trade-news.example.com/multievidence-freight-depot",
        sourceTier: 2,
        sourceType: "industry_publication",
        buyingSignalType: "expansion",
        buyingSignalStrength: "medium",
      },
    ],
    contact: { available: false, reason: "No public contact page found." },
    qualification: {
      status: "qualified",
      icpFitScore: 75,
      reason: "Confirmed Tier 1/2 hiring and expansion signals support an addressable need.",
    },
  };

  const result = await run.start({ inputData, requestContext });

  assert.equal(result.status, "success");
  assert.equal(result.result.success, true);
  assert.equal(result.result.status, "completed");
  assert.equal(result.result.evidenceCount, 3);
  assert.equal(result.result.evidenceIds.length, 3);

  const persistedEvidence = await db
    .select({ id: schema.outreachResearchEvidence.id })
    .from(schema.outreachResearchEvidence)
    .where(
      (await import("drizzle-orm")).eq(
        schema.outreachResearchEvidence.prospectId,
        result.result.prospectId,
      ),
    );

  assert.equal(persistedEvidence.length, 3);
  const persistedIds = new Set(persistedEvidence.map((row) => row.id));
  for (const id of result.result.evidenceIds) {
    assert.ok(persistedIds.has(id), `evidence id ${id} must be independently verifiable in the database`);
  }
});

test("the workflow accepts explicit null values from the research package (what the real model actually returns) without failing tool input validation", async () => {
  const run = await workflowModule.outreachProspectWorkflow.createRun();
  const requestContext = trustedWorkflowRequestContext(BIZ, "emp-autonomous");

  const inputData = {
    prospect: {
      companyName: "Null Boundary Regression Co",
      website: "https://null-boundary-regression.example.com",
      industry: null,
      country: "Ghana",
      city: null,
      description: null,
      discoverySource: null,
      discoveryQuery: null,
    },
    evidence: [
      {
        findingType: "company_identity",
        claim: "Official site confirms the company exists.",
        classification: "confirmed",
        sourceUrl: "https://null-boundary-regression.example.com/about",
        sourceTitle: null,
        sourceTier: 1,
        sourceType: "official_website",
        buyingSignalType: null,
        buyingSignalStrength: null,
        observedAt: null,
      },
    ],
    contact: { available: false, reason: "No public contact page found." },
    qualification: {
      status: "nurture",
      icpFitScore: 50,
      reason: "Organizational fit looks reasonable but evidence is limited so far.",
    },
  };

  const result = await run.start({ inputData, requestContext });

  assert.equal(result.status, "success");
  assert.equal(result.result.success, true);
  assert.equal(result.result.prospectPersisted, true);
  assert.equal(result.result.evidencePersisted, true);
});

test("a plain date-only observedAt (e.g. from a Wikipedia-style source) is normalized to a real ISO timestamp instead of failing tool validation", async () => {
  const run = await workflowModule.outreachProspectWorkflow.createRun();
  const requestContext = trustedWorkflowRequestContext(BIZ, "emp-autonomous");

  const inputData = {
    prospect: {
      companyName: "Date Normalization Regression Co",
      country: "Ghana",
    },
    evidence: [
      {
        findingType: "company_profile",
        claim: "An encyclopedia entry describes the company's founding.",
        classification: "confirmed",
        sourceUrl: "https://en.wikipedia.org/wiki/Date_Normalization_Regression_Co",
        sourceTier: 2,
        sourceType: "wiki",
        // Exactly the shape a real model returns: a plain date, not a full
        // ISO datetime. saveOutreachEvidenceTool requires a strict ISO
        // datetime; the workflow must normalize this rather than fail.
        observedAt: "2023-10-10",
      },
    ],
    contact: { available: false, reason: "No public contact page found." },
    qualification: {
      status: "nurture",
      icpFitScore: 50,
      reason: "Organizational fit looks reasonable but evidence is limited so far.",
    },
  };

  const result = await run.start({ inputData, requestContext });

  assert.equal(result.status, "success");
  assert.equal(result.result.success, true);
  assert.equal(result.result.evidencePersisted, true);

  const [row] = await db
    .select({ observedAt: schema.outreachResearchEvidence.observedAt })
    .from(schema.outreachResearchEvidence)
    .where(
      (await import("drizzle-orm")).eq(
        schema.outreachResearchEvidence.id,
        result.result.evidenceIds[0],
      ),
    );

  assert.ok(row.observedAt instanceof Date);
  assert.equal(row.observedAt.toISOString().slice(0, 10), "2023-10-10");
});

test("identity conflict stops downstream persistence: no evidence is attached to the conflicting prospect, and the conflict is reported truthfully", async () => {
  const requestContext = trustedWorkflowRequestContext(BIZ, "emp-autonomous");

  const first = await (await workflowModule.outreachProspectWorkflow.createRun()).start({
    inputData: {
      prospect: {
        companyName: "Conflict Original Co",
        website: "https://conflict-example.example.com",
        country: "Ghana",
      },
      evidence: [
        {
          findingType: "company_identity",
          claim: "Official site describes Conflict Original Co.",
          classification: "confirmed",
          sourceUrl: "https://conflict-example.example.com/about",
          sourceTier: 1,
          sourceType: "official_website",
        },
      ],
      contact: { available: false, reason: "No public contact page found." },
      qualification: {
        status: "nurture",
        icpFitScore: 50,
        reason: "Organizational fit looks reasonable but evidence is limited so far.",
      },
    },
    requestContext,
  });

  assert.equal(first.status, "success");
  const existingProspectId = first.result.prospectId;

  const second = await (await workflowModule.outreachProspectWorkflow.createRun()).start({
    inputData: {
      prospect: {
        companyName: "Totally Unrelated Name Ltd",
        website: "https://conflict-example.example.com",
        country: "Ghana",
      },
      evidence: [
        {
          findingType: "company_identity",
          claim: "A directory lists Totally Unrelated Name Ltd at this domain.",
          classification: "unknown",
        },
      ],
      contact: { available: false, reason: "No public contact page found." },
      qualification: {
        status: "nurture",
        icpFitScore: 50,
        reason: "Organizational fit looks reasonable but evidence is limited so far.",
      },
    },
    requestContext,
  });

  assert.equal(second.status, "failed");
  const prospectStep = second.steps[saveProspectTool.id];
  assert.equal(prospectStep.output.success, false);
  assert.equal(prospectStep.output.code, "IDENTITY_CONFLICT");
  assert.equal(prospectStep.output.conflict.existingProspectId, existingProspectId);

  // No save-outreach-evidence step ever ran for the conflicting attempt.
  assert.equal(second.steps["save-outreach-evidence"], undefined);

  // And the database confirms no new evidence exists beyond the original
  // prospect's single record.
  const evidenceForOriginal = await db
    .select({ id: schema.outreachResearchEvidence.id })
    .from(schema.outreachResearchEvidence)
    .where(
      (await import("drizzle-orm")).eq(
        schema.outreachResearchEvidence.prospectId,
        existingProspectId,
      ),
    );
  assert.equal(evidenceForOriginal.length, 1);
});

test("qualification without a credible buying signal remains rejected even with strong confirmed evidence", async () => {
  const requestContext = fakeRequestContext({
    businessId: BIZ,
    employeeId: "emp-autonomous",
  });

  const saved = await saveProspectTool.execute(
    { companyName: "NoSignal Capability Overlap Co", country: "Ghana" },
    { requestContext },
  );
  assert.equal(saved.success, true);

  const { saveOutreachEvidenceTool } = await import(
    "@/mastra/tools/save-outreach-evidence"
  );
  await saveOutreachEvidenceTool.execute(
    {
      prospectId: saved.prospect.id,
      findingType: "capability",
      claim: "Official site confirms the company operates in a target industry.",
      classification: "confirmed",
      sourceUrl: "https://nosignal-example.example.com/about",
      sourceTier: 1,
      sourceType: "official_website",
    },
    { requestContext },
  );

  const qualifyResult = await qualifyTool.execute(
    {
      prospectId: saved.prospect.id,
      status: "qualified",
      icpFitScore: 80,
      reason: "Industry and capability overlap alone, with no confirmed buying signal.",
    },
    { requestContext },
  );

  assert.equal(qualifyResult.success, false);
  assert.match(qualifyResult.error, /buying-signal|addressable-need/);
});

test("a confirmed Tier 1/2 buying-signal evidence record allows qualification", async () => {
  const requestContext = fakeRequestContext({
    businessId: BIZ,
    employeeId: "emp-autonomous",
  });

  const saved = await saveProspectTool.execute(
    { companyName: "RealSignal Expansion Co", country: "Ghana" },
    { requestContext },
  );
  assert.equal(saved.success, true);

  const { saveOutreachEvidenceTool } = await import(
    "@/mastra/tools/save-outreach-evidence"
  );
  await saveOutreachEvidenceTool.execute(
    {
      prospectId: saved.prospect.id,
      findingType: "expansion",
      claim: "Official press release announces a new regional office opening.",
      classification: "confirmed",
      sourceUrl: "https://realsignal-example.example.com/press/expansion",
      sourceTier: 1,
      sourceType: "official_press_release",
      buyingSignalType: "expansion",
      buyingSignalStrength: "high",
    },
    { requestContext },
  );

  const qualifyResult = await qualifyTool.execute(
    {
      prospectId: saved.prospect.id,
      status: "qualified",
      icpFitScore: 78,
      reason: "Confirmed Tier 1 expansion signal supports an addressable need for our services.",
    },
    { requestContext },
  );

  assert.equal(qualifyResult.success, true);
  assert.equal(qualifyResult.qualification.status, "qualified");
});

// --- Sales-promotion authority gate (supervisionMode) ----------------------

async function makeQualifiedProspect(employeeId, companyName) {
  const requestContext = fakeRequestContext({ businessId: BIZ, employeeId });

  const saved = await saveProspectTool.execute(
    { companyName, country: "Ghana" },
    { requestContext },
  );

  const { saveOutreachEvidenceTool } = await import(
    "@/mastra/tools/save-outreach-evidence"
  );
  await saveOutreachEvidenceTool.execute(
    {
      prospectId: saved.prospect.id,
      findingType: "expansion",
      claim: "Official press release announces new market entry.",
      classification: "confirmed",
      sourceUrl: `https://${saved.prospect.id}.example.com/press`,
      sourceTier: 1,
      sourceType: "official_press_release",
      buyingSignalType: "expansion",
      buyingSignalStrength: "high",
    },
    { requestContext },
  );

  await qualifyTool.execute(
    {
      prospectId: saved.prospect.id,
      status: "qualified",
      icpFitScore: 80,
      reason: "Confirmed Tier 1 expansion signal supports an addressable need.",
    },
    { requestContext },
  );

  return saved.prospect.id;
}

test("Sales promotion is refused when the Outreach employee is not set to autonomous", async () => {
  const prospectId = await makeQualifiedProspect(
    "emp-owner-supervised",
    "GatedPromotion OwnerSupervised Co",
  );

  const result = await promoteTool.execute(
    {
      prospectId,
      recommendedNextAction: "Reach out about the new regional office.",
    },
    {
      requestContext: fakeRequestContext({
        businessId: BIZ,
        employeeId: "emp-owner-supervised",
      }),
    },
  );

  assert.equal(result.success, false);
  assert.equal(result.code, "PROMOTION_REQUIRES_AUTONOMY");

  const leadRows = await db
    .select()
    .from(schema.leads)
    .where((await import("drizzle-orm")).eq(schema.leads.businessId, BIZ));
  assert.equal(
    leadRows.some((row) => row.name === "GatedPromotion OwnerSupervised Co"),
    false,
    "no Sales lead should have been created while promotion is not authorized",
  );
});

test("Sales promotion succeeds, and remains idempotent, when the Outreach employee is set to autonomous", async () => {
  const prospectId = await makeQualifiedProspect(
    "emp-autonomous",
    "GatedPromotion Autonomous Co",
  );

  const requestContext = fakeRequestContext({
    businessId: BIZ,
    employeeId: "emp-autonomous",
  });

  const first = await promoteTool.execute(
    {
      prospectId,
      recommendedNextAction: "Reach out about the new regional office.",
    },
    { requestContext },
  );
  assert.equal(first.success, true);
  assert.equal(first.created, true);

  const second = await promoteTool.execute(
    {
      prospectId,
      recommendedNextAction: "Reach out about the new regional office.",
    },
    { requestContext },
  );
  assert.equal(second.success, true);
  assert.equal(second.deduplicated, true);
  assert.equal(second.lead.id, first.lead.id);

  const leadRows = await db
    .select()
    .from(schema.leads)
    .where(
      (await import("drizzle-orm")).eq(
        schema.leads.businessId,
        BIZ,
      ),
    );
  const matchingLeads = leadRows.filter(
    (row) => row.name === "GatedPromotion Autonomous Co",
  );
  assert.equal(matchingLeads.length, 1, "exactly one Sales lead must exist");
});

test("simultaneous duplicate Sales promotion requests create exactly one lead (atomic claim)", async () => {
  const prospectId = await makeQualifiedProspect(
    "emp-autonomous",
    "GatedPromotion Concurrent Co",
  );

  const requestContext = fakeRequestContext({
    businessId: BIZ,
    employeeId: "emp-autonomous",
  });

  // Promise.allSettled rather than Promise.all: a single-file local SQLite
  // connection can surface a transient SQLITE_BUSY on one of the two racing
  // transactions (an artifact of the local test database, not present
  // against the real hosted Turso database this was manually verified
  // against). The atomicity guarantee under test is that AT MOST ONE lead
  // ever gets created, regardless of how the individual calls settle.
  const settled = await Promise.allSettled([
    promoteTool.execute(
      { prospectId, recommendedNextAction: "First concurrent attempt." },
      { requestContext },
    ),
    promoteTool.execute(
      { prospectId, recommendedNextAction: "Second concurrent attempt." },
      { requestContext },
    ),
  ]);

  const fulfilledSuccesses = settled
    .filter((entry) => entry.status === "fulfilled")
    .map((entry) => entry.value)
    .filter((value) => value.success);

  assert.ok(
    fulfilledSuccesses.length >= 1,
    "at least one concurrent promotion attempt must succeed",
  );
  assert.equal(
    fulfilledSuccesses.filter((value) => value.created).length,
    1,
    "exactly one of the concurrent attempts may report having created the lead",
  );

  const leadRows = await db
    .select()
    .from(schema.leads)
    .where(
      (await import("drizzle-orm")).eq(
        schema.leads.businessId,
        BIZ,
      ),
    );
  const matchingLeads = leadRows.filter(
    (row) => row.name === "GatedPromotion Concurrent Co",
  );
  assert.equal(
    matchingLeads.length,
    1,
    "concurrent promotion attempts must create exactly one lead",
  );
});
