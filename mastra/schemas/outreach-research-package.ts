import { z } from "zod";

/*
 * Shared structured research package schema.
 *
 * This is the single contract between:
 *
 * - the research-only Outreach agent (mastra/agents/outreach-researcher.ts),
 *   which produces a package but has no database-mutation tools;
 * - the deterministic Outreach persistence workflow
 *   (mastra/workflows/outreach-prospect-workflow.ts), which is the only
 *   thing allowed to persist it.
 *
 * Keeping this in one place means the researcher's structured output and the
 * workflow's input can never silently drift apart.
 *
 * TWO THINGS IN HERE ARE NOT OBVIOUS, BOTH CONFIRMED DIRECTLY AGAINST THE
 * OPENAI RESPONSES API (gpt-4o), NOT FROM DOCUMENTATION:
 *
 * 1. URL / EMAIL FIELDS: zod's `.url()` emits JSON Schema `format: "uri"`,
 *    which OpenAI's native structured-output strict mode rejects outright
 *    (400: "'uri' is not a valid format"). Less obviously, zod's `.email()`
 *    emits `format: "email"` PLUS a `pattern` regex with negative lookaheads
 *    — OpenAI accepts that schema (no 400), but the model then silently
 *    stalls: it returns finishReason "length" with zero output tokens and
 *    zero usage, for the entire response, even for fields unrelated to
 *    email. Constrained decoding apparently cannot compile that lookahead
 *    pattern into a working token grammar. Confirmed via bisection: schemas
 *    that are otherwise identical but omit z.string().email() generate
 *    normally. Both are therefore replaced with plain z.string() plus a
 *    .refine() — validated client-side after the model responds, invisible
 *    to (and un-rejectable/un-stallable by) the response-format schema.
 *
 * 2. NULLABLE, NOT JUST OPTIONAL: OpenAI's strict mode requires every
 *    property to appear in the object's `required` array (there is no
 *    concept of an absent key). Mastra's schema conversion satisfies that by
 *    marking every `.optional()` field required, but — confirmed
 *    empirically — does NOT also widen its type to allow `null`. The result
 *    is a field the model is never allowed to omit and can never mark
 *    unknown: it invents a value instead (an empty string, or a guessed
 *    enum member such as buyingSignalStrength: "low" for evidence with no
 *    buying signal at all). That is exactly the fabrication this project
 *    exists to prevent. Every field that is genuinely optional is therefore
 *    also `.nullable()`, so the model can truthfully return `null` for
 *    "unknown" or "not applicable" instead of guessing.
 */
function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

const httpUrlSchema = z
  .string()
  .refine(isHttpUrl, { message: "Must be a valid http(s) URL." });

const emailSchema = z
  .string()
  .refine(isEmail, { message: "Must be a valid email address." });

export const outreachProspectInputSchema = z.object({
  companyName: z.string().min(1),
  website: z.string().nullable().optional(),
  industry: z.string().nullable().optional(),
  country: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  discoverySource: z.string().nullable().optional(),
  discoveryQuery: z.string().nullable().optional(),
});

export const outreachEvidenceInputSchema = z.object({
  findingType: z.string().min(1),
  claim: z.string().min(1),

  classification: z.enum([
    "confirmed",
    "likely_inference",
    "unknown",
  ]),

  sourceUrl: httpUrlSchema.nullable().optional(),
  sourceTitle: z.string().nullable().optional(),

  sourceTier: z
    .number()
    .int()
    .min(1)
    .max(4)
    .nullable()
    .optional(),

  sourceType: z.string().nullable().optional(),

  buyingSignalType: z.string().nullable().optional(),
  buyingSignalStrength: z
    .enum(["low", "medium", "high"])
    .nullable()
    .optional(),

  observedAt: z.string().nullable().optional(),
});

export const outreachAvailableContactSchema = z
  .object({
    available: z.literal(true),

    name: z.string().nullable().optional(),
    jobTitle: z.string().nullable().optional(),

    email: emailSchema.nullable().optional(),
    phone: z.string().nullable().optional(),

    contactPageUrl: httpUrlSchema.nullable().optional(),

    sourceUrl: httpUrlSchema,

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
      .default("business"),

    verificationStatus: z.enum([
      "verified_public",
      "public_unverified",
    ]),
  })
  .refine(
    (value) =>
      Boolean(
        value.email ||
        value.phone ||
        value.contactPageUrl,
      ),
    {
      message:
        "An available contact must contain a public email, phone, or contact-page URL.",
    },
  );

export const outreachUnavailableContactSchema = z.object({
  available: z.literal(false),

  reason: z
    .string()
    .min(1)
    .describe(
      "Why no legitimate public contact route could be saved.",
    ),
});

export const outreachContactInputSchema = z.union([
  outreachAvailableContactSchema,
  outreachUnavailableContactSchema,
]);

export const outreachQualificationInputSchema = z.object({
  status: z.enum([
    "qualified",
    "nurture",
    "disqualified",
  ]),

  icpFitScore: z
    .number()
    .int()
    .min(0)
    .max(100),

  reason: z
    .string()
    .min(20)
    .max(3000),
});

/**
 * The full structured research package. This is what the research-only
 * agent must produce, and what the deterministic persistence workflow
 * accepts as input. Nothing outside this shape (no ids, no
 * businessId/employeeId, no "saved" flags) can be emitted by the model.
 */
export const outreachResearchPackageSchema = z.object({
  prospect: outreachProspectInputSchema,

  evidence: z
    .array(outreachEvidenceInputSchema)
    .min(1)
    .max(20),

  contact: outreachContactInputSchema,

  qualification: outreachQualificationInputSchema,
});

export type OutreachResearchPackage = z.infer<
  typeof outreachResearchPackageSchema
>;
