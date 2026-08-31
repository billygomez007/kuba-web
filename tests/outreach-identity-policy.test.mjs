import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

let prospectToolSource;
let workflowSource;
let researchPackageSchemaSource;

test.before(async () => {
  prospectToolSource = await readFile(
    "mastra/tools/save-outreach-prospect.ts",
    "utf8",
  );

  workflowSource = await readFile(
    "mastra/workflows/outreach-prospect-workflow.ts",
    "utf8",
  );

  researchPackageSchemaSource = await readFile(
    "mastra/schemas/outreach-research-package.ts",
    "utf8",
  );
});

test("Outreach prospect identity is scoped to trusted business and employee context", () => {
  assert.match(
    prospectToolSource,
    /requireBusinessId\(requestContext\)/,
  );

  assert.match(
    prospectToolSource,
    /requireEmployeeId\(requestContext\)/,
  );

  assert.doesNotMatch(
    prospectToolSource,
    /businessId:\s*z\./,
  );

  assert.doesNotMatch(
    prospectToolSource,
    /employeeId:\s*z\./,
  );
});

test("Outreach refuses automatic merge when the matched prospect company name conflicts", () => {
  assert.match(
    prospectToolSource,
    /existing\.normalizedCompanyName\s*!==\s*normalizedCompanyName/,
  );

  assert.match(
    prospectToolSource,
    /IDENTITY_CONFLICT/,
  );

  assert.match(
    prospectToolSource,
    /Automatic merge was refused/,
  );
});

test("Outreach records identity conflicts in the audit log", () => {
  assert.match(
    prospectToolSource,
    /ai\.outreach\.prospect\.identity_conflict/,
  );

  assert.match(
    prospectToolSource,
    /existingCompanyName/,
  );

  assert.match(
    prospectToolSource,
    /incomingCompanyName/,
  );

  assert.match(
    prospectToolSource,
    /promotedLeadId/,
  );
});

test("ordinary prospect enrichment preserves the matched prospect core identity", () => {
  assert.match(
    prospectToolSource,
    /companyName:\s*existing\.companyName/,
  );

  assert.match(
    prospectToolSource,
    /normalizedCompanyName:\s*existing\.normalizedCompanyName/,
  );

  assert.match(
    prospectToolSource,
    /website:\s*existing\.website\s*\|\|/,
  );

  assert.match(
    prospectToolSource,
    /normalizedDomain:\s*existing\.normalizedDomain\s*\|\|/,
  );
});

test("domain deduplication remains tenant scoped", () => {
  assert.match(
    prospectToolSource,
    /eq\(outreachProspects\.businessId,\s*businessId\)/,
  );

  assert.match(
    prospectToolSource,
    /outreachProspects\.normalizedDomain/,
  );
});

test("name fallback requires geographic identity instead of name-only matching", () => {
  assert.match(
    prospectToolSource,
    /if\s*\(!existing\s*&&\s*country\?\.trim\(\)\)/,
  );

  assert.match(
    prospectToolSource,
    /outreachProspects\.normalizedCompanyName/,
  );

  assert.match(
    prospectToolSource,
    /outreachProspects\.country/,
  );

  assert.match(
    prospectToolSource,
    /if\s*\(!existing\s*&&\s*!country\?\.trim\(\)\s*&&\s*city\?\.trim\(\)\)/,
  );
});

test("deterministic Outreach workflow accepts multiple evidence records", () => {
  // The evidence array shape now lives in the shared research-package
  // schema (mastra/schemas/outreach-research-package.ts) so the
  // research-only agent and this workflow can never drift apart; the
  // workflow imports it rather than redefining it.
  assert.match(
    researchPackageSchemaSource,
    /evidence:\s*z\s*\.array\(outreachEvidenceInputSchema\)\s*\.min\(1\)\s*\.max\(20\)/,
  );

  assert.match(
    workflowSource,
    /outreachResearchPackageSchema/,
  );

  assert.match(
    workflowSource,
    /\.foreach\(saveEvidenceStep\)/,
  );

  assert.match(
    workflowSource,
    /evidenceIds:\s*z\.array\(z\.string\(\)\)/,
  );
});

test("qualification cannot proceed unless every evidence persistence operation succeeded", () => {
  assert.match(
    workflowSource,
    /evidenceResults\.length\s*!==\s*initData\.evidence\.length/,
  );

  assert.match(
    workflowSource,
    /evidenceResults\.some\(\s*\(item\)\s*=>\s*!item\?\.success/,
  );

  assert.match(
    workflowSource,
    /Research evidence persistence could not be fully verified/,
  );
});

test("final workflow verification independently re-reads persisted evidence from the database", () => {
  assert.match(
    workflowSource,
    /\.from\(outreachResearchEvidence\)/,
  );

  assert.match(
    workflowSource,
    /persistedEvidenceIds/,
  );

  assert.match(
    workflowSource,
    /everyEvidenceVerified/,
  );

  assert.match(
    workflowSource,
    /evidenceIds\.every/,
  );
});
