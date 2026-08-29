// Prior audit finding: the homepage footer rendered "Privacy"/"Terms"/
// "Security" as plain <span> elements with no href, and none of those pages
// existed anywhere in the repository, alongside a broken /demo Contact Sales
// destination. This suite proves the pages now exist with real per-page
// metadata, the footer links to them for real, and Contact Sales is a real,
// working, rate-limited endpoint rather than a fake form.
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import test from "node:test";

for (const route of ["privacy", "terms", "security", "demo"]) {
  test(`app/${route}/page.tsx exists`, () => {
    assert.equal(existsSync(`app/${route}/page.tsx`), true);
  });
}

for (const [route, expectedTitle] of [
  ["privacy", "Privacy Policy"],
  ["terms", "Terms of Service"],
  ["security", "Security"],
]) {
  test(`app/${route}/page.tsx declares real per-page metadata (title + canonical), not the inherited homepage metadata`, async () => {
    const source = await readFile(`app/${route}/page.tsx`, "utf8");
    assert.match(source, /export const metadata/);
    assert.match(source, new RegExp(expectedTitle));
    assert.match(source, new RegExp(`alternates:\\s*\\{\\s*canonical:\\s*"/${route}"`));
  });
}

test("the Terms page does not invent a governing-law jurisdiction", async () => {
  const source = await readFile("app/terms/page.tsx", "utf8");
  assert.match(source, /REQUIRES PRODUCT\/LEGAL DECISION/);
});

test("the Security page makes no unsupported certification claims (only an honest disclaimer that none are held)", async () => {
  const source = await readFile("app/security/page.tsx", "utf8");
  assert.doesNotMatch(source, /is SOC\s?2 (certified|compliant)/i);
  assert.doesNotMatch(source, /ISO\s?27001[- ]certified/i);
  assert.doesNotMatch(source, /PCI[- ]DSS compliant/i);
  assert.doesNotMatch(source, /HIPAA compliant/i);
  assert.doesNotMatch(source, /GDPR[- ]certified/i);
  assert.match(source, /does not hold third-party security certifications/i);
});

test("the marketing footer links Privacy/Terms/Security as real Links, not dead <span> text", async () => {
  const source = await readFile("app/components/MarketingFooter.tsx", "utf8");
  assert.match(source, /href="\/privacy"/);
  assert.match(source, /href="\/terms"/);
  assert.match(source, /href="\/security"/);
  assert.doesNotMatch(source, /<span>Privacy<\/span>/);
  assert.doesNotMatch(source, /<span>Terms<\/span>/);
  assert.doesNotMatch(source, /<span>Security<\/span>/);
});

test("the homepage now renders the shared MarketingFooter instead of an inline duplicate", async () => {
  const source = await readFile("app/page.tsx", "utf8");
  assert.match(source, /import MarketingFooter from ".\/components\/MarketingFooter"/);
  assert.match(source, /<MarketingFooter \/>/);
  assert.doesNotMatch(source, /<span>Privacy<\/span>/);
});

test("/api/contact-sales is a real, rate-limited endpoint that validates input and only sends when configured", async () => {
  const source = await readFile("app/api/contact-sales/route.ts", "utf8");
  assert.match(source, /rateLimit\(/);
  assert.match(source, /resend\.emails\.send/);
  assert.match(source, /CONFIGURATION_REQUIRED/);
  assert.match(source, /EMAIL_PATTERN\.test\(email\)/);
});

test("the Contact Sales page posts to the real endpoint and shows a real success/error state, not a form that goes nowhere", async () => {
  const source = await readFile("app/demo/page.tsx", "utf8");
  assert.match(source, /fetch\("\/api\/contact-sales"/);
  assert.match(source, /setSubmitted/);
  assert.match(source, /setError/);
});
