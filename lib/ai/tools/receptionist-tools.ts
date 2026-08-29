import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { eq, and } from "drizzle-orm";

import { db } from "@/db";
import { customers } from "@/db/schema";
import { requireBusinessId, requireEmployeeId } from "@/mastra/tools/business-context";
import { checkAIEmployeeAuthority, fileActionApproval } from "@/lib/ai/authority";
import { createAuditLog } from "@/lib/auth/audit";


export const findCustomerTool = createTool({

  id: "find-customer",

  description:
    "Find an existing customer using email or phone number.",

  inputSchema: z.object({
    email: z.string().optional(),
    phone: z.string().optional(),
  }),

  execute: async ({
    email,
    phone,
  }, { requestContext }) => {
    const businessId = requireBusinessId(requestContext);
    const employeeId = requireEmployeeId(requestContext);
    const decision = await checkAIEmployeeAuthority({ businessId, employeeId, action: "read_customers" });
    if (!decision.ok) return { success: false, error: decision.message, customer: null };

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


const createCustomerInput = z.object({

  name:
    z.string(),

  email:
    z.string().optional(),

  phone:
    z.string().optional(),

  source:
    z.string().optional(),

});

export async function performCreateCustomer(businessId: string, employeeId: string, { name, email, phone, source = "AI Receptionist" }: z.infer<typeof createCustomerInput>) {
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

  await createAuditLog({ businessId, userId: null, action: "ai.create_customer", resource: "customer", resourceId: id, description: `AI employee created customer "${name}".`, metadata: { employeeId, source } });

  return {

    success: true,

    customerId:
      id,

    message:
      "Customer created successfully.",

  };
}

export const createCustomerTool = createTool({

  id: "create-customer",

  description:
    "Create a new customer record for the business.",

  inputSchema: createCustomerInput,


  execute: async (input, { requestContext }) => {
    const businessId = requireBusinessId(requestContext);
    const employeeId = requireEmployeeId(requestContext);
    const decision = await checkAIEmployeeAuthority({ businessId, employeeId, action: "create_customer" });
    if (!decision.ok) {
      if (decision.reason === "requires_approval") {
        const approvalId = await fileActionApproval({ businessId, employeeId, action: "create_customer", payload: input });
        return { success: true, status: "approval_required", approvalId, message: `Approval requested. Approval ID: ${approvalId}` };
      }
      return { success: false, error: decision.message };
    }
    return performCreateCustomer(businessId, employeeId, input);
  },

});
