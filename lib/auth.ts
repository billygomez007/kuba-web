import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "../db";

const PRODUCTION_URL = "https://superkuba.com";
const isProduction = process.env.NODE_ENV === "production";
const vercelPreviewURL =
  process.env.VERCEL_ENV === "preview" && process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : null;
const baseURL =
  vercelPreviewURL ||
  process.env.BETTER_AUTH_URL ||
  (isProduction ? PRODUCTION_URL : "http://localhost:3000");

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "sqlite",
  }),

  user: {
    modelName: "users",
  },

  baseURL,

  trustedOrigins: [
    PRODUCTION_URL,
    "https://www.superkuba.com",
    ...(vercelPreviewURL ? [vercelPreviewURL] : []),
    ...(!isProduction ? ["http://localhost:3000", "http://localhost:3001"] : []),
  ],

  rateLimit: {
    enabled: isProduction,
    window: 60,
    max: 100,
    customRules: {
      "/sign-in/email": { window: 60, max: 10 },
      "/sign-up/email": { window: 60, max: 5 },
      "/forget-password": { window: 300, max: 5 },
    },
  },

  emailAndPassword: {
    enabled: true,
  },
});
