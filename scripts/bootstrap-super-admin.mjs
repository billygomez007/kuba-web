/**
 * DEPRECATED — kept only so `npm run bootstrap:super-admin` and existing
 * muscle memory keep working. Delegates to scripts/bootstrap-platform-admin.mjs,
 * the canonical bootstrap: it refuses to run if ANY active platform admin
 * already exists (this script used to happily re-promote past that point,
 * with no such guard), writes an audit_logs entry, and correctly stores
 * updated_at in the same unit (epoch seconds, via the `timestamp` column
 * mode) every other write path in the app uses — this script previously
 * wrote an ISO string into that integer column instead.
 *
 * Usage (unchanged): npm run bootstrap:super-admin -- --email=<existing-account-email>
 */
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const emailArgument = process.argv.find((argument) => argument.startsWith("--email="));
const email = emailArgument?.slice("--email=".length).trim();

if (!email) {
  console.error("Usage: npm run bootstrap:super-admin -- --email=<existing-account-email>");
  process.exitCode = 1;
} else {
  console.error("[deprecated] scripts/bootstrap-super-admin.mjs now delegates to scripts/bootstrap-platform-admin.mjs (the canonical bootstrap).\n");
  const canonicalScript = path.join(path.dirname(fileURLToPath(import.meta.url)), "bootstrap-platform-admin.mjs");
  const result = spawnSync(process.execPath, [canonicalScript, email], { stdio: "inherit", env: process.env });
  process.exitCode = result.status ?? 1;
}
