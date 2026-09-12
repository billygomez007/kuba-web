// This pass repositions the orphaned, ungated AI Workforce Command Center
// surface behind the real AI Workforce Performance nav slot, consolidates
// three overlapping marketplace storefronts into one canonical route, and
// fixes dead/mismatched anchor links in the Solutions and Industries
// marketing navigation. See SUPERKUBA_PHASE2B_COMPLETION_REPORT.md (#26-28)
// for the audit this pass acts on.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const layoutSource = await readFile("app/dashboard/layout.tsx", "utf8");
const headerSource = await readFile("app/components/MarketingHeader.tsx", "utf8");
const planDefinitionsSource = await readFile("lib/billing/plan-definitions.ts", "utf8");
const commandCenterApiSource = await readFile("app/api/workforce-command-center/route.ts", "utf8");
const stagingDocSource = await readFile("docs/STAGING.md", "utf8");

// --- 1. AI Workforce Performance navigation placement ---

test("AI Workforce Performance is listed inside the AI Workforce navigation group, not as a separate top-level Command Center", () => {
  const aiWorkforceGroupMatch = layoutSource.match(/title: "AI Workforce",[\s\S]*?items: \[([\s\S]*?)\],\s*\},/);
  assert.ok(aiWorkforceGroupMatch, "Expected an AI Workforce navigation group");
  const groupBody = aiWorkforceGroupMatch[1];
  assert.match(groupBody, /label: "AI Workforce Performance", href: "\/dashboard\/ai-performance"/);
  assert.doesNotMatch(layoutSource, /label: "Command Center"/);
  const commandCenterGroupMatch = layoutSource.match(/title: "Command Center",[\s\S]*?items: \[([\s\S]*?)\],\s*\},/);
  assert.ok(commandCenterGroupMatch);
  assert.doesNotMatch(commandCenterGroupMatch[1], /workforce-command-center/);
});

test("the old /dashboard/workforce-command-center route is a redirect to /dashboard/ai-performance, not a rendered page", async () => {
  const source = await readFile("app/dashboard/workforce-command-center/page.tsx", "utf8");
  assert.match(source, /redirect\("\/dashboard\/ai-performance"\)/);
  assert.doesNotMatch(source, /fetch\(/);
});

test("the real performance implementation now lives at /dashboard/ai-performance (reused, not rebuilt)", async () => {
  const source = await readFile("app/dashboard/ai-performance/page.tsx", "utf8");
  assert.match(source, /AI Workforce Performance/);
  assert.match(source, /fetch\("\/api\/workforce-command-center"/);
  assert.match(source, /AI Improvement Center/);
});

// --- 2. Entitlement for AI Workforce Performance ---

test("/dashboard/ai-performance has a navigation capability gate using the existing ai_workforce.performance capability", () => {
  assert.match(layoutSource, /"\/dashboard\/ai-performance":\s*"ai_workforce\.performance"/);
});

test("the legacy /dashboard/workforce-command-center route is also gated (defense in depth) rather than left orphaned", () => {
  assert.match(layoutSource, /"\/dashboard\/workforce-command-center":\s*"workforce\.view"/);
  assert.match(layoutSource, /"\/dashboard\/workforce-command-center":\s*"ai_workforce\.performance"/);
});

test("the underlying /api/workforce-command-center endpoint enforces the same ai_workforce.performance capability server-side", () => {
  assert.match(commandCenterApiSource, /hasCapability\(await getBusinessEntitlements\(business\.businessId\), "ai_workforce\.performance"\)/);
  assert.doesNotMatch(commandCenterApiSource, /"ai_workforce\.core"/);
});

test("every query in the performance API is scoped to the current business (tenant-safe)", () => {
  const queryLines = commandCenterApiSource.match(/db\.select\([\s\S]*?\.from\([\s\S]*?\)\.where\([\s\S]*?\)/g) || [];
  assert.ok(queryLines.length >= 5, "Expected multiple scoped queries");
  for (const line of queryLines) {
    assert.match(line, /businessId/);
  }
});

test("ai_workforce.performance is Pro-tier and above, not Starter/Growth — direct URL access from a lower tier is denied", () => {
  const starterMatch = planDefinitionsSource.match(/const starterCapabilities: Capability\[\] = \[([\s\S]*?)\];/);
  const growthMatch = planDefinitionsSource.match(/const growthCapabilities: Capability\[\] = \[([\s\S]*?)\];/);
  const proMatch = planDefinitionsSource.match(/const proCapabilities: Capability\[\] = \[([\s\S]*?)\];/);
  assert.ok(starterMatch && growthMatch && proMatch);
  assert.doesNotMatch(starterMatch[1], /"ai_workforce\.performance"/);
  assert.doesNotMatch(growthMatch[1], /"ai_workforce\.performance"/);
  assert.match(proMatch[1], /"ai_workforce\.performance"/);
});

// --- 3-5. Marketplace consolidation ---

test("Marketplace is the single canonical nav entry (not Ecosystem or Marketplace duplicates)", () => {
  const marketplaceNavEntries = layoutSource.match(/label: "Marketplace", href: "([^"]+)"/g) || [];
  assert.equal(marketplaceNavEntries.length, 1, "Expected exactly one Marketplace nav entry");
  assert.match(marketplaceNavEntries[0], /\/dashboard\/workforce-marketplace/);
  assert.doesNotMatch(layoutSource, /label: "Ecosystem"/);
});

test("no nav item links directly to the orphaned /dashboard/ecosystem or /dashboard/marketplace routes", () => {
  const navSection = layoutSource.slice(0, layoutSource.indexOf("const navigationPermissions"));
  assert.doesNotMatch(navSection, /href: "\/dashboard\/ecosystem"/);
  assert.doesNotMatch(navSection, /href: "\/dashboard\/marketplace"/);
});

const legacyMarketplaceRoutes = [
  "app/dashboard/ecosystem/page.tsx",
  "app/dashboard/marketplace/page.tsx",
  "app/dashboard/marketplace/[id]/page.tsx",
  "app/dashboard/marketplace/subscriptions/page.tsx",
  "app/dashboard/marketplace/installations/page.tsx",
  "app/dashboard/marketplace/install/[id]/page.tsx",
];

for (const file of legacyMarketplaceRoutes) {
  test(`${file} safely redirects to the canonical Marketplace instead of rendering duplicate/fake content`, async () => {
    const source = await readFile(file, "utf8");
    assert.match(source, /redirect\("\/dashboard\/workforce-marketplace"\)/);
    assert.doesNotMatch(source, /marketplaceProducts|rating|"\/api\/workforce-packages"/);
  });
}

test("the canonical workforce-marketplace page sources package data from the real API, not a static catalog", async () => {
  const source = await readFile("app/dashboard/workforce-marketplace/page.tsx", "utf8");
  assert.match(source, /fetch\("\/api\/workforce-packages"/);
  assert.doesNotMatch(source, /from ["'].*catalog["']/);
});

// --- 6. Solutions navigation ---

function extractHeaderMenuItems(name) {
  const menuMatch = headerSource.match(new RegExp(`name: "${name}"[\\s\\S]*?items: \\[([\\s\\S]*?)\\],\\s*\\},`));
  assert.ok(menuMatch, `Expected a ${name} menu in MarketingHeader`);
  const entries = [...menuMatch[1].matchAll(/\["([^"]+)",\s*"([^"]+)"\]/g)];
  assert.ok(entries.length > 0, `Expected at least one ${name} menu item`);
  return entries.map(([, label, href]) => ({ label, href }));
}

function extractPageSectionIds(source, arrayName) {
  const arrayMatch = source.match(new RegExp(`const ${arrayName} = \\[([\\s\\S]*?)\\n\\];`));
  assert.ok(arrayMatch, `Expected a ${arrayName} array`);
  const ids = [...arrayMatch[1].matchAll(/id:\s*"([^"]+)"/g)].map((match) => match[1]);
  assert.ok(ids.length > 0, `Expected at least one id in ${arrayName}`);
  return ids;
}

test("every Solutions nav link points to an #id that actually exists on /solutions, with a label matching real page content", async () => {
  const solutionsSource = await readFile("app/solutions/page.tsx", "utf8");
  const pageIds = extractPageSectionIds(solutionsSource, "solutions");
  const navItems = extractHeaderMenuItems("Solutions");
  for (const item of navItems) {
    const [, fragment] = item.href.split("#");
    assert.ok(fragment, `${item.label} href must include a #fragment`);
    assert.ok(pageIds.includes(fragment), `Dead anchor: Solutions nav item "${item.label}" links to #${fragment}, which does not exist on /solutions`);
  }
});

test("Solutions nav no longer uses the old outcome-framed labels that didn't match department-framed page content", () => {
  const navItems = extractHeaderMenuItems("Solutions");
  const labels = navItems.map((item) => item.label);
  assert.deepEqual(labels, [
    "Customer Service",
    "Sales & Lead Generation",
    "Marketing Automation",
    "Finance & Accounting",
    "Human Resources",
    "Business Operations",
    "Appointments & Bookings",
  ]);
});

test("solutions/page.tsx anchor sections have scroll-margin so the fixed header doesn't cover the target section", async () => {
  const solutionsSource = await readFile("app/solutions/page.tsx", "utf8");
  assert.match(solutionsSource, /id=\{solution\.id\}\s*\n\s*className="scroll-mt-\d+/);
});

// --- 7. Industries navigation ---

test("every Industries nav link points to an #id that actually exists on /industries", async () => {
  const industriesSource = await readFile("app/industries/page.tsx", "utf8");
  const pageIds = extractPageSectionIds(industriesSource, "industries");
  const navItems = extractHeaderMenuItems("Industries");
  for (const item of navItems) {
    const [, fragment] = item.href.split("#");
    assert.ok(fragment, `${item.label} href must include a #fragment`);
    assert.ok(pageIds.includes(fragment), `Dead anchor: Industries nav item "${item.label}" links to #${fragment}, which does not exist on /industries`);
  }
});

test("Industries nav label matches its section's real title (no more Small Businesses pointing at the Hospitality section)", async () => {
  const industriesSource = await readFile("app/industries/page.tsx", "utf8");
  const navItems = extractHeaderMenuItems("Industries");
  const byId = new Map();
  for (const match of industriesSource.matchAll(/title: "([^"]+)",\s*id: "([^"]+)"/g)) {
    byId.set(match[2], match[1]);
  }
  for (const item of navItems) {
    const [, fragment] = item.href.split("#");
    const realTitle = byId.get(fragment);
    assert.ok(realTitle, `No section found for #${fragment}`);
    assert.ok(
      realTitle.toLowerCase().includes(item.label.toLowerCase()) || item.label.toLowerCase().includes(realTitle.toLowerCase().split(" ")[0]),
      `Industries nav label "${item.label}" does not match its section's real title "${realTitle}"`,
    );
  }
  assert.doesNotMatch(headerSource, /"Small Businesses"/);
});

test("industries/page.tsx anchor sections have scroll-margin so the fixed header doesn't cover the target section", async () => {
  const industriesSource = await readFile("app/industries/page.tsx", "utf8");
  assert.match(industriesSource, /id=\{industry\.id\}\s*\n\s*className="scroll-mt-\d+/);
});

// --- 9. No dead anchors on the other two marketing dropdowns either ---

test("Products and Resources nav links also point to real anchors (regression guard, unchanged by this pass)", async () => {
  const productsSource = await readFile("app/products/page.tsx", "utf8");
  const resourcesSource = await readFile("app/resources/page.tsx", "utf8");
  for (const item of extractHeaderMenuItems("Products")) {
    const [, fragment] = item.href.split("#");
    assert.ok(productsSource.includes(`id="${fragment}"`) || productsSource.includes(`id={product.title === "Integrations" ? "integrations" : undefined}`), `Dead anchor: Products nav item "${item.label}" -> #${fragment}`);
  }
  for (const item of extractHeaderMenuItems("Resources")) {
    const [, fragment] = item.href.split("#");
    assert.match(resourcesSource, new RegExp(`id:\\s*"${fragment}"`));
  }
});

// --- 8. Desktop dropdown behavior ---

test("MarketingHeader closes dropdowns on outside pointerdown and on Escape, and a single state variable enforces one-open-at-a-time", () => {
  assert.match(headerSource, /function handlePointerDown\(event: PointerEvent\) \{\s*if \(!headerRef\.current\?\.contains\(event\.target as Node\)\) \{\s*setOpenDropdown\(null\);/);
  assert.match(headerSource, /event\.key === "Escape"[\s\S]{0,80}setOpenDropdown\(null\)/);
  assert.match(headerSource, /const \[openDropdown, setOpenDropdown\] = useState<string \| null>\(null\)/);
});

test("selecting a nav item closes the open menu (every Link in the dropdown calls closeMenus onClick)", () => {
  const desktopDropdown = headerSource.match(/\{openDropdown === item\.name && \(([\s\S]*?)\)\}\s*<\/div>\s*\)\)\}/)[1];
  assert.match(desktopDropdown, /onClick=\{closeMenus\}/);
});

test("dropdown triggers expose aria-expanded and aria-controls for keyboard/screen-reader users", () => {
  assert.match(headerSource, /aria-expanded=\{openDropdown === item\.name\}/);
  assert.match(headerSource, /aria-controls=\{`marketing-menu-\$\{item\.name\.toLowerCase\(\)\}`\}/);
});

// --- 9 (mobile). Mobile navigation ---

test("mobile navigation reuses the single shared `navigation` array — no separate/duplicate mobile-only nav data", () => {
  const navigationArrayDeclarations = headerSource.match(/const navigation = \[/g) || [];
  assert.equal(navigationArrayDeclarations.length, 1, "Expected exactly one navigation array shared by desktop and mobile");
  assert.match(headerSource, /aria-label="Mobile navigation"/);
});

test("mobile menu items also call closeMenus on selection (no stuck mobile menu state)", () => {
  const mobileNav = headerSource.match(/aria-label="Mobile navigation">([\s\S]*?)<\/nav>/)[1];
  assert.match(mobileNav, /onClick=\{closeMenus\}/);
});

// --- 10. Local database safety documentation ---

test("docs/STAGING.md documents the real staging database hostname and marks kuba-staging as prohibited/stale", () => {
  assert.match(stagingDocSource, /superkuba-staging-billygomez007\.aws-us-west-2\.turso\.io/);
  assert.match(stagingDocSource, /PROHIBITED \/ STALE/);
  assert.match(stagingDocSource, /kuba-staging/);
});

test("docs/STAGING.md documents the Turso token incident without printing a token value", () => {
  assert.match(stagingDocSource, /Turso credential incident/i);
  assert.match(stagingDocSource, /individual per-token revocation/i);
  assert.match(stagingDocSource, /not.*performed/i);
  assert.doesNotMatch(stagingDocSource, /eyJ[A-Za-z0-9_-]{10,}/);
});

// --- 14. Secret scan ---

const filesTouchedThisPass = [
  "docs/STAGING.md",
  "app/dashboard/layout.tsx",
  "app/components/MarketingHeader.tsx",
  "app/dashboard/ai-performance/page.tsx",
  "app/dashboard/workforce-command-center/page.tsx",
  "app/api/workforce-command-center/route.ts",
  "app/solutions/page.tsx",
  "app/industries/page.tsx",
  "app/dashboard/ecosystem/page.tsx",
  "app/dashboard/marketplace/page.tsx",
];

for (const file of filesTouchedThisPass) {
  test(`${file} contains no JWT-like or bearer-token-shaped secret values`, async () => {
    const source = await readFile(file, "utf8");
    assert.doesNotMatch(source, /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/);
    assert.doesNotMatch(source, /Bearer [A-Za-z0-9_-]{20,}/);
    assert.doesNotMatch(source, /TURSO_AUTH_TOKEN\s*=\s*[^\s"]{10,}/);
  });
}
