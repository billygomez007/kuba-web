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

  baseURL: "http://localhost:3000",

  emailAndPassword: {
    enabled: true,
  },
});