// Regression suite for the sidebar-footer cleanup: Help, the Sign Out
// block, and the "SuperKuba Active" status card were removed from the
// dashboard sidebar (desktop) and mobile drawer footer; Help & Support and
// Sign Out were relocated into Settings > Account & Support instead, both
// reusing the existing real Help page and the existing LogoutControl
// implementation — no new logout/auth flow, no duplicated Help content.
import { readFile } from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
import test from "node:test";

const REPO_ROOT = path.resolve(new URL("..", import.meta.url).pathname);

async function readSource(relativePath) {
  return readFile(path.join(REPO_ROOT, relativePath), "utf8");
}

// ---- Desktop sidebar: removed ----

test("REGRESSION: the desktop sidebar no longer renders the standalone Help link", async () => {
  const source = await readSource("app/dashboard/layout.tsx");
  assert.doesNotMatch(source, /href="\/dashboard\/help"/);
});

test("REGRESSION: the desktop sidebar no longer renders LogoutControl (the Sign Out block) at all — desktop or mobile", async () => {
  const source = await readSource("app/dashboard/layout.tsx");
  assert.doesNotMatch(source, /<LogoutControl/);
  assert.doesNotMatch(source, /from\s+["']\.\.\/components\/settings\/LogoutControl["']/, "the now-unused import must be removed too, not just the usage");
});

test("REGRESSION: the 'SuperKuba Active' / 'AI workforce ready' status card is gone from the sidebar", async () => {
  const source = await readSource("app/dashboard/layout.tsx");
  assert.doesNotMatch(source, /SuperKuba Active/);
  assert.doesNotMatch(source, /AI workforce ready/);
});

test("the desktop sidebar <nav> is the last element inside <aside> — nothing renders below the primary navigation anymore", async () => {
  const source = await readSource("app/dashboard/layout.tsx");
  const asideSection = source.slice(source.indexOf("<aside "), source.indexOf("</aside>"));
  const lastNavClose = asideSection.lastIndexOf("</nav>");
  const trailing = asideSection.slice(lastNavClose + "</nav>".length).trim();
  assert.equal(trailing, "", `expected nothing but whitespace between the sidebar's </nav> and </aside>, found: ${JSON.stringify(trailing.slice(0, 200))}`);
});

// ---- Preserved: branding, staging badge, business switcher, primary nav ----

test("the sidebar still renders SuperKuba branding, the staging badge, the business switcher, and every primary navigation group unchanged", async () => {
  const source = await readSource("app/dashboard/layout.tsx");
  assert.match(source, /alt="SuperKuba"/);
  assert.match(source, /STAGING/);
  assert.match(source, /Current business/i);
  assert.match(source, /\+ Add business/);
  for (const group of ["Command Center", "AI Workforce", "Human Workforce", "Customer Operations", "Business Operations", "Intelligence"]) {
    assert.match(source, new RegExp(`title:\\s*"${group}"`), `expected the "${group}" navigation group to still be defined`);
  }
});

// ---- Mobile drawer: no orphaned logout control ----

test("REGRESSION: the mobile navigation drawer no longer has its own LogoutControl either — no orphaned/duplicate logout surface", async () => {
  const source = await readSource("app/dashboard/layout.tsx");
  const mobileDrawerStart = source.indexOf("mobileNavigationOpen && (");
  const mobileDrawerSection = source.slice(mobileDrawerStart, mobileDrawerStart + 3000);
  assert.doesNotMatch(mobileDrawerSection, /<LogoutControl/);
});

test("the mobile drawer still renders the Settings navigation group, so Help and Sign Out remain reachable on mobile via Settings", async () => {
  const source = await readSource("app/dashboard/layout.tsx");
  assert.match(source, /title:\s*"Settings"/);
  assert.match(source, /label:\s*"Preferences",\s*href:\s*"\/dashboard\/settings"/);
});

// ---- Settings: Account & Support section ----

test("Settings (Preferences, /dashboard/settings) now has an 'Account & Support' section with a real Help & Support card linking to the real Help page", async () => {
  const source = await readSource("app/dashboard/settings/page.tsx");
  assert.match(source, /Account &amp;\s*Support|Account & Support/);
  assert.match(source, /Help &amp;\s*Support|Help & Support/);
  assert.match(source, /href="\/dashboard\/help"/);
  assert.match(source, /Open Help Center/);
});

test("Settings still renders the real LogoutControl (Sign Out) — the same component, not a reimplementation", async () => {
  const source = await readSource("app/dashboard/settings/page.tsx");
  assert.match(source, /import LogoutControl from ["']\.\.\/\.\.\/components\/settings\/LogoutControl["']/);
  assert.match(source, /<LogoutControl\s*\/>/);
});

test("REGRESSION: no second Help page or logout flow was created — the Help route and the auth sign-out call remain the single existing implementations", async () => {
  const helpSource = await readSource("app/dashboard/help/page.tsx");
  assert.ok(helpSource.length > 0);

  const logoutControlSource = await readSource("app/components/settings/LogoutControl.tsx");
  assert.match(logoutControlSource, /authClient\.signOut\(\)/, "must still use the one real better-auth sign-out call");

  const { execFileSync } = await import("node:child_process");
  const output = execFileSync("grep", ["-rln", "authClient.signOut(", "app", "lib", "--include=*.tsx", "--include=*.ts"], { cwd: REPO_ROOT, encoding: "utf8" });
  const files = output.trim().split("\n").filter(Boolean);
  assert.deepEqual(files, ["app/components/settings/LogoutControl.tsx"], "authClient.signOut() must be called from exactly one place — no second logout implementation");
});

// ---- Accessibility ----

test("the relocated Help link and Sign Out button are real, keyboard-accessible elements (a real <a>/Link and a real <button>), not synthetic click-only handlers", async () => {
  const settingsSource = await readSource("app/dashboard/settings/page.tsx");
  assert.match(settingsSource, /<Link[\s\S]{0,80}href="\/dashboard\/help"/);

  const logoutSource = await readSource("app/components/settings/LogoutControl.tsx");
  assert.match(logoutSource, /<button\s+type="button"[\s\S]{0,120}onClick=\{[^}]*logout/);
});

test("the Sign Out button has an understandable, visible accessible label ('Sign Out'), and its section is now titled 'Sign Out' rather than the more generic 'Account'", async () => {
  const source = await readSource("app/components/settings/LogoutControl.tsx");
  assert.match(source, /\{loading \? "Signing out\.\.\." : "Sign Out"\}/);
  assert.match(source, /<h2 className="text-lg font-semibold">Sign Out<\/h2>/);
});

// ---- Plan independence: Settings (and therefore Help/Sign Out) is not plan-gated ----

test("REGRESSION: the Settings/Preferences page that now hosts Help & Support and Sign Out has no plan/capability gate — only authentication and business membership are required, so it cannot disappear for any plan tier", async () => {
  const source = await readSource("app/dashboard/settings/page.tsx");
  assert.doesNotMatch(source, /hasCapability|getBusinessEntitlements|requiredPlan|FEATURE_NOT_ENTITLED/);
});

test("the LogoutControl component itself has no plan, role, or permission check of any kind — Sign Out is universally available by construction", async () => {
  const source = await readSource("app/components/settings/LogoutControl.tsx");
  assert.doesNotMatch(source, /plan|entitlement|permission|capability/i);
});
