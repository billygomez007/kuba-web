import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "../db";
import { getResend } from "@/lib/email/resend";
import {
  emailChangeConfirmationTemplate,
  passwordResetEmailTemplate,
  verificationEmailTemplate,
} from "@/lib/email/templates";
import { computeTrustedOrigins } from "@/lib/auth/trusted-origins";
import { isProductionDomain } from "@/lib/auth/production-domain";

const PRODUCTION_URL = "https://superkuba.com";
const isProduction = process.env.NODE_ENV === "production";

// See lib/auth/production-domain.ts for why this is NOT the same question
// as `isProduction` above — anything tied to the real production domain
// (cross-subdomain cookies, the `.superkuba.com` cookie Domain attribute,
// `sameSite: "none"`) must gate on this instead.
const onProductionDomain = isProductionDomain({
  nodeEnv: process.env.NODE_ENV,
  vercelEnv: process.env.VERCEL_ENV,
});

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
  (onProductionDomain ? PRODUCTION_URL : "http://localhost:3000");

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "sqlite",
  }),

  baseURL,

  trustedOrigins: computeTrustedOrigins({
    isProduction: onProductionDomain,
    vercelEnv: process.env.VERCEL_ENV,
    vercelUrl: process.env.VERCEL_URL,
    vercelBranchUrl: process.env.VERCEL_BRANCH_URL,
    configuredAuthURL,
    configuredAppURL,
  }),

  advanced: {
    // Preview (and local dev) deliberately fall through to Better Auth's
    // own default cookie behavior — a host-only cookie scoped to whatever
    // hostname actually served the response — rather than any override
    // here. That is the correct, safer mechanism for an environment whose
    // hostname changes per-deployment; it is never appropriate to invent a
    // shared cookie domain covering every generated preview hostname.
    crossSubDomainCookies: {
      enabled: onProductionDomain,
      domain: onProductionDomain
        ? ".superkuba.com"
        : undefined,
    },
    defaultCookieAttributes: onProductionDomain
      ? {
          httpOnly: true,
          secure: true,
          sameSite: "none",
          partitioned: true,
        }
      : {},
  },

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
    sendResetPassword: async ({ user, url }) => {
      const template = passwordResetEmailTemplate({
        name: user.name || "there",
        actionUrl: url,
      });

      await getResend().emails.send({
        from: process.env.EMAIL_FROM!,
        to: user.email,
        subject: template.subject,
        html: template.html,
        text: template.text,
      });
    },
  },

  emailVerification: {
    sendVerificationEmail: async ({ user, url }) => {
      const template = verificationEmailTemplate({
        name: user.name || "there",
        actionUrl: url,
      });

      await getResend().emails.send({
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

        await getResend().emails.send({
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
