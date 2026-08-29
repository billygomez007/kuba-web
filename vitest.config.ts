import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
  test: {
    environment: "node",
    env: {
      TURSO_DATABASE_URL: "file::memory:",
      TURSO_AUTH_TOKEN: "test-token",
    },
  },
});
