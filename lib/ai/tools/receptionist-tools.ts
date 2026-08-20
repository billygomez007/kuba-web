import { eq, and } from "drizzle-orm";

import { db } from "@/db";
import { customers } from "@/db/schema";

export async function findCustomerTool({
  businessId,
  email,
  phone,
}: {
  businessId: string;
  email?: string;
  phone?: string;
}) {
  if (!email && !phone) {
    throw new Error("Email or phone number is required.");
  }

  const conditions = [
    eq(customers.businessId, businessId),
  ];

  if (email) {
    conditions.push(eq(customers.email, email));
  } else if (phone) {
    conditions.push(eq(customers.phone, phone));
  }

  const result = await db
    .select()
    .from(customers)
    .where(and(...conditions))
    .limit(1);

  return {
    success: true,
    customer: result[0] || null,
  };
}

export async function createCustomerTool({
  businessId,
  name,
  email,
  phone,
  source = "AI Receptionist",
}: {
  businessId: string;
  name: string;
  email?: string;
  phone?: string;
  source?: string;
}) {
  const id = crypto.randomUUID();
  const now = new Date();

  await db.insert(customers).values({
    id,
    businessId,
    name,
    email: email || null,
    phone: phone || null,
    source,
    createdAt: now,
    updatedAt: now,
  });

  return {
    success: true,
    customerId: id,
    message: "Customer created successfully.",
  };
}
