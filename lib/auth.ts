import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "../db";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "sqlite",
  }),

  user: {
    modelName: "users",
  },

  baseURL:
    process.env.BETTER_AUTH_URL ||
    "https://kuba-web-woad.vercel.app",

  trustedOrigins: [
    "https://kuba-web-woad.vercel.app",
    "https://kuba-web-kuba-web.vercel.app",
    "https://kuba-web-git-main-kuba-web.vercel.app",
    "http://localhost:3001",
  ],

  emailAndPassword: {
    enabled: true,
  },
});
