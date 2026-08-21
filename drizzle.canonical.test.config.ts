import { defineConfig } from "drizzle-kit";

/** Disposable-clone config used solely to validate canonical migrations. */
export default defineConfig({
  schema: "./db/schema.ts",
  out: "./drizzle-canonical",
  dialect: "turso",
  dbCredentials: {
    url: process.env.TURSO_TEST_DATABASE_URL!,
    authToken: process.env.TURSO_TEST_AUTH_TOKEN!,
  },
});
