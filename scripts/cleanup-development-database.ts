import { createClient, type Client } from "@libsql/client";
import { config } from "dotenv";

config({ path: [".env.local", ".env"] });

const CONFIRMATION_FLAG = "--confirm-development-cleanup";
const EXECUTE_FLAG = "--execute";
const HOST_PREFIX = "--confirm-host=";

// Platform catalogs and migration metadata are intentionally absent from this
// allowlist. Only authentication, tenant-owned, and development runtime data is
// eligible for deletion.
const CLEANUP_TABLES = [
  "ticket_messages",
  "tickets",
  "messages",
  "handoffs",
  "conversation_routing",
  "conversations",
  "communication_logs",
  "action_approvals",
  "automation_runs",
  "automations",
  "ai_employee_activities",
  "employee_skills",
  "ai_employee_teams",
  "ai_employee_settings",
  "ai_employees",
  "business_team_members",
  "business_teams",
  "follow_ups",
  "sales_activities",
  "leads",
  "customer_tags",
  "customers",
  "knowledge_chunks",
  "knowledge_sources",
  "website_widgets",
  "channel_connections",
  "integrations",
  "tasks",
  "business_localization",
  "ai_business_settings",
  "usage_records",
  "subscriptions",
  "branches",
  "business_invitations",
  "audit_logs",
  "platform_audit_logs",
  "platform_manager_assignments",
  "platform_managers",
  "business_users",
  "businesses",
  "verification",
  "session",
  "account",
  "users",
  "mastra_experiment_results",
  "mastra_experiments",
  "mastra_dataset_items",
  "mastra_dataset_versions",
  "mastra_datasets",
  "mastra_messages",
  "mastra_thread_state",
  "mastra_observational_memory",
  "mastra_threads",
  "mastra_ai_spans",
  "mastra_background_tasks",
  "mastra_harness_sessions",
  "mastra_notifications",
  "mastra_schedule_triggers",
  "mastra_schedules",
  "mastra_channel_installations",
  "mastra_channel_config",
  "mastra_tool_provider_connections",
  "mastra_favorites",
] as const;

type RowCount = { table: string; count: number };

function quoteIdentifier(value: string) {
  return `"${value.replaceAll('"', '""')}"`;
}

function requiredEnvironment(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

function validateDevelopmentTarget(databaseUrl: string) {
  if (process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production") {
    throw new Error("Refusing cleanup in a production process.");
  }

  const url = new URL(databaseUrl);
  const hostname = url.hostname.toLowerCase();
  const prohibited = ["prod", "production", "staging"];
  if (prohibited.some((marker) => hostname.includes(marker))) {
    throw new Error(`Refusing cleanup for protected host: ${hostname}`);
  }

  const confirmedHost = process.argv
    .find((argument) => argument.startsWith(HOST_PREFIX))
    ?.slice(HOST_PREFIX.length)
    .trim()
    .toLowerCase();

  if (!confirmedHost || confirmedHost !== hostname) {
    throw new Error(
      `Pass ${HOST_PREFIX}${hostname} to confirm the exact development database host.`,
    );
  }

  return hostname;
}

async function existingTables(client: Client) {
  const result = await client.execute({
    sql: "SELECT name FROM sqlite_master WHERE type = ? ORDER BY name",
    args: ["table"],
  });
  return new Set(result.rows.map((row) => String(row.name)));
}

async function countRows(client: Client, tables: readonly string[]) {
  const results = await client.batch(
    tables.map(
      (table) => `SELECT COUNT(*) AS count FROM ${quoteIdentifier(table)}`,
    ),
    "read",
  );
  return tables.map((table, index): RowCount => ({
    table,
    count: Number(results[index]?.rows[0]?.count ?? 0),
  }));
}

async function foreignKeySafeOrder(client: Client, tables: readonly string[]) {
  const candidates = new Set(tables);
  const dependencies = new Map<string, Set<string>>(
    tables.map((table) => [table, new Set<string>()]),
  );

  const foreignKeyResults = await client.batch(
    tables.map((table) => `PRAGMA foreign_key_list(${quoteIdentifier(table)})`),
    "read",
  );
  tables.forEach((table, index) => {
    const foreignKeys = foreignKeyResults[index];
    for (const row of foreignKeys.rows) {
      const parent = String(row.table);
      if (candidates.has(parent)) dependencies.get(table)?.add(parent);
    }
  });

  const ordered: string[] = [];
  const remaining = new Set(tables);
  while (remaining.size > 0) {
    const child = [...remaining].find(
      (table) =>
        ![...remaining].some(
          (other) => other !== table && dependencies.get(other)?.has(table),
        ),
    );
    if (!child) {
      throw new Error("Cleanup tables contain a foreign-key cycle.");
    }
    ordered.push(child);
    remaining.delete(child);
  }
  return ordered;
}

async function main() {
  if (!process.argv.includes(CONFIRMATION_FLAG)) {
    throw new Error(`Pass ${CONFIRMATION_FLAG} to acknowledge destructive cleanup.`);
  }

  const databaseUrl = requiredEnvironment("TURSO_DATABASE_URL");
  const authToken = requiredEnvironment("TURSO_AUTH_TOKEN");
  const hostname = validateDevelopmentTarget(databaseUrl);
  const execute = process.argv.includes(EXECUTE_FLAG);
  const client = createClient({ url: databaseUrl, authToken });

  try {
    const schemaBefore = await existingTables(client);
    const tables = CLEANUP_TABLES.filter((table) => schemaBefore.has(table));
    const before = await countRows(client, tables);
    const deletionOrder = await foreignKeySafeOrder(client, tables);

    console.log(`Development database: ${hostname}`);
    console.table(before.filter(({ count }) => count > 0));

    if (!execute) {
      console.log("Dry run only. Add --execute to delete the listed records.");
      return;
    }

    await client.batch(
      deletionOrder.map((table) => `DELETE FROM ${quoteIdentifier(table)}`),
      "write",
    );

    const after = await countRows(client, tables);
    const remaining = after.filter(({ count }) => count !== 0);
    if (remaining.length > 0) {
      throw new Error(`Cleanup verification failed: ${JSON.stringify(remaining)}`);
    }

    const foreignKeyCheck = await client.execute("PRAGMA foreign_key_check");
    if (foreignKeyCheck.rows.length > 0) {
      throw new Error(`Foreign-key verification failed: ${JSON.stringify(foreignKeyCheck.rows)}`);
    }

    const schemaAfter = await existingTables(client);
    const missingTables = [...schemaBefore].filter((table) => !schemaAfter.has(table));
    if (missingTables.length > 0) {
      throw new Error(`Schema verification failed; missing tables: ${missingTables.join(", ")}`);
    }

    console.log(`Removed ${before.reduce((sum, row) => sum + row.count, 0)} records.`);
    console.log(`Verified ${tables.length} cleanup tables are empty.`);
    console.log("Foreign-key and schema verification passed.");
  } finally {
    client.close();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
