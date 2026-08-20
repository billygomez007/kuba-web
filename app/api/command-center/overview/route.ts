import { headers } from "next/headers";
import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { db } from "@/db";

import {
  businessUsers,
  aiEmployees,
  leads,
  followUps,
  customers,
  conversations,
} from "@/db/schema";

import { eq } from "drizzle-orm";


export async function GET() {
  try {
    const session =
      await auth.api.getSession({
        headers: await headers(),
      });

    if (!session?.user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 },
      );
    }

    const membership =
      await db
        .select({
          businessId:
            businessUsers.businessId,
        })
        .from(businessUsers)
        .where(
          eq(
            businessUsers.userId,
            session.user.id,
          ),
        )
        .limit(1);

    const business = membership[0];

    console.log(
      "COMMAND CENTER MEMBERSHIP:",
      membership,
    );

    if (!business) {
      return NextResponse.json(
        { error: "Business not found" },
        { status: 404 },
      );
    }

    const [
      employeeData,
      leadData,
      followUpData,
      customerData,
      conversationData,
    ] = await Promise.all([
      db
        .select()
        .from(aiEmployees)
        .where(
          eq(
            aiEmployees.businessId,
            business.businessId,
          ),
        ),

      db
        .select()
        .from(leads)
        .where(
          eq(
            leads.businessId,
            business.businessId,
          ),
        ),

      db
        .select()
        .from(followUps)
        .where(
          eq(
            followUps.businessId,
            business.businessId,
          ),
        ),

      db
        .select()
        .from(customers)
        .where(
          eq(
            customers.businessId,
            business.businessId,
          ),
        ),

      db
        .select()
        .from(conversations)
        .where(
          eq(
            conversations.businessId,
            business.businessId,
          ),
        ),
    ]);

    const pipeline = {
      new: leadData.filter(
        (lead) => lead.stage === "new",
      ).length,

      contacted: leadData.filter(
        (lead) => lead.stage === "contacted",
      ).length,

      qualified: leadData.filter(
        (lead) => lead.stage === "qualified",
      ).length,

      converted: leadData.filter(
        (lead) => lead.stage === "converted",
      ).length,
    };


    const now = new Date();

    const followUpSummary = {
      total: followUpData.length,

      overdue: followUpData.filter(
        (item) =>
          item.dueAt < now &&
          item.status !== "completed",
      ).length,

      assignedToKuba: followUpData.filter(
        (item) =>
          item.assignedEmployeeId !== null,
      ).length,

      pending: followUpData.filter(
        (item) =>
          item.status === "pending",
      ).length,
    };


    return NextResponse.json({
      employees: employeeData.length,

      salesPipeline: {
        total: leadData.length,
        stages: pipeline,
      },

      followUps: followUpSummary,

      customers: customerData.length,

      conversations: conversationData.length,
    });

  } catch (error) {

    console.error(
      "Command center overview error:",
      error,
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : JSON.stringify(error),
      },
      {
        status:500,
      },
    );

  }
}
