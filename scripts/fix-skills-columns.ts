import "dotenv/config";
import { createClient } from "@libsql/client";

const client = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!,
});

async function main() {
  const queries = [
    "ALTER TABLE skills ADD COLUMN publisher text DEFAULT 'Kuba' NOT NULL",
    "ALTER TABLE skills ADD COLUMN icon text",
    "ALTER TABLE skills ADD COLUMN is_marketplace integer DEFAULT 1 NOT NULL",
    "ALTER TABLE skills ADD COLUMN price integer DEFAULT 0 NOT NULL",
    "ALTER TABLE skills ADD COLUMN rating integer DEFAULT 5 NOT NULL",
    "ALTER TABLE skills ADD COLUMN install_count integer DEFAULT 0 NOT NULL",
  ];

  for (const query of queries) {
    try {
      await client.execute(query);
      console.log("Applied:", query);
    } catch (error) {
      console.log("Skipped:", query);
    }
  }

  console.log("Skills columns check completed.");
}

main();
