import { createTool } from "@mastra/core/tools";
import { z } from "zod";

import { db } from "@/db";
import { aiBusinessSettings } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireBusinessId } from "./business-context";


export const getBusinessKnowledgeTool = createTool({

  id: "get-business-knowledge",

  description:
    "Retrieve the company's business profile, products, customers, FAQs, instructions, and communication style. Use this before giving business-specific recommendations.",


  inputSchema: z.object({}),


  execute: async (_input, { requestContext }) => {

    const businessId = requireBusinessId(requestContext);

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
