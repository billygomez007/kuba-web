# Kuba Outreach Autonomous Research Pipeline — Report

## Executive result

The research-only agent, shared schema, and deterministic persistence pipeline are implemented, typechecked, unit/integration tested, and proven end-to-end against the real staging database with one live public company (Melcom Group). Production certification is **NOT YET GO**: no deployment, migration apply, or environment-variable change was made in this task, and none should happen without explicit owner sign-off (see "Before production").

## What changed

- `mastra/schemas/outreach-research-package.ts` (new) — the single shared zod contract (prospect/evidence/contact/qualification) for both the research agent's structured output and `outreachProspectWorkflow`'s input. `outreach-prospect-workflow.ts` now imports it instead of duplicating the shape.
- `mastra/agents/outreach-researcher.ts` (new) — research-only agent. Tools: `getBusinessKnowledge`, `webSearch`, `webFetch` only. No save/qualify/promote/messaging tool is wired in or referenced.
- `mastra/workflows/outreach-research-pipeline.ts` (new) — `runOutreachResearchPipeline()`: runs the researcher with `structuredOutput` (strict, schema-validated, `jsonPromptInjection: true` — see "Notable fix"), then hands the validated package to `outreachProspectWorkflow.createRun().start()`. All returned ids/counts/status come from the workflow's own DB-verified result, never from the model's object. On `IDENTITY_CONFLICT` from the prospect-save step, it stops and returns a truthful `identity_conflict` result instead of a generic failure — no evidence is ever attached to a conflicting prospect (downstream steps structurally never run).
- `mastra/tools/promote-outreach-prospect-to-sales.ts` — added an authority gate: promotion now requires the Outreach employee's `supervisionMode` (the existing AI-employee autonomy setting) to be `"autonomous"`; otherwise it returns `PROMOTION_REQUIRES_AUTONOMY` and creates no lead. The existing atomic claim-then-create transaction is unchanged.
- `mastra/agents/outreach.ts` — prompt updated to accurately describe the new promotion gate (no prompt/behavior contradiction).
- `app/api/ai/outreach/route.ts` — added `mode: "autonomous_research"` request path that runs the pipeline and persists a truthful conversation summary; the default conversational path (with the agent's own direct tools) is unchanged.
- `tests/outreach-identity-policy.test.mjs` — updated one assertion to the schema's new location; all 9 original tests still pass unmodified in intent.
- `tests/outreach-research-pipeline.test.mjs` (new, 22 tests) — tool-wiring/source checks, real zod schema validation (0/20/21 evidence, invalid enum, invalid/valid/unavailable contact), and real-DB integration tests (disposable local SQLite, same pattern as `tests/customer-operations-integration.test.mjs`) for: tenant-pinning, multi-evidence persistence, identity-conflict stop, qualification buying-signal gate, and the promotion authority gate including sequential and concurrent idempotency.

## Notable fix made along the way

OpenAI's native structured-output JSON schema rejects `"format": "uri"` (from zod's `.url()`), which the schema needs for real URL-strictness. Fixed by setting `jsonPromptInjection: true` on the researcher's `structuredOutput` config — the model emits JSON text instead of using OpenAI's native `response_format`, and the *full*, unweakened zod schema still validates it client-side.

## Verification evidence

- `npx tsc --noEmit`: clean except 2 pre-existing, unrelated `sendWhatsAppToPhone` errors (baseline, confirmed present before this task's changes).
- `npx eslint`: clean on all new/changed files.
- Full suite: **656/676 pass** (was 634/654). The 20 failures are the same pre-existing baseline set (3 AI permission/capability routes, migration reproducibility, 3 pricing policy, 13 WhatsApp/webhook) — zero new failures.
- Live staging run (business `Realtegic`, employee `Kuba Outreach`, real Turso staging DB, no synthetic/OpenAI test company): researched **Melcom Group** (melcomgroup.com), a real Ghanaian retail chain. Result: prospect + 2 real evidence records (official site, a real Modern Ghana news article) + 1 verified public contact + `nurture` qualification (65/100) — all independently re-queried straight from `outreach_prospects` / `outreach_research_evidence` / `outreach_contacts` / `audit_logs` via a raw libsql client outside the pipeline code, matching exactly. No Sales lead was created and no external message of any kind was sent (the pipeline has no tool capable of either).

## Before production

- No DB migration was applied by this task. `drizzle/0040_outreach_prospect_intelligence.sql` is present but uncommitted; confirm it matches `db/schema.ts` and apply it deliberately (staging already has the outreach tables from prior manual setup).
- Verify `OPENAI_API_KEY` is set in the real production environment (it is picked up from `.env.development.local` locally, which is not committed).
- Decide and configure `supervisionMode` deliberately per business for any Outreach employee that should be allowed to autonomously promote to Sales — the default (`owner_supervised`) now correctly blocks it.
- Run the focused Outreach suite (`node --experimental-strip-types --test tests/outreach-identity-policy.test.mjs tests/outreach-research-pipeline.test.mjs`) and the full suite against the target environment before release; compare against this task's 656/676 baseline, not the original 634/654.
- Do not deploy production from this task — follow the repository's existing `PRODUCTION_RELEASE_CHECKLIST.md` / `PRODUCTION_DEPLOYMENT_RUNBOOK.md` process with explicit owner sign-off.
