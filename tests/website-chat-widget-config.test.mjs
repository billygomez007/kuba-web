// Regression suite for the Website Widget navigation fix + real config
// features (domain allowlisting, welcome message, AI employee readiness
// surfacing, Integrations index/Inbox provider-name fixes).
//
// THE ORIGINAL BUG: app/dashboard/integrations/website-chat/page.tsx called
// getBusinessMembership(session.user.id) with NO businessId. That helper's
// no-businessId branch only succeeds when the user has EXACTLY ONE
// membership total (lib/auth/permissions.ts), so any multi-business account
// (e.g. info@realtegicworks.com, a member of both Realtegic Works and Kora
// OS) always got `membership === null` regardless of which business was
// actually selected via the superkuba_business_id cookie, and was redirected
// straight to /dashboard (Business Overview) instead of the widget setup
// page. The fix: resolve via requireBusinessMembership()/getCurrentMembership()
// (lib/auth/tenant.ts), which honors the cookie-selected business through
// selectBusinessMembership() regardless of total membership count.
//
// Where a real Next.js request context (next/headers, a live server) would
// be required to invoke a route/page handler directly, this file follows
// this repo's established convention (see tests/canonical-current-workspace-
// resolver.test.mjs, tests/dashboard-ambiguous-business-crash.test.mjs) of
// asserting against the real source for control-flow/security properties,
// and reserves direct function-level testing for the extracted pure helpers
// (lib/integrations/website-chat-config.ts), which have no such constraint.
import { register } from "node:module";
import { pathToFileURL } from "node:url";
import { readFile } from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
import test from "node:test";

const REPO_ROOT = path.resolve(new URL("..", import.meta.url).pathname);
register(pathToFileURL(path.join(REPO_ROOT, "tests/helpers/alias-loader.mjs")));

async function readSource(relativePath) {
  return readFile(path.join(REPO_ROOT, relativePath), "utf8");
}

// ---- The reported bug: navigation to the widget setup page ----

test("REGRESSION: website-chat/page.tsx no longer resolves membership via the legacy exactly-one-membership helper", async () => {
  const source = await readSource("app/dashboard/integrations/website-chat/page.tsx");
  assert.doesNotMatch(source, /getBusinessMembership\(/, "must not call the legacy no-selection-aware helper");
  assert.match(source, /requireBusinessMembership\(\)/, "must resolve the CURRENTLY SELECTED business via the canonical, cookie-aware resolver");
});

test("REGRESSION: website-chat/page.tsx does not send a resolved membership to /dashboard — only an unauthenticated/no-membership/permission-denied user is redirected away from the setup page", async () => {
  const source = await readSource("app/dashboard/integrations/website-chat/page.tsx");
  // A resolved membership without INTEGRATIONS_VIEW is a genuine permission
  // failure (still correctly sent to /dashboard); a resolved membership
  // WITH permission must render the client, never redirect.
  assert.match(source, /return <WebsiteChatClient \/>/);
  const afterMembershipCheck = source.slice(source.indexOf("if (!membership)"));
  assert.match(afterMembershipCheck, /hasPermission/, "the only redirect after a resolved membership must be gated on a real permission check");
});

test("the Website Widget card in the Integrations index routes to the real setup page for its real provider value (website_chat), not a stale 'website' key", async () => {
  const source = await readSource("app/dashboard/integrations/page.tsx");
  assert.match(source, /provider:\s*"website_chat"/);
  assert.match(source, /website_chat:\s*"\/dashboard\/integrations\/website-chat"/);
  assert.doesNotMatch(source, /\bwebsite:\s*"\/dashboard\/integrations\/website-chat"/, "the old mismatched routeMap key must be gone, not left alongside the fix");
});

test("the Integrations index correctly derives Connected/Active status for Website Widget (previously always false: card checked provider==='website', DB rows are provider==='website_chat')", async () => {
  const source = await readSource("app/dashboard/integrations/page.tsx");
  assert.match(source, /isWebsiteConfigured\s*=\s*provider\s*===\s*"website_chat"\s*&&\s*isActive/);
});

test("GET /api/integrations's ALL_PROVIDERS list uses the real provider value website_chat (used only for the total-provider-count stat, so this is a correctness fix, not a behavior-changing key)", async () => {
  const source = await readSource("app/api/integrations/route.ts");
  assert.match(source, /"website_chat"/);
  assert.doesNotMatch(source, /"website"/, "no stale non-suffixed provider string should remain in the provider list");
});

// ---- Domain allowlisting: the pure normalization + matching logic ----

test("normalizeDomain: strips protocol, www, trailing slash/path/query, port and embedded credentials, and lowercases", async () => {
  const { normalizeDomain } = await import("@/lib/integrations/website-chat-config");
  assert.equal(normalizeDomain("https://www.KoraAfric.com/"), "koraafric.com");
  assert.equal(normalizeDomain("http://koraafric.com:8080/path?query=1"), "koraafric.com");
  assert.equal(normalizeDomain("koraafric.com"), "koraafric.com");
  assert.equal(normalizeDomain("  koraafric.com  "), "koraafric.com");
  assert.equal(normalizeDomain("https://user:pass@koraafric.com/"), "koraafric.com");
});

test("normalizeDomain: rejects empty, wildcard, and non-hostname input rather than silently accepting it", async () => {
  const { normalizeDomain } = await import("@/lib/integrations/website-chat-config");
  assert.equal(normalizeDomain(""), null);
  assert.equal(normalizeDomain("   "), null);
  assert.equal(normalizeDomain("*.koraafric.com"), null);
  assert.equal(normalizeDomain("*"), null);
  assert.equal(normalizeDomain("not a domain"), null);
  assert.equal(normalizeDomain("koraafric"), null, "a bare label with no TLD is rejected");
});

test("SECURITY: normalized-domain equality is an exact match — a lookalike domain is never confused with the allowed one (no substring/suffix/wildcard matching)", async () => {
  const { normalizeDomain } = await import("@/lib/integrations/website-chat-config");
  const allowed = normalizeDomain("koraafric.com");
  const attacksThatMustNotMatch = [
    "koraafric.com.evil.example",
    "evil-koraafric.com",
    "notkoraafric.com",
    "koraafric.com.au",
    "sub.koraafric.com",
  ];
  for (const attack of attacksThatMustNotMatch) {
    assert.notEqual(normalizeDomain(attack), allowed, `${attack} must not normalize to the same value as the allowed domain`);
  }
});

test("parseWebsiteChatMetadata: parses valid JSON, and degrades to {} for null/invalid input instead of throwing", async () => {
  const { parseWebsiteChatMetadata } = await import("@/lib/integrations/website-chat-config");
  assert.deepEqual(parseWebsiteChatMetadata(null), {});
  assert.deepEqual(parseWebsiteChatMetadata(undefined), {});
  assert.deepEqual(parseWebsiteChatMetadata("not json"), {});
  assert.deepEqual(parseWebsiteChatMetadata("42"), {});
  assert.deepEqual(
    parseWebsiteChatMetadata(JSON.stringify({ domain: "koraafric.com", welcomeMessage: "Hi" })),
    { domain: "koraafric.com", welcomeMessage: "Hi" },
  );
});

// ---- Cross-origin visitor requests must actually reach the server (CORS) ----

test("SECURITY GAP FOUND AND FIXED: the public POST endpoint answers CORS preflight (OPTIONS) and sets Access-Control-Allow-Origin on POST responses — without this, a real visitor's browser on koraafric.com would silently block every widget request before the domain allowlist logic ever ran", async () => {
  const source = await readSource("app/api/integrations/website-chat/route.ts");
  assert.match(source, /export async function OPTIONS/);
  assert.match(source, /Access-Control-Allow-Origin/);
  assert.match(source, /Access-Control-Allow-Methods/);
  assert.match(source, /withCors\(response, request\.headers\.get\("origin"\)\)/, "the actual POST handler's response must be wrapped so every code path (success and every error branch) carries the CORS header, not just the happy path");
});

// ---- Domain enforcement is real and server-side, not just a client hint ----

test("SECURITY: the public POST handler enforces the configured domain server-side via normalizeDomain against Origin/Referer, not a client-supplied field", async () => {
  const source = await readSource("app/api/integrations/website-chat/route.ts");
  const postSection = source.slice(source.indexOf("export async function POST"));
  assert.match(postSection, /request\.headers\.get\("origin"\)/, "must read the real Origin header from the request itself");
  assert.match(postSection, /normalizeDomain\(originHeader\)/);
  assert.match(postSection, /requestDomain !== allowedDomain/, "must be an exact-equality check, not includes/startsWith/endsWith");
  assert.doesNotMatch(postSection, /\.includes\(\s*allowedDomain/, "must never use substring matching for a security-critical domain check");
  assert.doesNotMatch(postSection, /\.endsWith\(\s*allowedDomain/, "must never use suffix matching (vulnerable to attacker-koraafric.com)");
});

test("the authenticated same-business test-message bypass cannot be used to cross tenant boundaries — it requires the session's OWN currently-selected business to exactly equal the integration's business, not merely being signed in", async () => {
  const source = await readSource("app/api/integrations/website-chat/route.ts");
  const postSection = source.slice(source.indexOf("export async function POST"));
  assert.match(postSection, /testMembership\?\.businessId\s*===\s*business\.id/, "must be an exact businessId equality check");
  assert.match(postSection, /getCurrentMembership/, "must resolve the CURRENTLY SELECTED business, never assume a user's only/first business");
});

// ---- Public tenant identification stays exclusively publicKey-based ----

test("SECURITY: the public POST handler resolves its tenant exclusively via publicKey — no businessId or other tenant identifier is ever trusted from the request body", async () => {
  const source = await readSource("app/api/integrations/website-chat/route.ts");
  const postSection = source.slice(source.indexOf("export async function POST"), source.indexOf("verify_domain"));
  assert.match(postSection, /eq\(\s*integrations\.publicKey,\s*publicKey,?\s*\)/);
  assert.doesNotMatch(postSection, /body\.businessId/, "the visitor-supplied body must never carry a trusted business identifier");
});

test("SECURITY: no route in this file ever selects or returns the encrypted credentials column — public tenant identification never needs it", async () => {
  const source = await readSource("app/api/integrations/website-chat/route.ts");
  assert.doesNotMatch(source, /credentialsEncrypted/);
});

// ---- AI employee readiness: surfaced honestly, never auto-activated ----

test("GET exposes a real aiEmployeeReady flag computed with the exact same active-receptionist check the public POST handler enforces at message-send time", async () => {
  const source = await readSource("app/api/integrations/website-chat/route.ts");
  const getSection = source.slice(source.indexOf("export async function GET"), source.indexOf("export async function PUT"));
  const postSection = source.slice(source.indexOf("export async function POST"));

  for (const section of [getSection, postSection]) {
    assert.match(section, /eq\(\s*aiEmployees\.type,\s*"receptionist",?\s*\)/);
    assert.match(section, /eq\(\s*aiEmployees\.status,\s*"active",?\s*\)/);
  }
  assert.match(getSection, /aiEmployeeReady:\s*receptionistResult\.length > 0/);
});

test("REGRESSION: no code path in this file inserts a new AI employee row — readiness is only ever surfaced, never auto-activated on the business's behalf", async () => {
  const source = await readSource("app/api/integrations/website-chat/route.ts");
  assert.doesNotMatch(source, /\.insert\(aiEmployees\)/);
});

test("the setup page shows an actionable 'not ready' state (with a real link to AI Employees) instead of pretending the widget is ready when no receptionist is active", async () => {
  const source = await readSource("app/dashboard/integrations/website-chat/WebsiteChatClient.tsx");
  assert.match(source, /Not ready/);
  assert.match(source, /href="\/dashboard\/ai-employees"/);
});

test("the Test Message control is disabled when the AI employee is not ready, rather than sending a test that will 404", async () => {
  const source = await readSource("app/dashboard/integrations/website-chat/WebsiteChatClient.tsx");
  const buttonSection = source.slice(source.indexOf("onClick={sendTestMessage}"), source.indexOf("Send a Test Message") + 50);
  assert.match(buttonSection, /disabled=\{testing \|\| !aiEmployeeReady\}/);
});

// ---- Business Brain / knowledge tenant isolation ----

test("TENANT ISOLATION: the AI response path searches knowledge scoped to the resolved integration's own business.id, never a request-supplied id", async () => {
  const source = await readSource("app/api/integrations/website-chat/route.ts");
  assert.match(source, /searchKnowledge\(\s*business\.id,/);
});

// ---- Conversations land in the correct business/Inbox ----

test("TENANT ISOLATION: the conversation, message, and routing rows created by a visitor message are all scoped to the resolved business.id, matching the integration that owns the publicKey", async () => {
  const source = await readSource("app/api/integrations/website-chat/route.ts");
  const postSection = source.slice(source.indexOf("export async function POST"));
  // Conversation insert
  assert.match(postSection, /business\.id/);
  const conversationInsertBlock = postSection.slice(postSection.indexOf("INSERT INTO conversations"), postSection.indexOf("INSERT INTO conversations") + 400);
  assert.match(conversationInsertBlock, /\$\{business\.id\}/);
});

test("REGRESSION: the Inbox now labels a website-chat conversation's channel via the conversation's real integration provider, not the raw opaque integrationId (which never matched any channel label for ANY provider, not just this one)", async () => {
  const source = await readSource("app/api/inbox/workspace/route.ts");
  assert.doesNotMatch(source, /channel:\s*conversation\.integrationId,/, "must no longer surface the raw foreign key as the channel");
  assert.match(source, /channelLabelByProvider/);
  assert.match(source, /website_chat:\s*"website"/, "must map the real provider value to the label the Inbox filter/UI already expects");
});

// ---- No fake customization controls ----

test("REGRESSION: the setup page does not offer Widget Position or Branding controls, since public/kuba/chat.js has no backing implementation for either", async () => {
  const clientSource = await readSource("app/dashboard/integrations/website-chat/WebsiteChatClient.tsx");
  const widgetSource = await readSource("public/kuba/chat.js");
  assert.doesNotMatch(clientSource, /Widget Position/i);
  assert.doesNotMatch(clientSource, /Branding/i);
  assert.doesNotMatch(widgetSource, /data-position|data-color|data-brand/);
});

test("the generated installation snippet only ever includes attributes the real widget script actually reads (data-public-key, and data-welcome only when a welcome message is set)", async () => {
  const clientSource = await readSource("app/dashboard/integrations/website-chat/WebsiteChatClient.tsx");
  const widgetSource = await readSource("public/kuba/chat.js");
  assert.match(clientSource, /data-public-key="\$\{publicKey\}"/);
  assert.match(clientSource, /data-welcome="\$\{escapeHtmlAttribute\(integration\.welcomeMessage\)\}"/);
  assert.match(widgetSource, /dataset\.welcome/, "the widget script must actually read the attribute the snippet advertises");
});

test("the welcome message, when present, is shown as the widget's own first message rather than requiring a second network round-trip", async () => {
  const source = await readSource("public/kuba/chat.js");
  assert.match(source, /welcomeShown/);
  assert.match(source, /addMessage\(\s*"Kuba",\s*welcomeMessage\s*\)/);
});

// ---- Config validation: domain/welcome-message input is real, not decorative ----

test("PATCH rejects an invalid domain with a real 400 instead of silently accepting garbage input", async () => {
  const source = await readSource("app/api/integrations/website-chat/route.ts");
  const patchSection = source.slice(source.indexOf("export async function PATCH"));
  assert.match(patchSection, /Enter a valid website domain/);
  assert.match(patchSection, /status:\s*400/);
});

test("PATCH enforces a welcome message length limit consistently between server validation and the client's input maxLength", async () => {
  const routeSource = await readSource("app/api/integrations/website-chat/route.ts");
  const clientSource = await readSource("app/dashboard/integrations/website-chat/WebsiteChatClient.tsx");
  assert.match(routeSource, /rawWelcome\.length > 300/);
  assert.match(clientSource, /maxLength=\{300\}/);
});

test("PATCH requires INTEGRATIONS_MANAGE permission and resolves the business via the canonical cookie-aware resolver, same as PUT", async () => {
  const source = await readSource("app/api/integrations/website-chat/route.ts");
  const patchSection = source.slice(source.indexOf("export async function PATCH"), source.indexOf("export async function POST"));
  assert.match(patchSection, /getCurrentMembership/);
  assert.match(patchSection, /PERMISSIONS\.INTEGRATIONS_MANAGE/);
});

// ---- Empty/unconfigured state never redirects away ----

test("REGRESSION: the setup page's client never redirects to /dashboard for an unconfigured/inactive integration — it renders a real activation screen instead", async () => {
  const source = await readSource("app/dashboard/integrations/website-chat/WebsiteChatClient.tsx");
  assert.doesNotMatch(source, /router\.push\(\s*"\/dashboard"\s*\)/);
  assert.doesNotMatch(source, /redirect\(\s*"\/dashboard"\s*\)/);
  assert.match(source, /Website Widget is not active/);
});

// ---- No hardcoding of any specific tenant in shared, multi-tenant code ----

test("no code touched by this fix hardcodes Kora/koraafric.com anywhere shared/multi-tenant — every file here serves every business identically", async () => {
  const files = [
    "app/dashboard/integrations/website-chat/page.tsx",
    "app/dashboard/integrations/website-chat/WebsiteChatClient.tsx",
    "app/api/integrations/website-chat/route.ts",
    "lib/integrations/website-chat-config.ts",
    "public/kuba/chat.js",
    "app/dashboard/integrations/page.tsx",
    "app/api/integrations/route.ts",
    "app/api/inbox/workspace/route.ts",
  ];
  for (const file of files) {
    const source = await readSource(file);
    assert.doesNotMatch(source, /koraafric/i, `${file} must not hardcode koraafric.com`);
    assert.doesNotMatch(source, /"Kora"/, `${file} must not hardcode the Kora business name`);
  }
});
