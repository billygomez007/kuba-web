#!/usr/bin/env node

/**
 * One-time platform Super Admin bootstrap.
 *
 * This is NOT a public/HTTP-reachable mechanism — it is a script requiring
 * direct execution with real TURSO_DATABASE_URL/TURSO_AUTH_TOKEN
 * credentials (the same access level running a migration already
 * requires), by design, so it can never become a permanent
 * privilege-escalation path. It solves exactly one problem: granting the
 * FIRST platform admin when none exists yet, at which point the normal,
 * ongoing, audited mechanism (PATCH /api/admin/users/[id], gated by
 * isPlatformAdmin — usable by any existing platform admin) takes over for
 * every subsequent promotion.
 *
 * Refuses to run if ANY active platform admin already exists — this script
 * is not a repeatable "reset the admin" tool, and there is no --force
 * override. Once the platform has a real admin, use the in-app route
 * instead, so every subsequent grant is attributable to an actual acting
 * admin and shows up in the normal audit log.
 *
 * Does NOT create a user, a password, or an auth session. The target
 * account must already exist via the normal Better Auth signup flow —
 * this script only ever changes users.platform_role for an existing row.
 *
 * Usage:
 *   TURSO_DATABASE_URL=... TURSO_AUTH_TOKEN=... \
 *     node scripts/bootstrap-platform-admin.mjs someone@example.com
 */

import { createClient } from "@libsql/client";

const email = (process.argv[2] || "").trim().toLowerCase();
if (!email) {
  console.error("Usage: node scripts/bootstrap-platform-admin.mjs <email>");
  process.exit(1);
}

const databaseUrl = process.env.TURSO_DATABASE_URL || "";
if (!databaseUrl) {
  console.error("TURSO_DATABASE_URL is not set. This script must be run with real database credentials for the target environment.");
  process.exit(1);
}

const client = createClient({ url: databaseUrl, authToken: process.env.TURSO_AUTH_TOKEN });

const RECOGNIZED_ADMIN_ROLES = ["platform_admin", "super_admin", "system_operator"];

async function main() {
  const existingAdmins = await client.execute({
    sql: `SELECT id, email, platform_role FROM users WHERE status = 'active' AND platform_role IN (?, ?, ?)`,
    args: RECOGNIZED_ADMIN_ROLES,
  });

  const activeManagers = await client.execute({
    sql: `SELECT COUNT(*) as count FROM platform_managers WHERE status = 'active'`,
    args: [],
  });

  if (existingAdmins.rows.length > 0 || Number(activeManagers.rows[0]?.count || 0) > 0) {
    console.error("Refusing to run: an active platform admin already exists.");
    for (const row of existingAdmins.rows) {
      console.error(`  - ${row.email} (${row.platform_role})`);
    }
    console.error("Use PATCH /api/admin/users/<id> (as an existing platform admin) to grant further roles instead.");
    process.exit(1);
  }

  const target = await client.execute({
    sql: `SELECT id, email, status, platform_role FROM users WHERE email = ?`,
    args: [email],
  });

  const user = target.rows[0];
  if (!user) {
    console.error(`No user found for ${email}. They must sign up first through the normal Better Auth flow (create their own account and password in the browser) before running this script.`);
    process.exit(1);
  }

  if (user.status !== "active") {
    console.error(`${email} exists but is not an active account (status: ${user.status}). Refusing to grant a platform role to a non-active account.`);
    process.exit(1);
  }

  await client.execute({
    sql: `UPDATE users SET platform_role = 'super_admin', updated_at = ? WHERE id = ?`,
    args: [Date.now(), user.id],
  });

  await client.execute({
    sql: `INSERT INTO audit_logs (id, business_id, user_id, action, resource, resource_id, description, metadata, created_at) VALUES (?, 'platform', ?, 'admin.platform_role.changed', 'user', ?, ?, ?, ?)`,
    args: [
      crypto.randomUUID(),
      user.id,
      user.id,
      "One-time platform-admin bootstrap via scripts/bootstrap-platform-admin.mjs (no prior admin existed).",
      JSON.stringify({ targetEmail: email, fromRole: user.platform_role, toRole: "super_admin", bootstrap: true }),
      Date.now(),
    ],
  });

  console.log(`Granted platformRole=super_admin to ${email} (user id ${user.id}).`);
  console.log("This is the only bootstrap grant this script will ever make — it refuses to run again once any admin exists.");
}

main().catch((error) => {
  console.error("Bootstrap failed:", error);
  process.exit(1);
});
