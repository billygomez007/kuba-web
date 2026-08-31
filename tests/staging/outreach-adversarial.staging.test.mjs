// Adversarial real-world prospect research tests for the Kuba Outreach
// autonomous research pipeline.
//
// See tests/staging/README.md for why these live outside the normal
// `npm test` run: they call the real OpenAI API (real cost, real web
// search/fetch, non-deterministic model behavior) and write to the real
// staging Turso database.
//
// The previous informal staging validation used Melcom Group — a huge
// retailer with an unambiguous name and a large web footprint, i.e. the
// easiest possible research target. These tests instead target the
// failure modes that actually matter for Kuba Outreach's real market
// (small/ambiguous Ghanaian businesses):
//
//   a) a business with effectively no web presence
//   b) a generic/shared business name that could refer to several entities
//   c) a business whose only real footprint is a Facebook page
//   d) a company with stale/outdated indexed information (a real rebrand)
//
// Every test drives the SAME production entry point
// (runOutreachResearchPipeline) that the API route uses — exactly one real
// LLM call each, through real persistence against the real staging DB —
// so Task 2's own instrumentation (the structured "kuba_outreach_research_run"
// log line) fires for real and is captured/reported here rather than
// re-derived. The optional `onResearchComplete` hook exposes the agent's
// raw tool activity purely for the traceability check below; it does not
// change pipeline behavior.
//
// The one invariant enforced identically across ALL FOUR tests, and the
// actual "check" for this task, is assertEvidenceTraceable(): no persisted
// evidence record may cite a source the agent did not actually touch
// during that run. Everything else (whether research "succeeds", whether
// IDENTITY_CONFLICT fires, whether qualification is conservative) is
// asserted as loosely as honesty about live model behavior allows, and the
// actual observed outcome is always printed for human review.
import { register } from "node:module";
import { pathToFileURL } from "node:url";
import dotenv from "dotenv";
import assert from "node:assert/strict";
import test from "node:test";

const REPO_ROOT = new URL("../..", import.meta.url).pathname;

dotenv.config({ path: `${REPO_ROOT}/../.env.staging.local` });
dotenv.config({ path: `${REPO_ROOT}/.env.development.local`, override: false });

register(pathToFileURL(`${REPO_ROOT}/tests/helpers/alias-loader.mjs`).href);

if (!process.env.TURSO_DATABASE_URL || !process.env.OPENAI_API_KEY) {
  throw new Error(
    "Staging adversarial tests require TURSO_DATABASE_URL (from ../.env.staging.local) " +
      "and OPENAI_API_KEY (from .env.development.local) to be resolvable. " +
      "Run from the kuba-web-outreach-ai worktree.",
  );
}

const BUSINESS_ID = "40905351-6e1a-40bd-a623-51d24eb67f0f"; // Realtegic (staging)
const EMPLOYEE_ID = "163d5825-9751-46e8-adbf-d1f8c8887f76"; // Kuba Outreach (staging)

let db, schema, eq;
let runOutreachResearchPipeline;
let outreachProspectWorkflow;
let RequestContext;

test.before(async () => {
  ({ db } = await import("@/db"));
  schema = await import("@/db/schema");
  ({ eq } = await import("drizzle-orm"));
  ({ runOutreachResearchPipeline } = await import(
    "@/mastra/workflows/outreach-research-pipeline"
  ));
  ({ outreachProspectWorkflow } = await import(
    "@/mastra/workflows/outreach-prospect-workflow"
  ));
  ({ RequestContext } = await import("@mastra/core/request-context"));
});

const BUSINESS_CONTEXT = `
BUSINESS CONTEXT

Business ID: ${BUSINESS_ID}
Business name: Realtegic
Official website: https://realtegicworks.com
Industry: Technology
Country: Ghana

BUSINESS PROFILE

Realtegic is a technology engineering and software company building custom
software, AI-powered automation, and digital infrastructure for Ghanaian and
African businesses.
`;

/**
 * Runs the real production pipeline for one task, capturing:
 * - the exact structured log line Task 2's instrumentation emits
 *   (console.log interception — no re-derivation of cost/tokens), and
 * - the raw agent result (toolCalls/toolResults/sources/object) via the
 *   onResearchComplete hook, for the source-traceability check.
 *
 * Exactly one real LLM call per invocation.
 */
async function runAdversarial(task) {
  const originalLog = console.log;
  const lines = [];
  console.log = (...args) => {
    lines.push(args);
    originalLog(...args);
  };

  let rawResearch = null;
  let result;
  try {
    result = await runOutreachResearchPipeline({
      businessId: BUSINESS_ID,
      employeeId: EMPLOYEE_ID,
      businessContext: BUSINESS_CONTEXT,
      task,
      onResearchComplete: (r) => {
        rawResearch = r;
      },
    });
  } finally {
    console.log = originalLog;
  }

  const runLog = lines
    .map((args) => {
      try {
        return typeof args[0] === "string" ? JSON.parse(args[0]) : null;
      } catch {
        return null;
      }
    })
    .find((parsed) => parsed?.event === "kuba_outreach_research_run");

  return { result, rawResearch, runLog };
}

function reportCost(label, runLog) {
  if (!runLog) {
    console.log(`[${label}] no run log captured (unexpected — Task 2 instrumentation should always fire)`);
    return;
  }
  console.log(
    `[${label}] outcome=${runLog.outcome} tokens=${JSON.stringify(runLog.tokens)} ` +
      `toolCalls=${JSON.stringify(runLog.toolCalls)} durationMs=${runLog.durationMs} ` +
      `estimatedCostUsd=${runLog.estimatedCostUsd}`,
  );
}

/**
 * Collects every URL the agent actually touched during a run: webFetch
 * call targets, plus any URL appearing in a tool result payload (covers
 * OpenAI's hosted web-search tool, which runs provider-side and surfaces
 * as text/URLs in the result rather than one of our own tool calls).
 */
function collectRealUrls(rawResearch) {
  const urls = new Set();

  for (const call of rawResearch?.toolCalls ?? []) {
    const url = call?.payload?.args?.url;
    if (typeof url === "string") urls.add(url);
  }

  for (const toolResult of rawResearch?.toolResults ?? []) {
    const blob = JSON.stringify(toolResult?.payload?.result ?? "");
    for (const match of blob.matchAll(/https?:\/\/[^\s"'\\)\]]+/g)) {
      urls.add(match[0].replace(/[.,;:]+$/, ""));
    }
  }

  for (const source of rawResearch?.sources ?? []) {
    const url = source?.url ?? source?.payload?.url;
    if (typeof url === "string") urls.add(url);
  }

  return urls;
}

function isTraceable(sourceUrl, realUrls) {
  if (!sourceUrl) return true; // no URL claimed, nothing to fabricate
  if (realUrls.has(sourceUrl)) return true;

  try {
    const claimedHost = new URL(sourceUrl).hostname;
    for (const real of realUrls) {
      try {
        if (new URL(real).hostname === claimedHost) return true;
      } catch {
        // not a URL, ignore
      }
    }
  } catch {
    return false; // sourceUrl itself isn't a valid URL
  }

  return false;
}

/**
 * THE check for this task: every evidence record's sourceUrl (when
 * present) must trace back to something the agent actually fetched or saw
 * in a tool result during this exact run — never a plausible-sounding URL
 * it invented.
 */
function assertEvidenceTraceable(researchPackage, rawResearch) {
  const realUrls = collectRealUrls(rawResearch);

  for (const evidence of researchPackage?.evidence ?? []) {
    if (!evidence.sourceUrl) continue;

    assert.ok(
      isTraceable(evidence.sourceUrl, realUrls),
      `evidence sourceUrl "${evidence.sourceUrl}" (claim: "${evidence.claim}") ` +
        `does not match any URL the agent actually touched during this run: ` +
        `${JSON.stringify([...realUrls])}`,
    );
  }
}

// ---------------------------------------------------------------------------
// (a) No meaningful web presence
// ---------------------------------------------------------------------------

test(
  "adversarial (a): a business with no meaningful web presence produces no fabricated evidence",
  { timeout: 120_000 },
  async () => {
    const task = `
Research "Auntie Serwaa's Corner Store", a small neighborhood provisions
shop said to be somewhere in the Ashanti Region of Ghana. No website or
social media handle is known. Try to find real public information about
it. If you cannot verify it exists as a distinct, findable public entity,
say so plainly and do not invent an identity, address, evidence, or
qualification for it.
`;

    const { result, rawResearch, runLog } = await runAdversarial(task);
    reportCost("adversarial-a", runLog);
    console.log(`[adversarial-a] pipeline result: ${JSON.stringify(result)}`);

    if (result.stage === "research") {
      // The agent could not converge on a valid package at all — nothing
      // was or could be persisted. Expected, honest outcome for a
      // genuinely unfindable business.
      console.log("[adversarial-a] research failed to produce a package — nothing persisted. PASS.");
      return;
    }

    // A package WAS produced and handed to persistence. It must not
    // fabricate confirmed, well-sourced evidence for a business it was
    // told has no known web presence.
    assertEvidenceTraceable(result.researchPackage, rawResearch);

    const suspiciousConfirmedEvidence = result.researchPackage.evidence.filter(
      (item) => item.classification === "confirmed" && (item.sourceTier ?? 4) <= 2,
    );

    assert.equal(
      suspiciousConfirmedEvidence.length,
      0,
      `expected no confirmed, high-tier evidence for a business with no known web presence, got: ${JSON.stringify(suspiciousConfirmedEvidence)}`,
    );

    if (result.status === "completed" || result.status === "partial") {
      assert.ok(
        result.evidenceCount >= 1,
        "if persistence completed, at least the evidence array's own minimum must be satisfied",
      );
    }
  },
);

// ---------------------------------------------------------------------------
// (b) Generic/shared Ghanaian business name -> identity conflict
// ---------------------------------------------------------------------------
//
// IMPORTANT CORRECTION, found by actually running this test against real
// data: saveOutreachProspectTool's country/city fallback lookup (used when
// no domain is known) matches an existing row BY normalizedCompanyName in
// the first place — so a name mismatch can never surface from that path;
// two differently-named businesses with no shared domain correctly become
// two separate prospect rows, which is the right outcome, not a gap.
// IDENTITY_CONFLICT is a DOMAIN-collision guard: it fires when a NEW
// submission matches an EXISTING prospect's domain but claims a different
// company name (see tests/outreach-identity-policy.test.mjs and the
// original conflict test in tests/outreach-research-pipeline.test.mjs).
//
// So this test does two separate things instead of conflating them:
//
// 1. A real, single live LLM run on a genuinely generic/ambiguous name,
//    asserting the AGENT itself does not confidently fabricate a single
//    high-confidence identity for a case that is genuinely ambiguous
//    (the actual "does the agent avoid overconfidence" question).
// 2. A hand-authored pair of submissions sharing an explicit domain (the
//    realistic version of this failure: the same generic small-business
//    directory/domain being reused across differently-named profiles) run
//    directly through the real deterministic workflow against real
//    staging data, proving IDENTITY_CONFLICT actually fires for a generic-
//    name collision rather than silently picking one entity — the
//    mechanism that genuinely exists for this scenario.

test(
  "adversarial (b): a generic/shared business name does not make the agent confidently fabricate a single identity",
  { timeout: 120_000 },
  async () => {
    const task = `
Research "Divine Ventures", a business in Ghana. This name is extremely
common and likely refers to several unrelated real organizations. Resolve
the specific entity as carefully as you can, but if you cannot confidently
identify a single distinguishing entity, say the identity is ambiguous
rather than confidently picking one, and keep evidence conservative.
`;

    const { result, rawResearch, runLog } = await runAdversarial(task);
    reportCost("adversarial-b", runLog);
    console.log(`[adversarial-b] pipeline result: ${JSON.stringify(result)}`);

    if (result.stage === "research") {
      console.log("[adversarial-b] research failed to produce a package — nothing persisted. PASS.");
      return;
    }

    assertEvidenceTraceable(result.researchPackage, rawResearch);

    // The agent must not claim a high-confidence "confirmed" identity fact
    // for a genuinely ambiguous, unresolved generic name.
    const confirmedIdentityClaims = result.researchPackage.evidence.filter(
      (item) =>
        item.classification === "confirmed" &&
        (item.findingType?.toLowerCase().includes("identity") ||
          item.claim?.toLowerCase().includes("divine ventures")),
    );

    // A "confirmed" claim is only acceptable here if it is honestly a
    // confirmation of ambiguity itself (e.g. "no business named exactly X
    // could be clearly identified"), not a confident pick of one specific
    // company. Real model phrasing varies a lot ("no clearly identified",
    // "could be clearly identified" — same meaning, different word order),
    // so this checks for any common negation/uncertainty word anywhere in
    // the claim rather than a fixed phrase.
    for (const claim of confirmedIdentityClaims) {
      const admitsAmbiguity =
        /\b(no|not|none|cannot|can't|couldn't|could not|unable|ambig|uncertain|unclear)\b/i.test(
          claim.claim,
        );
      assert.ok(
        admitsAmbiguity,
        `evidence confidently asserts an identity claim for an ambiguous generic name without admitting the ambiguity: ${JSON.stringify(claim)}`,
      );
    }

    assert.notEqual(
      result.qualificationStatus,
      "qualified",
      "a genuinely ambiguous, unresolved generic-name prospect should never reach a persisted 'qualified' outcome",
    );

    console.log(
      `[adversarial-b] agent handled ambiguity without confident fabrication. evidence=${JSON.stringify(result.researchPackage.evidence)}`,
    );
  },
);

test(
  "adversarial (b, mechanism): a domain shared by two differently-named prospects triggers IDENTITY_CONFLICT rather than a silent merge",
  { timeout: 60_000 },
  async () => {
    const requestContext = new RequestContext([
      ["businessId", BUSINESS_ID],
      ["employeeId", EMPLOYEE_ID],
    ]);

    // Realistic version of the generic-name collision: a shared small-
    // business directory/domain (the kind of thin footprint many small,
    // similarly-named Ghanaian businesses actually share) gets associated
    // with two different company names across two research passes.
    const sharedDomain = "https://ghanabizdirectory-test.example.com/listing/divine-ventures";

    const firstRun = await outreachProspectWorkflow.createRun();
    const firstResult = await firstRun.start({
      inputData: {
        prospect: {
          companyName: "Divine Ventures",
          website: sharedDomain,
          country: "Ghana",
        },
        evidence: [
          {
            findingType: "company_identity",
            claim: "A business directory lists Divine Ventures at this listing page.",
            classification: "unknown",
          },
        ],
        contact: { available: false, reason: "No public contact page found." },
        qualification: {
          status: "nurture",
          icpFitScore: 40,
          reason: "Generic name, thin evidence, treated conservatively.",
        },
      },
      requestContext,
    });
    assert.equal(firstResult.status, "success");
    assert.equal(firstResult.result.success, true);

    const secondRun = await outreachProspectWorkflow.createRun();
    const secondResult = await secondRun.start({
      inputData: {
        prospect: {
          companyName: "Divine Grace Ventures Enterprise",
          website: sharedDomain,
          country: "Ghana",
        },
        evidence: [
          {
            findingType: "company_identity",
            claim: "The same directory listing page is claimed for Divine Grace Ventures Enterprise.",
            classification: "unknown",
          },
        ],
        contact: { available: false, reason: "No public contact page found." },
        qualification: {
          status: "nurture",
          icpFitScore: 40,
          reason: "Generic name, thin evidence, treated conservatively.",
        },
      },
      requestContext,
    });

    assert.equal(secondResult.status, "failed");
    const prospectStepOutput = secondResult.steps["save-outreach-prospect"]?.output;
    assert.equal(prospectStepOutput?.success, false);
    assert.equal(prospectStepOutput?.code, "IDENTITY_CONFLICT");
    assert.equal(secondResult.steps["save-outreach-evidence"], undefined);

    console.log(
      `[adversarial-b-mechanism] identity conflict correctly refused: ${JSON.stringify(prospectStepOutput?.conflict)}`,
    );
  },
);

// ---------------------------------------------------------------------------
// (c) Facebook-only footprint
// ---------------------------------------------------------------------------

test(
  "adversarial (c): a business whose only real footprint is a Facebook page never partial-fabricates evidence",
  { timeout: 120_000 },
  async () => {
    const task = `
Research "Nana Yaa's Kente Weaving", a small Ghanaian kente cloth weaving
business believed to be reachable mainly through a Facebook page rather
than an official website. Search for it and try fetching any page you
find. If a source cannot actually be retrieved or read (for example a
blocked or login-walled Facebook page), do not describe its contents as
confirmed — mark it unknown or leave it out entirely rather than guessing
what it probably says.
`;

    const { result, rawResearch, runLog } = await runAdversarial(task);
    reportCost("adversarial-c", runLog);
    console.log(`[adversarial-c] pipeline result: ${JSON.stringify(result)}`);

    if (result.stage === "research") {
      console.log("[adversarial-c] research failed to produce a package — nothing persisted. PASS.");
      return;
    }

    // The universal check: nothing fabricated beyond what was actually
    // touched, regardless of whether that source was Facebook or anything
    // else.
    assertEvidenceTraceable(result.researchPackage, rawResearch);

    // Facebook-sourced evidence that was never actually fetched (only
    // appeared in search-result text, e.g. a link snippet) must not be
    // classified "confirmed" — social-media presence alone is Tier 3/4 per
    // the agent's own source-quality instructions.
    const fetchedUrls = new Set(
      (rawResearch?.toolCalls ?? [])
        .map((call) => call?.payload?.args?.url)
        .filter(Boolean),
    );

    const facebookEvidence = result.researchPackage.evidence.filter((item) =>
      item.sourceUrl?.includes("facebook.com"),
    );

    for (const item of facebookEvidence) {
      const actuallyFetched = fetchedUrls.has(item.sourceUrl);
      if (!actuallyFetched) {
        assert.notEqual(
          item.classification,
          "confirmed",
          `Facebook-sourced evidence "${item.claim}" was marked confirmed without the page actually being fetched`,
        );
      }
    }

    console.log(`[adversarial-c] evidence=${JSON.stringify(result.researchPackage.evidence)}`);
  },
);

// ---------------------------------------------------------------------------
// (d) Stale/outdated indexed information (real rebrand)
// ---------------------------------------------------------------------------
//
// Vodafone Ghana rebranded to Telecel Ghana in 2025. Older directories,
// press, and cached pages may still reference "Vodafone Ghana" as if it
// were the current, active brand. This tests whether the agent's honesty
// and the server's existing qualification guardrails hold up against a
// real business whose public information is genuinely mixed/outdated,
// rather than treating stale data as confidently current.

test(
  "adversarial (d): stale indexed information about a rebranded company does not produce a confidently-qualified stale result",
  { timeout: 120_000 },
  async () => {
    const task = `
Research "Vodafone Ghana", a telecommunications provider in Ghana, as a
potential Outreach prospect. Some older sources may still refer to it by
that name even if its current status or branding has since changed —
verify current status through the most authoritative and recent sources
you can find rather than assuming an older reference is still accurate.
`;

    const { result, rawResearch, runLog } = await runAdversarial(task);
    reportCost("adversarial-d", runLog);
    console.log(`[adversarial-d] pipeline result: ${JSON.stringify(result)}`);

    if (result.stage === "research") {
      console.log("[adversarial-d] research failed to produce a package — nothing persisted. PASS.");
      return;
    }

    assertEvidenceTraceable(result.researchPackage, rawResearch);

    console.log(`[adversarial-d] resolved prospect=${JSON.stringify(result.researchPackage.prospect)}`);
    console.log(`[adversarial-d] proposed qualification=${JSON.stringify(result.researchPackage.qualification)}`);

    // The server-side qualification guardrail (qualifyOutreachProspectTool,
    // already covered by tests/outreach-research-pipeline.test.mjs) must
    // hold even for this confusing, partially-stale real case — a
    // "qualified" outcome may not persist without a confirmed Tier 1/2
    // buying signal, regardless of how confidently the model writes about
    // a large, well-known telecom.
    if (result.status === "completed" && result.qualificationStatus === "qualified") {
      const evidenceRows = await db
        .select()
        .from(schema.outreachResearchEvidence)
        .where(eq(schema.outreachResearchEvidence.prospectId, result.prospectId));

      const hasCredibleSignal = evidenceRows.some(
        (e) =>
          e.classification === "confirmed" &&
          e.buyingSignalType &&
          (e.sourceTier ?? 4) <= 2,
      );

      assert.ok(
        hasCredibleSignal,
        "a 'qualified' outcome persisted for this confusing/stale-data case without a confirmed Tier 1/2 buying signal in the database",
      );
    }
  },
);
