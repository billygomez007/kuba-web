import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";

import * as schema from "@/db/schema";

/**
 * A minimal in-memory libsql database used only for Marketing AI tool tests.
 * It hand-declares the subset of tables the marketing tools touch, matching
 * db/schema.ts column-for-column, rather than replaying the full turso
 * migration history (some of which assumes a real Turso connection). This
 * keeps the tests fast and dependency-free while still exercising the real
 * drizzle schema objects and the real tool `execute` functions end to end.
 */
export async function createTestDb() {
  const client = createClient({ url: ":memory:" });

  await client.batch(
    [
      `CREATE TABLE businesses (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        slug TEXT NOT NULL,
        industry TEXT,
        website TEXT,
        country TEXT,
        business_size TEXT,
        logo_url TEXT,
        plan TEXT NOT NULL DEFAULT 'starter',
        status TEXT NOT NULL DEFAULT 'active',
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )`,
      `CREATE TABLE ai_business_settings (
        id TEXT PRIMARY KEY,
        business_id TEXT NOT NULL,
        business_description TEXT,
        products_and_services TEXT,
        target_customers TEXT,
        frequently_asked_questions TEXT,
        ai_instructions TEXT,
        tone TEXT,
        created_at INTEGER,
        updated_at INTEGER
      )`,
      `CREATE TABLE ai_employees (
        id TEXT PRIMARY KEY,
        business_id TEXT NOT NULL,
        branch_id TEXT,
        template_id TEXT,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        description TEXT,
        supervision_mode TEXT NOT NULL DEFAULT 'owner_supervised',
        supervisor_user_id TEXT,
        status TEXT NOT NULL DEFAULT 'active',
        mastra_agent_id TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )`,
      `CREATE TABLE leads (
        id TEXT PRIMARY KEY,
        business_id TEXT NOT NULL,
        customer_id TEXT,
        name TEXT,
        email TEXT,
        phone TEXT,
        service TEXT,
        destination TEXT,
        intent TEXT,
        notes TEXT,
        study_level TEXT,
        program TEXT,
        university TEXT,
        preferred_intake TEXT,
        budget TEXT,
        source TEXT,
        stage TEXT NOT NULL DEFAULT 'new',
        estimated_value TEXT,
        currency TEXT DEFAULT 'GHS',
        deal_status TEXT DEFAULT 'open',
        closed_at INTEGER,
        assigned_employee_id TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )`,
      `CREATE TABLE follow_ups (
        id TEXT PRIMARY KEY,
        business_id TEXT NOT NULL,
        lead_id TEXT NOT NULL,
        assigned_employee_id TEXT,
        title TEXT NOT NULL,
        description TEXT,
        due_at INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )`,
      `CREATE TABLE customers (
        id TEXT PRIMARY KEY,
        business_id TEXT NOT NULL,
        name TEXT,
        email TEXT,
        phone TEXT,
        source TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )`,
      `CREATE TABLE tasks (
        id TEXT PRIMARY KEY,
        business_id TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        priority TEXT NOT NULL DEFAULT 'normal',
        assigned_user_id TEXT,
        assigned_employee_id TEXT,
        lead_id TEXT,
        customer_id TEXT,
        automation_id TEXT,
        due_at INTEGER,
        completed_at INTEGER,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )`,
      `CREATE TABLE action_approvals (
        id TEXT PRIMARY KEY,
        business_id TEXT NOT NULL,
        employee_id TEXT,
        channel TEXT NOT NULL,
        recipient TEXT NOT NULL,
        message TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )`,
      `CREATE TABLE ai_employee_activities (
        id TEXT PRIMARY KEY,
        business_id TEXT NOT NULL,
        employee_id TEXT NOT NULL,
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        status TEXT NOT NULL DEFAULT 'completed',
        created_at INTEGER NOT NULL
      )`,
      `CREATE TABLE subscriptions (
        id TEXT PRIMARY KEY,
        business_id TEXT NOT NULL,
        provider TEXT NOT NULL,
        provider_customer_id TEXT,
        provider_subscription_id TEXT,
        provider_authorization_reference TEXT,
        provider_event_id TEXT,
        plan TEXT NOT NULL DEFAULT 'starter',
        status TEXT NOT NULL DEFAULT 'incomplete',
        current_period_start INTEGER,
        current_period_end INTEGER,
        cancel_at_period_end INTEGER NOT NULL DEFAULT 0,
        trial_end INTEGER,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )`,
      `CREATE TABLE entitlement_overrides (
        id TEXT PRIMARY KEY,
        business_id TEXT NOT NULL,
        feature TEXT NOT NULL,
        override_type TEXT NOT NULL,
        value TEXT NOT NULL,
        reason TEXT NOT NULL,
        starts_at INTEGER NOT NULL,
        expires_at INTEGER,
        created_by TEXT NOT NULL,
        created_at INTEGER NOT NULL
      )`,
    ].map((sql) => ({ sql, args: [] })),
  );

  return drizzle(client, { schema });
}

export type TestDb = Awaited<ReturnType<typeof createTestDb>>;
