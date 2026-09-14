// Regression/architecture-guard suite for the OpenAI production-readiness
// audit (Phase 6): OpenAI credentials must remain server-only. This proves
// it statically across the WHOLE app, not just page.tsx entry points (a
// server page.tsx can render a "use client" child component — e.g.
// app/dashboard/integrations/website-chat/page.tsx renders
// WebsiteChatClient.tsx — and it's the CHILD's own bundle, not the
// server page's, that a browser actually evaluates), by walking the real
// import graph from every "use client" file anywhere under app/.
//
// "Forbidden" here means: any file that reads process.env.OPENAI_API_KEY
// or process.env.OPENAI_REALTIME_* directly, imports "@ai-sdk/openai",
// or is one of the Mastra agent definitions (which import @ai-sdk/openai
// and are constructed with the model, tools, and instructions that use
// the API key transitively via the SDK). None of these must ever be
// reachable from a client bundle, by the same reasoning as the existing
// tests/client-bundle-no-database-import.test.mjs (a server-only env var
// throws or is undefined in a browser bundle; here the concern is worse
// than a crash — it would be exposing a real secret's *usage surface* to
// client code, even if the browser can't read process.env.OPENAI_API_KEY's
// value directly, no server-only module should ship to the client at all).
import { register } from "node:module";
import { pathToFileURL } from "node:url";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
import test from "node:test";

const REPO_ROOT = path.resolve(new URL("..", import.meta.url).pathname);
register(pathToFileURL(path.join(REPO_ROOT, "tests/helpers/alias-loader.mjs")));

const IMPORT_RE = /(?:import|export)\s+(?:[^'"]*?\sfrom\s+)?["']([^"']+)["']/g;
const TYPE_ONLY_IMPORT_RE = /(?:import|export)\s+type\s+[\s\S]*?from\s+["'][^"']+["'];?/g;

async function resolveImport(fromFile, specifier) {
  let target;
  if (specifier.startsWith("@/")) {
    target = path.join(REPO_ROOT, specifier.slice(2));
  } else if (specifier.startsWith(".")) {
    target = path.join(path.dirname(fromFile), specifier);
  } else {
    return null; // bare package specifier — handled separately as a direct "@ai-sdk/openai" check
  }
  for (const candidate of [`${target}.ts`, `${target}.tsx`, path.join(target, "index.ts"), path.join(target, "index.tsx")]) {
    try {
      await readFile(candidate);
      return candidate;
    } catch {}
  }
  return null;
}

async function readSourceStripped(file) {
  return (await readFile(file, "utf8")).replace(TYPE_ONLY_IMPORT_RE, "");
}

async function extractImportsFromSource(source) {
  const specifiers = [];
  for (const match of source.matchAll(IMPORT_RE)) specifiers.push(match[1]);
  return specifiers;
}

function isForbiddenSource(source) {
  return (
    /from\s+["']@ai-sdk\/openai["']/.test(source) ||
    /process\.env\.OPENAI_API_KEY/.test(source) ||
    /process\.env\.OPENAI_REALTIME_/.test(source)
  );
}

/** Walks the real import graph from `entryFile`, returning the first path to a file whose own source is forbidden (via @ai-sdk/openai import or a direct OPENAI_* env read), or null. */
async function findPathToOpenAIKeyUsage(entryFile, visited = new Set()) {
  if (visited.has(entryFile)) return null;
  visited.add(entryFile);

  const source = await readSourceStripped(entryFile);
  if (isForbiddenSource(source)) return [entryFile];

  const specifiers = await extractImportsFromSource(source);
  for (const specifier of specifiers) {
    const resolved = await resolveImport(entryFile, specifier);
    if (!resolved) continue;
    const subPath = await findPathToOpenAIKeyUsage(resolved, visited);
    if (subPath) return [entryFile, ...subPath];
  }
  return null;
}

async function findAllClientFiles(dir) {
  const results = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...(await findAllClientFiles(full)));
    } else if (entry.name.endsWith(".tsx") || entry.name.endsWith(".ts")) {
      const source = await readFile(full, "utf8");
      if (source.trimStart().startsWith('"use client"') || source.trimStart().startsWith("'use client'")) {
        results.push(full);
      }
    }
  }
  return results;
}

test("REGRESSION GUARD: no 'use client' file anywhere under app/ transitively imports @ai-sdk/openai or reads OPENAI_API_KEY/OPENAI_REALTIME_* — every Mastra agent, the Executive Briefing/Command Center generateText calls, and the Realtime voice adapter are reachable only from server code", async () => {
  const clientFiles = await findAllClientFiles(path.join(REPO_ROOT, "app"));
  assert.ok(clientFiles.length > 20, "sanity check: should have found many 'use client' files across app/");

  const offenders = [];
  for (const file of clientFiles) {
    const chain = await findPathToOpenAIKeyUsage(file);
    if (chain) offenders.push(`${path.relative(REPO_ROOT, file)} -> ${chain.map((f) => path.relative(REPO_ROOT, f)).join(" -> ")}`);
  }
  assert.deepEqual(offenders, []);
});

test("every known OpenAI-touching file is confirmed reachable via this walker's forbidden-source check (a positive control, proving the walker actually detects the pattern rather than trivially passing) — either directly, or transitively through lib/ai/model-config.ts for the agents that were centralized onto it", async () => {
  const knownOpenAIFiles = [
    "mastra/agents/receptionist.ts",
    "mastra/agents/sales.ts",
    "mastra/agents/customer-support.ts",
    "mastra/agents/general-manager.ts",
    "mastra/agents/outreach.ts",
    "mastra/agents/outreach-researcher.ts",
    "app/api/command-center/briefing/route.ts",
    "app/api/ai/command-center/route.ts",
    "lib/voice/adapters/openai-realtime.ts",
  ];
  for (const relativeFile of knownOpenAIFiles) {
    const entry = path.join(REPO_ROOT, relativeFile);
    const chain = await findPathToOpenAIKeyUsage(entry);
    assert.ok(chain, `${relativeFile} was expected to reach the forbidden-source pattern, directly or transitively (this is a control — if it doesn't, the main regression test above isn't actually checking anything for this file)`);
  }
});

test("SECURITY: no NEXT_PUBLIC_ environment variable name contains OPENAI anywhere in the repo — an OpenAI credential could never be accidentally inlined into the client bundle via the Next.js public-env convention", async () => {
  const { execFileSync } = await import("node:child_process");
  let output = "";
  try {
    output = execFileSync("grep", ["-rEn", "NEXT_PUBLIC[A-Z_]*OPENAI|OPENAI[A-Z_]*NEXT_PUBLIC", "--include=*.ts", "--include=*.tsx", "app", "lib", "mastra"], { cwd: REPO_ROOT, encoding: "utf8" });
  } catch (error) {
    // grep exits 1 (not an error here) when it finds zero matches.
    if (error.status !== 1) throw error;
  }
  assert.equal(output.trim(), "");
});

test("SECURITY: the public widget script (public/kuba/chat.js, served as-is to every visitor's browser) contains no reference to OpenAI or any API key", async () => {
  const source = await readFile(path.join(REPO_ROOT, "public/kuba/chat.js"), "utf8");
  assert.doesNotMatch(source, /openai/i);
  assert.doesNotMatch(source, /api[_-]?key/i);
});
