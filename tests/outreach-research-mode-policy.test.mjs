// Regression tests for the explicit "Run Prospect Research" action added to
// the Outreach workspace, and the route-level wiring that keeps it routed
// through the deterministic autonomous_research pipeline and keeps the
// ordinary chat path's persistence-truth backstop in place. These are
// source-level policy assertions (this repo has no component-test runner),
// matching the style of tests/outreach-identity-policy.test.mjs.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

let routeSource;
let chatComponentSource;

test.before(async () => {
  routeSource = await readFile(
    "app/api/ai/outreach/route.ts",
    "utf8",
  );

  chatComponentSource = await readFile(
    "app/components/OutreachEmployeeChat.tsx",
    "utf8",
  );
});

// --- 1 & 2: UI sends explicit, separate mode signals ---

test("ordinary chat submit does not send mode: autonomous_research", () => {
  const handleSubmitBody = chatComponentSource.slice(
    chatComponentSource.indexOf("async function handleSubmit"),
    chatComponentSource.indexOf(
      "Explicit, separate action for a full research-and-persist operation",
    ),
  );

  assert.doesNotMatch(
    handleSubmitBody,
    /autonomous_research/,
  );
});

test("the explicit research action sends mode: \"autonomous_research\" to POST /api/ai/outreach", () => {
  const handleRunResearchBody = chatComponentSource.slice(
    chatComponentSource.indexOf("async function handleRunResearch"),
  );

  assert.match(
    handleRunResearchBody,
    /\/api\/ai\/outreach/,
  );

  assert.match(
    handleRunResearchBody,
    /mode:\s*["']autonomous_research["']/,
  );
});

test("the research action is a distinct, clearly labeled control, not inferred from message text", () => {
  assert.match(
    chatComponentSource,
    /Run Prospect Research/,
  );

  // Structural guarantee: the UI's mode selection is a dedicated handler
  // bound to a dedicated button, not a keyword/NLP classifier run over the
  // typed message.
  assert.match(
    chatComponentSource,
    /onClick=\{handleRunResearch\}/,
  );
});

// --- 3: route.ts mode resolution is explicit, not a keyword classifier ---

test("route.ts selects autonomous_research only from an explicit body.mode field, never from message content", () => {
  assert.match(
    routeSource,
    /body\.mode === "autonomous_research"/,
  );

  // No keyword/regex-based guess over the message text anywhere in the file.
  assert.doesNotMatch(
    routeSource,
    /message\.(?:toLowerCase|includes|match)\(/,
  );
});

test("autonomous_research routes through the existing runOutreachResearchPipeline exactly once, without a duplicate implementation", () => {
  const pipelineCallCount = (
    routeSource.match(/runOutreachResearchPipeline\(/g) || []
  ).length;

  assert.equal(pipelineCallCount, 1);

  assert.match(
    routeSource,
    /import \{ runOutreachResearchPipeline \} from "@\/mastra\/workflows\/outreach-research-pipeline"/,
  );
});

// --- 4-9: chat path is hardened with the deterministic truth layer ---

test("the chat path's final response text goes through enforcePersistenceTruth, never raw model text", () => {
  assert.match(
    routeSource,
    /import \{ enforcePersistenceTruth \} from "@\/mastra\/lib\/outreach-persistence-truth"/,
  );

  assert.match(
    routeSource,
    /enforcePersistenceTruth\(\{\s*text:\s*result\.text/,
  );

  // Both the persisted message row and the JSON response use the enforced
  // safe text, not result.text directly.
  assert.doesNotMatch(
    routeSource,
    /content:\s*result\.text/,
  );

  assert.doesNotMatch(
    routeSource,
    /response:\s*result\.text/,
  );
});

test("the persistence-truth enforcement is not solely a system-prompt instruction — it is code the route actually calls", () => {
  assert.match(
    routeSource,
    /safeResponseText/,
  );
});

// --- 12: research mode never sends an external message ---

test("neither the chat agent nor the research pipeline path can send an external message", () => {
  const forbiddenSendPatterns = [
    /sendWhatsApp/,
    /sendEmail/,
    /sendSms/,
    /sendVoiceCall/,
  ];

  for (const pattern of forbiddenSendPatterns) {
    assert.doesNotMatch(routeSource, pattern);
  }
});

// --- 13 & 14: tenant context stays server-trusted only ---

test("the outreach route never reads a client-supplied businessId for tool/context authorization", () => {
  assert.doesNotMatch(
    routeSource,
    /body\.businessId/,
  );

  // requestContext for both the chat agent and the research pipeline is
  // built exclusively from the server-resolved `business`/`outreachEmployee`
  // records, never from request body fields.
  assert.match(
    routeSource,
    /requestContext:\s*new RequestContext\(\[\s*\["businessId", business\.id\]/,
  );
});

test("the research pipeline call is scoped with the server-resolved business and employee ids", () => {
  const pipelineCallSite = routeSource.slice(
    routeSource.indexOf("runOutreachResearchPipeline({"),
    routeSource.indexOf("runOutreachResearchPipeline({") + 300,
  );

  assert.match(pipelineCallSite, /businessId:\s*business\.id/);
  assert.match(pipelineCallSite, /employeeId:\s*outreachEmployee\.id/);
});

// --- output budget: bounded, not the safety fix ---

test("chat maxOutputTokens was raised but stays a bounded, reasonable value, not unlimited", () => {
  const match = routeSource.match(/maxOutputTokens:\s*(\d+)/);

  assert.ok(match, "expected an explicit maxOutputTokens value");

  const value = Number(match[1]);

  assert.ok(value > 800, "expected the budget to be raised above the original 800");
  assert.ok(value <= 8000, "expected the budget to remain bounded, not effectively unlimited");
});
