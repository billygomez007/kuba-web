import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "../db";
import { resend } from "@/lib/email/resend";
import {
  emailChangeConfirmationTemplate,
  verificationEmailTemplate,
} from "@/lib/email/templates";
import { computeTrustedOrigins } from "@/lib/auth/trusted-origins";

const PRODUCTION_URL = "https://superkuba.com";
const isProduction = process.env.NODE_ENV === "production";
const configuredAuthURL = process.env.BETTER_AUTH_URL || null;
const configuredAppURL =
  process.env.NEXT_PUBLIC_APP_URL || process.env.PUBLIC_APP_URL || null;
const vercelPreviewURL =
  process.env.VERCEL_ENV === "preview" && process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : null;
const baseURL =
  configuredAuthURL ||
  vercelPreviewURL ||
  (isProduction ? PRODUCTION_URL : "http://localhost:3000");

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "sqlite",
  }),

  baseURL,

  trustedOrigins: computeTrustedOrigins({
    isProduction,
    vercelEnv: process.env.VERCEL_ENV,
    vercelUrl: process.env.VERCEL_URL,
    vercelBranchUrl: process.env.VERCEL_BRANCH_URL,
    configuredAuthURL,
    configuredAppURL,
  }),

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

  emailVerification: {
    sendVerificationEmail: async ({ user, url }) => {
      const template = verificationEmailTemplate({
        name: user.name || "there",
        actionUrl: url,
      });

      await resend.emails.send({
        from: process.env.EMAIL_FROM!,
        to: user.email,
        subject: template.subject,
        html: template.html,
        text: template.text,
      });
    },
  },

  user: {
    modelName: "users",
    changeEmail: {
      enabled: true,
      sendChangeEmailConfirmation: async ({ user, newEmail, url }) => {
        const template = emailChangeConfirmationTemplate({
          name: user.name || "there",
          newEmail,
          actionUrl: url,
        });

        await resend.emails.send({
          from: process.env.EMAIL_FROM!,
          to: user.email,
          subject: template.subject,
          html: template.html,
          text: template.text,
        });
      },
    },
  },
});
