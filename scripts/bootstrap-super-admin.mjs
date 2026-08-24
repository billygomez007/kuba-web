import "dotenv/config";
import { createClient } from "@libsql/client";

const emailArgument = process.argv.find((argument) => argument.startsWith("--email="));
const email = emailArgument?.slice("--email=".length).trim().toLowerCase();

if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  console.error("Usage: npm run bootstrap:super-admin -- --email=<existing-account-email>");
  process.exitCode = 1;
} else if (!process.env.TURSO_DATABASE_URL || !process.env.TURSO_AUTH_TOKEN) {
  console.error("Database configuration is missing. Set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN in the operator environment.");
  process.exitCode = 1;
} else {
  const client = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });

  try {
    const result = await client.execute({
      sql: "SELECT id, name, email, platform_role, status FROM users WHERE lower(email) = ? LIMIT 1",
      args: [email],
    });
    const user = result.rows[0];

    if (!user) {
      console.error("No existing user was found for that email.");
      process.exitCode = 1;
    } else if (user.status !== "active") {
      console.error("The existing account is not active. No changes were made.");
      process.exitCode = 1;
    } else if (user.platform_role === "super_admin") {
      console.log("User is already a Super Admin.");
    } else {
      await client.execute({
        sql: "UPDATE users SET platform_role = ?, updated_at = ? WHERE id = ? AND lower(email) = ?",
        args: ["super_admin", new Date().toISOString(), user.id, email],
      });
      console.log(`User found: ${user.name}`);
      console.log(`Email: ${user.email}`);
      console.log(`Previous platform role: ${user.platform_role}`);
      console.log("New platform role: super_admin");
      console.log("Business membership and business role were not changed.");
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Unable to update platform role.");
    process.exitCode = 1;
  } finally {
    client.close();
  }
}
