// Regression suite for a LIVE-PROVEN crash: Settings -> Team & Staff loaded
// fine on the server (200, correct HTML) but showed "This page couldn't
// load" in every real browser. Reproduced with a headless browser against
// a database-shape-matched local build: the client bundle threw
// `LibsqlError: URL_INVALID: The URL 'undefined' is not in a valid format`
// the instant it was evaluated, before React rendered anything, tripping
// the app's global-error boundary.
//
// Root cause: app/dashboard/settings/team/page.tsx ("use client") imports
// ROLE_LABELS from lib/auth/roles.ts, which imported PERMISSIONS/
// getRolePermissions from lib/auth/permissions.ts — a module that ALSO
// exports DB-touching functions (getBusinessMembership, etc.) and so
// imports "@/db" at module scope. "@/db"/index.ts constructs a libsql
// client from `process.env.TURSO_DATABASE_URL` as a top-level side effect;
// that env var is never defined in a browser bundle (only NEXT_PUBLIC_*
// vars are), so merely importing lib/auth/permissions.ts into ANY client
// component crashes it on load, regardless of whether the component ever
// calls a DB-touching function.
//
// The fix split the pure, DB-free logic into lib/auth/permission-
// definitions.ts and pointed lib/auth/roles.ts at that instead.
// lib/auth/permissions.ts re-exports it for existing server-only callers
// (dozens of app/api/*/route.ts files) and keeps only the DB-touching
// functions.
//
// This suite guards two things: (1) statically, that NO client component
// anywhere in the app can transitively reach the database module — so this
// bug class can't reoccur via any other client component, not just this
// one; (2) directly, that importing the exact page module that crashed
// live no longer throws even with TURSO_DATABASE_URL unset, which is
// exactly the browser's condition and reproduces the live crash with no
// browser needed.
import { register } from "node:module";
import { pathToFileURL } from "node:url";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
import test from "node:test";

const REPO_ROOT = path.resolve(new URL("..", import.meta.url).pathname);
register(pathToFileURL(path.join(REPO_ROOT, "tests/helpers/alias-loader.mjs")));

const IMPORT_RE = /(?:import|export)\s+(?:[^'"]*?\sfrom\s+)?["']([^"']+)["']/g;

async function resolveImport(fromFile, specifier) {
  let target;
  if (specifier.startsWith("@/")) {
    target = path.join(REPO_ROOT, specifier.slice(2));
  } else if (specifier.startsWith(".")) {
    target = path.join(path.dirname(fromFile), specifier);
  } else {
    return null; // bare package specifier (react, drizzle-orm, etc.) — not app source, not our concern here
  }
  for (const candidate of [`${target}.ts`, `${target}.tsx`, path.join(target, "index.ts"), path.join(target, "index.tsx")]) {
    try {
      await readFile(candidate);
      return candidate;
    } catch {}
  }
  return null;
}

// `import type { X } from "..."` / `export type { X } from "..."` are erased
// entirely at compile time — they never execute, so a module reached only
// through one is never actually part of the runtime bundle. Strip these
// whole-statement type-only imports before extracting real specifiers, or
// this walker over-reports (a mixed `import { a, type B } from "..."` still
// runs at runtime and is correctly kept — only the whole-statement form is
// stripped here).
const TYPE_ONLY_IMPORT_RE = /(?:import|export)\s+type\s+[\s\S]*?from\s+["'][^"']+["'];?/g;

async function extractImports(file) {
  const source = (await readFile(file, "utf8")).replace(TYPE_ONLY_IMPORT_RE, "");
  const specifiers = [];
  for (const match of source.matchAll(IMPORT_RE)) specifiers.push(match[1]);
  return specifiers;
}

/** Walks the real import graph from `entryFile` and returns the first path to any file matching `isForbidden`, or null if none exists. */
async function findPathToForbiddenModule(entryFile, isForbidden, visited = new Set()) {
  if (visited.has(entryFile)) return null;
  visited.add(entryFile);
  if (isForbidden(entryFile)) return [entryFile];

  const specifiers = await extractImports(entryFile);
  for (const specifier of specifiers) {
    const resolved = await resolveImport(entryFile, specifier);
    if (!resolved) continue;
    const subPath = await findPathToForbiddenModule(resolved, isForbidden, visited);
    if (subPath) return [entryFile, ...subPath];
  }
  return null;
}

const isDatabaseModule = (file) => file === path.join(REPO_ROOT, "db", "index.ts");

async function findClientPageFiles(dir) {
  const results = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...(await findClientPageFiles(full)));
    } else if (entry.name === "page.tsx") {
      const source = await readFile(full, "utf8");
      if (source.trimStart().startsWith('"use client"') || source.trimStart().startsWith("'use client'")) {
        results.push(full);
      }
    }
  }
  return results;
}

test("REGRESSION (live-proven crash): app/dashboard/settings/team/page.tsx never transitively imports the database module (db/index.ts constructs a libsql client from a server-only env var at module scope, which throws the instant it evaluates in a browser bundle)", async () => {
  const entry = path.join(REPO_ROOT, "app/dashboard/settings/team/page.tsx");
  const chain = await findPathToForbiddenModule(entry, isDatabaseModule);
  assert.equal(chain, null, `Team & Staff's client bundle reaches the database module via: ${chain?.map((f) => path.relative(REPO_ROOT, f)).join(" -> ")}`);
});

test("REGRESSION: lib/auth/roles.ts (imported by the Team & Staff client page) no longer imports from lib/auth/permissions.ts, which is what pulled in the database module", async () => {
  const source = await readFile(path.join(REPO_ROOT, "lib/auth/roles.ts"), "utf8");
  assert.doesNotMatch(source, /from\s+["']@\/lib\/auth\/permissions["']/);
  assert.match(source, /from\s+["']@\/lib\/auth\/permission-definitions["']/);
});

test("REGRESSION: lib/auth/permission-definitions.ts (the pure module client components use) has no database import of its own", async () => {
  const source = await readFile(path.join(REPO_ROOT, "lib/auth/permission-definitions.ts"), "utf8");
  assert.doesNotMatch(source, /from\s+["']@\/db/);
});

test("REGRESSION: every existing server-side function from lib/auth/permissions.ts (getBusinessMembership, userHasPermission, requirePermission) is still exported — the split must not break any of the dozens of API routes that import them", async () => {
  // permissions.ts genuinely (and correctly) imports "@/db" — it's the
  // server-side module now. Point it at a throwaway local file so the
  // module loads; this test only checks the exports survived the split,
  // not any actual query behavior.
  const savedUrl = process.env.TURSO_DATABASE_URL;
  const savedToken = process.env.TURSO_AUTH_TOKEN;
  process.env.TURSO_DATABASE_URL = "file::memory:";
  process.env.TURSO_AUTH_TOKEN = "";
  try {
    const { getBusinessMembership, userHasPermission, requirePermission, PERMISSIONS, hasPermission, getRolePermissions } = await import("@/lib/auth/permissions");
    assert.equal(typeof getBusinessMembership, "function");
    assert.equal(typeof userHasPermission, "function");
    assert.equal(typeof requirePermission, "function");
    assert.equal(typeof PERMISSIONS, "object");
    assert.equal(typeof hasPermission, "function");
    assert.equal(typeof getRolePermissions, "function");
  } finally {
    if (savedUrl !== undefined) process.env.TURSO_DATABASE_URL = savedUrl; else delete process.env.TURSO_DATABASE_URL;
    if (savedToken !== undefined) process.env.TURSO_AUTH_TOKEN = savedToken; else delete process.env.TURSO_AUTH_TOKEN;
  }
});

test("REGRESSION: lib/auth/permission-definitions.ts (no database import) can be imported with TURSO_DATABASE_URL unset — exactly the browser's condition, since only NEXT_PUBLIC_* env vars reach client bundles — while lib/auth/permissions.ts (which now legitimately needs the database) cannot", async () => {
  const savedUrl = process.env.TURSO_DATABASE_URL;
  const savedToken = process.env.TURSO_AUTH_TOKEN;
  delete process.env.TURSO_DATABASE_URL;
  delete process.env.TURSO_AUTH_TOKEN;
  try {
    await assert.doesNotReject(() => import("@/lib/auth/permission-definitions"), "the module the Team & Staff client bundle actually depends on must load with no database env configured");
    await assert.doesNotReject(() => import("@/lib/auth/roles"), "roles.ts must also load with no database env configured, since it's imported directly by the client page");
  } finally {
    if (savedUrl !== undefined) process.env.TURSO_DATABASE_URL = savedUrl;
    if (savedToken !== undefined) process.env.TURSO_AUTH_TOKEN = savedToken;
  }
});

test("no other 'use client' dashboard page transitively imports the database module either (the same bug class, anywhere else in the app)", async () => {
  const clientPages = await findClientPageFiles(path.join(REPO_ROOT, "app/dashboard"));
  assert.ok(clientPages.length > 10, "sanity check: should have found many client dashboard pages");
  const offenders = [];
  for (const pageFile of clientPages) {
    const chain = await findPathToForbiddenModule(pageFile, isDatabaseModule);
    if (chain) offenders.push(`${path.relative(REPO_ROOT, pageFile)} -> ${chain.map((f) => path.relative(REPO_ROOT, f)).join(" -> ")}`);
  }
  assert.deepEqual(offenders, []);
});
