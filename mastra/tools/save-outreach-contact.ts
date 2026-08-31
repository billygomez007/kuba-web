import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import {
  outreachContacts,
  outreachProspects,
} from "@/db/schema";
import {
  requireBusinessId,
} from "./business-context";
import { createAuditLog } from "@/lib/auth/audit";

export const saveOutreachContactTool = createTool({
  id: "save-outreach-contact",

  description:
    "Save legitimate publicly available business contact information for an existing Outreach prospect belonging to the current business. Do not save guessed, private, scraped-from-restricted-source, or unverified personal contact information.",

  inputSchema: z.object({
    prospectId: z
      .string()
      .min(1)
      .describe(
        "The Outreach prospect ID returned by the prospect-saving or retrieval capability.",
      ),

    name: z
      .string()
      .optional()
      .describe(
        "The public professional name of the business contact, if genuinely available.",
      ),

    jobTitle: z
      .string()
      .optional()
      .describe(
        "The public professional job title or role, if available.",
      ),

    email: z
      .string()
      .email()
      .optional()
      .describe(
        "A publicly listed business email address. Never guess an email address.",
      ),

    phone: z
      .string()
      .optional()
      .describe(
        "A publicly listed business phone number. Never guess a private number.",
      ),

    contactPageUrl: z
      .string()
      .url()
      .optional()
      .describe(
        "The organization's official public contact page, when available.",
      ),

    sourceUrl: z
      .string()
      .url()
      .describe(
        "The exact public source URL where the contact information was found.",
      ),

    contactType: z
      .enum([
        "business",
        "sales",
        "partnerships",
        "support",
        "procurement",
        "executive",
        "professional",
        "other",
      ])
      .default("business")
      .describe(
        "The type of public business contact.",
      ),

    verificationStatus: z
      .enum([
        "verified_public",
        "public_unverified",
      ])
      .describe(
        "verified_public means the contact appears on an official/authoritative public source. public_unverified means it appears publicly but has not been independently verified.",
      ),

    isPublic: z
      .literal(true)
      .describe(
        "Must be true. This tool only stores genuinely public business contact information.",
      ),
  }),

  outputSchema: z.union([
    z.object({
      success: z.literal(false),
      error: z.string(),
    }),
    z.object({
      success: z.literal(true),
      created: z.boolean(),
      deduplicated: z.boolean(),
      contact: z
        .object({
          id: z.string(),
          prospectId: z.string(),
        })
        .passthrough(),
    }),
  ]),

  execute: async (
    {
      prospectId,
      name,
      jobTitle,
      email,
      phone,
      contactPageUrl,
      sourceUrl,
      contactType,
      verificationStatus,
      isPublic,
    },
    { requestContext },
  ) => {
    const businessId = requireBusinessId(requestContext);

    if (!isPublic) {
      return {
        success: false as const,
        error:
          "Only publicly available business contact information can be saved.",
      };
    }

    if (!email && !phone && !contactPageUrl) {
      return {
        success: false as const,
        error:
          "At least one public business contact method is required.",
      };
    }

    const prospect = (
      await db
        .select({
          id: outreachProspects.id,
          companyName: outreachProspects.companyName,
        })
        .from(outreachProspects)
        .where(
          and(
            eq(outreachProspects.id, prospectId),
            eq(outreachProspects.businessId, businessId),
          ),
        )
        .limit(1)
    )[0];

    if (!prospect) {
      return {
        success: false as const,
        error:
          "Outreach prospect not found for the current business.",
      };
    }

    /*
     * Deduplicate by public email first, then phone, then contact page URL.
     * This remains tenant-scoped and prospect-scoped.
     */
    let existing:
      | {
          id: string;
          doNotContact: boolean;
        }
      | undefined;

    if (email) {
      existing = (
        await db
          .select({
            id: outreachContacts.id,
            doNotContact: outreachContacts.doNotContact,
          })
          .from(outreachContacts)
          .where(
            and(
              eq(outreachContacts.businessId, businessId),
              eq(outreachContacts.prospectId, prospectId),
              eq(outreachContacts.email, email.trim()),
            ),
          )
          .limit(1)
      )[0];
    }

    if (!existing && phone) {
      existing = (
        await db
          .select({
            id: outreachContacts.id,
            doNotContact: outreachContacts.doNotContact,
          })
          .from(outreachContacts)
          .where(
            and(
              eq(outreachContacts.businessId, businessId),
              eq(outreachContacts.prospectId, prospectId),
              eq(outreachContacts.phone, phone.trim()),
            ),
          )
          .limit(1)
      )[0];
    }

    if (!existing && contactPageUrl) {
      existing = (
        await db
          .select({
            id: outreachContacts.id,
            doNotContact: outreachContacts.doNotContact,
          })
          .from(outreachContacts)
          .where(
            and(
              eq(outreachContacts.businessId, businessId),
              eq(outreachContacts.prospectId, prospectId),
              eq(
                outreachContacts.contactPageUrl,
                contactPageUrl.trim(),
              ),
            ),
          )
          .limit(1)
      )[0];
    }

    const now = new Date();

    if (existing) {
      const updated = (
        await db
          .update(outreachContacts)
          .set({
            name: name?.trim() || undefined,
            jobTitle: jobTitle?.trim() || undefined,
            email: email?.trim() || undefined,
            phone: phone?.trim() || undefined,
            contactPageUrl:
              contactPageUrl?.trim() || undefined,
            sourceUrl: sourceUrl.trim(),
            contactType,
            verificationStatus,
            isPublic: true,
            updatedAt: now,
          })
          .where(
            and(
              eq(outreachContacts.id, existing.id),
              eq(outreachContacts.businessId, businessId),
              eq(outreachContacts.prospectId, prospectId),
            ),
          )
          .returning()
      )[0];

      await createAuditLog({
        businessId,
        userId: null,
        action: "ai.outreach.contact.updated",
        resource: "outreach_contact",
        resourceId: existing.id,
        description: `Kuba Outreach enriched a public business contact for "${prospect.companyName}".`,
        metadata: {
          prospectId,
          verificationStatus,
          contactType,
        },
      });

      return {
        success: true as const,
        created: false as const,
        deduplicated: true as const,
        contact: updated,
      };
    }

    const contactId = crypto.randomUUID();

    const created = (
      await db
        .insert(outreachContacts)
        .values({
          id: contactId,
          businessId,
          prospectId,

          name: name?.trim() || null,
          jobTitle: jobTitle?.trim() || null,

          email: email?.trim() || null,
          phone: phone?.trim() || null,

          contactPageUrl:
            contactPageUrl?.trim() || null,
          sourceUrl: sourceUrl.trim(),

          contactType,
          verificationStatus,

          isPublic: true,
          doNotContact: false,
          optedOutAt: null,

          createdAt: now,
          updatedAt: now,
        })
        .returning()
    )[0];

    await createAuditLog({
      businessId,
      userId: null,
      action: "ai.outreach.contact.created",
      resource: "outreach_contact",
      resourceId: contactId,
      description: `Kuba Outreach saved a public business contact for "${prospect.companyName}".`,
      metadata: {
        prospectId,
        verificationStatus,
        contactType,
      },
    });

    return {
      success: true as const,
      created: true as const,
      deduplicated: false as const,
      contact: created,
    };
  },
});
