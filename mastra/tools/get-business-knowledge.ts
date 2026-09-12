import { createTool } from "@mastra/core/tools";
import { z } from "zod";

import { db } from "@/db";
import { aiBusinessSettings } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireBusinessId, requireEmployeeId } from "./business-context";
import { checkAIEmployeeAuthority } from "@/lib/ai/authority";


export const getBusinessKnowledgeTool = createTool({

  id: "get-business-knowledge",

  description:
    "Retrieve the company's business profile, products, customers, FAQs, instructions, and communication style. Use this before giving business-specific recommendations.",


  inputSchema: z.object({}),


  execute: async (_input, { requestContext }) => {

    const businessId = requireBusinessId(requestContext);
    const employeeId = requireEmployeeId(requestContext);
    const decision = await checkAIEmployeeAuthority({ businessId, employeeId, action: "read_business_knowledge" });
    if (!decision.ok) return { found: false, message: decision.message };

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


    if (!knowledge) {

      return {
        found: false,
        message:
          "No business knowledge profile has been configured.",
      };

    }


    return {

      found: true,

      businessDescription:
        knowledge.businessDescription,

      productsAndServices:
        knowledge.productsAndServices,

      targetCustomers:
        knowledge.targetCustomers,

      frequentlyAskedQuestions:
        knowledge.frequentlyAskedQuestions,

      aiInstructions:
        knowledge.aiInstructions,

      tone:
        knowledge.tone,

    };

  },

});
