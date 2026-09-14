import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { test } from "node:test";
import vm from "node:vm";
import { createClient } from "@libsql/client";
import * as orm from "drizzle-orm";
import { drizzle } from "drizzle-orm/libsql";
import { getTableConfig } from "drizzle-orm/sqlite-core";
import ts from "typescript";
import * as schema from "../db/schema.ts";
import * as originHelpers from "../lib/integrations/website-chat-origin.ts";

const require = createRequire(import.meta.url);
const routeSource = await readFile(new URL("../app/api/integrations/website-chat/route.ts", import.meta.url), "utf8");
const routeCode = ts.transpileModule(routeSource, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const originA = "https://koraafric.com";
const originB = "https://www.realtegicworks.com";
const keyA = "kuba_pk_test_business_a";
const keyB = "kuba_pk_test_business_b";

async function fixture(t) {
  // Always local, ephemeral SQLite. Never read a database URL/token from env.
  const client = createClient({ url: "file::memory:" });
  const changes = async () => Number((await client.execute("SELECT total_changes() AS n")).rows[0].n);
  let initialChanges;
  t.after(async () => {
    try {
      if (initialChanges !== undefined) {
        assert.equal(await changes(), initialChanges, "Handlers must not write in these tests");
      }
    } finally {
      client.close();
    }
  });
  const db = drizzle(client, { schema });
  for (const table of [schema.businesses, schema.integrations, schema.aiBusinessSettings, schema.aiEmployees]) {
    const { name, columns } = getTableConfig(table);
    // Real application column names/types, without unrelated fixture constraints.
    // This creates test tables only; no migration file or migrator is executed.
    const definitions = columns.map((column) => `"${column.name}" ${column.getSQLType()}`);
    await client.execute(`CREATE TABLE "${name}" (${definitions.join(", ")})`);
  }
  for (const [suffix, key, origin] of [["a", keyA, originA], ["b", keyB, originB]]) {
    await db.insert(schema.businesses).values({
      id: `business-${suffix}`, name: `Fixture ${suffix}`, slug: `fixture-${suffix}`,
      status: "active", createdAt: new Date(0), updatedAt: new Date(0),
    });
    await db.insert(schema.integrations).values({
      id: `integration-${suffix}`, businessId: `business-${suffix}`,
      provider: "website_chat", publicKey: key, status: "active",
      allowedOrigins: JSON.stringify([origin]), createdAt: new Date(0), updatedAt: new Date(0),
    });
  }

  const imports = {
    "next/server": require("next/server"),
    "node:crypto": require("node:crypto"),
    "drizzle-orm": orm,
    "@/db": { db },
    "@/db/schema": schema,
    "@/lib/integrations/website-chat-origin": originHelpers,
  };
  // These dependencies must not run in authorization/preflight tests.
  for (const name of [
    "@mastra/core/request-context", "@/lib/communications/team-router",
    "@/lib/communications/router", "@/lib/communications/ai-agent-registry",
    "@/lib/knowledge/search", "@/lib/automations/engine", "@/lib/auth/audit",
  ]) {
    imports[name] = new Proxy({}, { get() { throw new Error(`Unexpected dependency: ${name}`); } });
  }
  const routeModule = { exports: {} };
  vm.runInNewContext(routeCode, {
    module: routeModule, exports: routeModule.exports, URL, console, Error,
    require(name) {
      if (!(name in imports)) throw new Error(`Unexpected import: ${name}`);
      return imports[name];
    },
  });
  initialChanges = await changes();
  return routeModule.exports;
}

function preflight(key, origin) {
  return new Request(`https://www.superkuba.com/api/integrations/website-chat?publicKey=${key}`, {
    method: "OPTIONS", headers: origin ? { Origin: origin } : {},
  });
}

function post(queryKey, bodyKey, origin) {
  return new Request(`https://www.superkuba.com/api/integrations/website-chat?publicKey=${queryKey}`, {
    method: "POST", headers: { Origin: origin, "Content-Type": "application/json" },
    body: JSON.stringify({ publicKey: bodyKey, message: "Local authorization fixture" }),
  });
}

async function assertDenied(response) {
  assert.equal(response.status, 403);
  assert.deepEqual(await response.json(), { error: "Website chat is unavailable." });
  assert.equal(response.headers.get("Access-Control-Allow-Origin"), null);
  assert.equal(response.headers.get("Access-Control-Allow-Credentials"), null);
}

test("DB-backed preflight resolves an active integration and returns exact CORS headers", async (t) => {
  const route = await fixture(t);
  for (const [key, origin] of [[keyA, originA], [keyB, originB]]) {
    const response = await route.OPTIONS(preflight(key, origin));
    assert.equal(response.status, 204);
    assert.equal(response.headers.get("Access-Control-Allow-Origin"), origin);
    assert.equal(response.headers.get("Vary"), "Origin");
    assert.equal(response.headers.get("Access-Control-Allow-Methods"), "POST, OPTIONS");
    assert.equal(response.headers.get("Access-Control-Allow-Headers"), "Content-Type");
    assert.equal(response.headers.get("Access-Control-Allow-Credentials"), null);
  }
  await assertDenied(await route.OPTIONS(preflight("unknown", originA)));
  await assertDenied(await route.OPTIONS(preflight(keyA, null)));
});

test("DB-backed OPTIONS and POST reject malformed or foreign origins before any write", async (t) => {
  const route = await fixture(t);
  for (const origin of [
    "https:koraafric.com", "https:/koraafric.com", "https://koraafric.com#",
    "https://koraafric.com?", `${originA}/`, `${originA}/path`,
    "https://user@koraafric.com", `${originA} ${originB}`, `${originA},${originB}`,
    "http://koraafric.com", "https://sub.koraafric.com", `${originA}:444`,
    "https://evil-koraafric.com", "https://koraafric.com.evil.example", "null",
  ]) {
    await assertDenied(await route.OPTIONS(preflight(keyA, origin)));
    await assertDenied(await route.POST(post(keyA, keyA, origin)));
  }
});

test("DB-backed POST body B cannot borrow query A's approved preflight or origin policy", async (t) => {
  const route = await fixture(t);
  assert.equal((await route.OPTIONS(preflight(keyA, originA))).status, 204);
  await assertDenied(await route.POST(post(keyA, keyB, originA)));
});

test("DB-backed POST denies unknown body keys even when the query key is known", async (t) => {
  const route = await fixture(t);
  await assertDenied(await route.POST(post(keyA, "kuba_pk_unknown", originA)));
});

test("DB-backed POST authorizes the body integration independently of the query key", async (t) => {
  const route = await fixture(t);
  const response = await route.POST(post(keyA, keyB, originB));
  // B's policy passed; stop at a genuine business prerequisite, before AI/writes.
  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), { error: "Kuba Receptionist is not active." });
});
