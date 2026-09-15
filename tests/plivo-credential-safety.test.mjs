// Regression coverage for Phase 3 of the Plivo voice audit: permanent
// Plivo credentials must never reach the browser. Next.js only inlines
// env vars prefixed NEXT_PUBLIC_ into the client bundle, and a "use
// client" file that imported server-only crypto/fetch code would fail
// the production build outright — but this test asserts the invariant
// directly at the source level so a regression is caught by `npm test`
// (fast, no build required) rather than only by a full `npm run build`.
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const REPO_ROOT = path.resolve(new URL("..", import.meta.url).pathname);
// "tests" is excluded from the NEXT_PUBLIC_PLIVO scan below because this
// very file legitimately contains that string as a regex literal/comment
// — it is not app/lib source that could ship to a browser. Client-file
// detection ("use client") separately only ever scans app//lib anyway.
const SKIP_DIRS = new Set(["node_modules", ".next", ".git", ".vercel", "tests"]);

async function collectFiles(dir, extensions) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...(await collectFiles(full, extensions)));
    else if (extensions.some((ext) => entry.name.endsWith(ext))) files.push(full);
  }
  return files;
}

let allSourceFiles;
let clientFiles;

test.before(async () => {
  allSourceFiles = await collectFiles(REPO_ROOT, [".ts", ".tsx", ".js", ".mjs"]);
  clientFiles = [];
  for (const file of allSourceFiles) {
    const content = await readFile(file, "utf8");
    if (content.trimStart().startsWith('"use client"') || content.trimStart().startsWith("'use client'")) {
      clientFiles.push({ file, content });
    }
  }
  assert.ok(clientFiles.length > 10, "sanity check: expected many client components in this repo");
});

test("no NEXT_PUBLIC_PLIVO* environment variable exists anywhere — Plivo credentials must never be inlined into the client bundle", async () => {
  for (const file of allSourceFiles) {
    const content = await readFile(file, "utf8");
    assert.doesNotMatch(content, /NEXT_PUBLIC_PLIVO/, `${file} must not reference a NEXT_PUBLIC_PLIVO* variable`);
  }
});

test("PLIVO_AUTH_ID/PLIVO_AUTH_TOKEN are never referenced in a \"use client\" file", () => {
  for (const { file, content } of clientFiles) {
    assert.doesNotMatch(content, /PLIVO_AUTH_ID|PLIVO_AUTH_TOKEN/, `${file} is a client component and must not reference Plivo credentials`);
  }
});

test("no \"use client\" file imports the Plivo adapter or signature-verification module", () => {
  for (const { file, content } of clientFiles) {
    assert.doesNotMatch(content, /adapters\/plivo|plivo-signature/, `${file} is a client component and must not import server-only Plivo modules`);
  }
});

test("the Plivo adapter reads credentials only from server-side process.env, never from a client-supplied value", async () => {
  const source = await readFile(path.join(REPO_ROOT, "lib/voice/adapters/plivo.ts"), "utf8");
  assert.match(source, /process\.env\.PLIVO_AUTH_ID/);
  assert.match(source, /process\.env\.PLIVO_AUTH_TOKEN/);
  assert.doesNotMatch(source, /"use client"/);
});

test("the Plivo signature verifier never accepts a caller-supplied secret — only process.env.PLIVO_AUTH_TOKEN", async () => {
  const source = await readFile(path.join(REPO_ROOT, "lib/voice/plivo-signature.ts"), "utf8");
  assert.match(source, /process\.env\.PLIVO_AUTH_TOKEN/);
  assert.doesNotMatch(source, /"use client"/);
});

test("neither Plivo API response body nor Authorization header is ever logged", async () => {
  const files = ["lib/voice/adapters/plivo.ts", "app/api/voice/plivo/answer/route.ts", "app/api/voice/plivo/status/route.ts"];
  for (const relative of files) {
    const source = await readFile(path.join(REPO_ROOT, relative), "utf8");
    assert.doesNotMatch(source, /console\.(log|warn|error)\([^)]*Authorization/i, `${relative} must not log an Authorization header`);
    assert.doesNotMatch(source, /console\.(log|warn|error)\([^)]*authToken/i, `${relative} must not log the auth token`);
  }
});
