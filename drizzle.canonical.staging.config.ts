import { defineConfig } from "drizzle-kit";

/**
 * Staging-only migration lineage for the post-repair canonical history.
 *
 * This deliberately does not reference the legacy ./drizzle directory or the
 * production credential variable names. db/schema.ts remains the sole schema
 * authority for all future canonical migrations.
 */
export default defineConfig({
  schema: "./db/schema.ts",
  out: "./drizzle-canonical",
  dialect: "turso",
  dbCredentials: {
    url: process.env.TURSO_STAGING_DATABASE_URL!,
    authToken: process.env.TURSO_STAGING_AUTH_TOKEN!,
  },
});
