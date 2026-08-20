import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { eq, and } from "drizzle-orm";

import { db } from "@/db";
import { customers } from "@/db/schema";


export const findCustomerTool = createTool({

  id: "find-customer",

  description:
    "Find an existing customer using email or phone number.",

  inputSchema: z.object({
    businessId: z.string(),
    email: z.string().optional(),
    phone: z.string().optional(),
  }),

  execute: async ({
    businessId,
    email,
    phone,
  }) => {

    if (!email && !phone) {
      throw new Error(
        "Email or phone number is required.",
      );
    }

    const conditions = [
      eq(
        customers.businessId,
        businessId,
      ),
    ];

    if (email) {
      conditions.push(
        eq(
          customers.email,
          email,
        ),
      );
    } else if (phone) {
      conditions.push(
        eq(
          customers.phone,
          phone,
        ),
      );
    }

    const result =
      await db
        .select()
        .from(customers)
        .where(
          and(...conditions),
        )
        .limit(1);


    return {
      success: true,
      customer:
        result[0] || null,
    };
  },
});


export const createCustomerTool = createTool({

  id: "create-customer",

  description:
    "Create a new customer record for the business.",

  inputSchema: z.object({

    businessId:
      z.string(),

    name:
      z.string(),

    email:
      z.string().optional(),

    phone:
      z.string().optional(),

    source:
      z.string().optional(),

  }),


  execute: async ({
    businessId,
    name,
    email,
    phone,
    source = "AI Receptionist",
  }) => {

    const id =
      crypto.randomUUID();

    const now =
      new Date();


    await db
      .insert(customers)
      .values({

        id,

        businessId,

        name,

        email:
          email || null,

        phone:
          phone || null,

        source,

        createdAt:
          now,

        updatedAt:
          now,

      });


    return {

      success: true,

      customerId:
        id,

      message:
        "Customer created successfully.",

    };
  },

});
