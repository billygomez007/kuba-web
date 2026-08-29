// Prior audit finding: nearly every marketing page inherited the root
// layout's alternates.canonical: "/" with no override, so search engines
// were told every page (/products, /solutions, /industries, /resources,
// /developers, /partner, /signup, /login, even /pricing) was a duplicate of
// the homepage. No sitemap or robots file existed at all.
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("app/sitemap.ts and app/robots.ts exist (Next.js App Router metadata routes)", () => {
  assert.equal(existsSync("app/sitemap.ts"), true);
  assert.equal(existsSync("app/robots.ts"), true);
});

test("robots.ts disallows authenticated/internal surfaces and points to the sitemap", async () => {
  const source = await readFile("app/robots.ts", "utf8");
  assert.match(source, /disallow.*\/dashboard/s);
  assert.match(source, /disallow.*\/admin/s);
  assert.match(source, /disallow.*\/api/s);
  assert.match(source, /sitemap:/);
});

const pagesNeedingOwnCanonical = [
  ["app/page.tsx", "/"],
  ["app/products/page.tsx", "/products"],
  ["app/solutions/page.tsx", "/solutions"],
  ["app/industries/page.tsx", "/industries"],
  ["app/resources/page.tsx", "/resources"],
  ["app/pricing/page.tsx", "/pricing"],
  ["app/privacy/page.tsx", "/privacy"],
  ["app/terms/page.tsx", "/terms"],
  ["app/security/page.tsx", "/security"],
];

for (const [file, path] of pagesNeedingOwnCanonical) {
  test(`${file} declares its own canonical URL (${path}), not the inherited homepage one`, async () => {
    const source = await readFile(file, "utf8");
    assert.match(source, /export const metadata/);
    assert.match(source, new RegExp(`canonical:\\s*"${path.replace("/", "\\/")}"`));
  });
}

for (const file of ["app/page.tsx", "app/products/page.tsx", "app/solutions/page.tsx", "app/industries/page.tsx"]) {
  test(`${file} is a server component (metadata export requires it) — no unnecessary "use client"`, async () => {
    const source = await readFile(file, "utf8");
    assert.doesNotMatch(source, /^"use client";/);
  });
}
