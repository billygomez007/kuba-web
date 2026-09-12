// Static policy checks for the Outreach Campaign Engine's AI-facing tools
// (approved spec, section 8-9). Confirms the execution boundary in source:
// the agent can prepare a campaign, but has no tool that launches,
// schedules, pauses, resumes, stops, or sends anything directly.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const AGENT_FILE = "mastra/agents/outreach.ts";
const TOOLS_FILE = "mastra/tools/outreach-campaign-tools.ts";

let agentSource;
let toolsSource;

test.before(async () => {
  agentSource = await readFile(AGENT_FILE, "utf8");
  toolsSource = await readFile(TOOLS_FILE, "utf8");
});

// Matches an actual import statement, not an explanatory doc-comment
// mention of the module (the file's own boundary comment references these
// paths in prose to explain why they're absent).
function importsFrom(source, modulePathFragment) {
  const importLines = source.split("\n").filter((line) => /^\s*import\b/.test(line));
  return importLines.some((line) => line.includes(modulePathFragment));
}

test("the outreach campaign tools file never imports the lifecycle module (no launch/pause/resume/stop capability)", () => {
  assert.equal(importsFrom(toolsSource, "campaign-lifecycle"), false);
});

test("the outreach campaign tools file never imports the email channel or send worker (no direct send capability)", () => {
  assert.equal(importsFrom(toolsSource, "email-channel"), false);
  assert.equal(importsFrom(toolsSource, "send-worker"), false);
  assert.equal(importsFrom(toolsSource, "process-send"), false);
  assert.doesNotMatch(toolsSource, /getResend/);
});

test("the outreach campaign tools file defines only prepare/read tools, not action verbs like launch/pause/resume/stop/send", () => {
  const toolIdMatches = [...toolsSource.matchAll(/id:\s*"([a-z0-9-]+)"/g)].map((match) => match[1]);
  assert.ok(toolIdMatches.length >= 5, "expected at least 5 tool definitions");
  for (const toolId of toolIdMatches) {
    assert.doesNotMatch(toolId, /launch|schedule|pause|resume|stop|^send-|-send$/, `tool id "${toolId}" looks like an execution-control or send action`);
  }
});

test("proposeSequenceStep persists through the same addSequenceStep the API routes use, not a separate write path", () => {
  assert.match(toolsSource, /import\s*\{[^}]*addSequenceStep[^}]*\}\s*from\s*"@\/lib\/outreach\/campaign-service"/);
});

test("every campaign tool trusts only server-pinned RequestContext for business/employee identity", () => {
  const executeBlocks = toolsSource.split("execute: async (").slice(1);
  assert.ok(executeBlocks.length >= 5);
  for (const block of executeBlocks) {
    assert.match(block, /requireBusinessId\(requestContext\)/);
    assert.match(block, /requireEmployeeId\(requestContext\)/);
  }
});

test("campaign-scoped tools verify the campaign belongs to the acting Outreach employee, not just the business", () => {
  assert.match(toolsSource, /campaign\.employeeId !== employeeId/);
});

test("the outreach agent's own instructions state it has no launch/send tool and must not imply one ran", () => {
  assert.match(agentSource, /NO tool to launch, schedule, pause, resume, or stop a campaign/);
  assert.match(agentSource, /NO tool that sends a message directly/);
});

test("the outreach agent registers the campaign preparation tools, not an execution-control one", () => {
  assert.match(agentSource, /createCampaignDraft:\s*createCampaignDraftTool/);
  assert.match(agentSource, /addResearchedContactsToCampaign:\s*addResearchedContactsToCampaignTool/);
  assert.match(agentSource, /proposeSequenceStep:\s*proposeSequenceStepTool/);
  assert.doesNotMatch(agentSource, /launchCampaign:|pauseCampaign:|resumeCampaign:|stopCampaign:/);
});
