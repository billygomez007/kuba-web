import { eq } from "drizzle-orm";

import { db } from "@/db";
import {
  aiBusinessSettings,
} from "@/db/schema";


export async function getBusinessKnowledge(
  businessId: string,
) {

  const result =
    await db
      .select()
      .from(aiBusinessSettings)
      .where(
        eq(
          aiBusinessSettings.businessId,
          businessId,
        ),
      )
      .limit(1);


  const knowledge =
    result[0];


  return `
BUSINESS KNOWLEDGE

Business Description:
${knowledge?.businessDescription || "Not provided"}

Products and Services:
${knowledge?.productsAndServices || "Not provided"}

Frequently Asked Questions:
${knowledge?.frequentlyAskedQuestions || "Not provided"}

AI Instructions:
${knowledge?.aiInstructions || "Not provided"}

Communication Tone:
${knowledge?.tone || "professional"}


RULES:
- Use only this business information.
- Do not invent products, prices, or services.
- Ask for clarification when information is missing.
`;

}
