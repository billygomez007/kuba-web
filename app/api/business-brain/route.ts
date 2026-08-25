import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import {
  aiBusinessSettings,
  aiEmployees,
  businessLocalization,
  businesses,
  knowledgeSources,
} from "@/db/schema";
import { requireBusinessMembership } from "@/lib/auth/tenant";
import { hasPermission, PERMISSIONS } from "@/lib/auth/permissions";

export async function GET() {
  try {
    const { user, membership, error } = await requireBusinessMembership();
    if (!user) return NextResponse.json({ error: error || "Unauthorized" }, { status: 401 });
    if (!membership) return NextResponse.json({ error: error || "Business access denied." }, { status: 403 });
    if (!hasPermission(membership.role, membership.permissions, PERMISSIONS.KNOWLEDGE_VIEW)) return NextResponse.json({ error: "Knowledge access denied." }, { status: 403 });
    const businessId = membership.businessId;
    const [businessResult, settingsResult, localizationResult, employeeRows, sourceRows] = await Promise.all([
      db.select().from(businesses).where(eq(businesses.id, businessId)).limit(1),
      db.select().from(aiBusinessSettings).where(eq(aiBusinessSettings.businessId, businessId)).limit(1),
      db.select().from(businessLocalization).where(eq(businessLocalization.businessId, businessId)).limit(1),
      db.select({ id: aiEmployees.id, name: aiEmployees.name, type: aiEmployees.type, status: aiEmployees.status }).from(aiEmployees).where(eq(aiEmployees.businessId, businessId)),
      db.select({ id: knowledgeSources.id, name: knowledgeSources.name, originalName: knowledgeSources.originalName, fileType: knowledgeSources.fileType, status: knowledgeSources.status, updatedAt: knowledgeSources.updatedAt, employeeId: knowledgeSources.employeeId }).from(knowledgeSources).where(eq(knowledgeSources.businessId, businessId)),
    ]);

    const business = businessResult[0];
    if (!business) {
      return NextResponse.json({ error: "Business not found." }, { status: 404 });
    }

    const settings = settingsResult[0] || null;
    const localization = localizationResult[0] || null;
    const sharedSources = sourceRows.filter((source) => source.employeeId === null);

    return NextResponse.json({
      success: true,
      profile: {
        companyName: business.name,
        industry: business.industry,
        description: settings?.businessDescription || null,
        productsAndServices: settings?.productsAndServices || null,
        targetCustomers: settings?.targetCustomers || null,
        businessHours: null,
        location: business.country || localization?.country || null,
        languages: localization?.language ? [localization.language] : [],
        timezone: localization?.timezone || null,
        communicationStyle: settings?.tone || null,
      },
      sources: sourceRows,
      employees: employeeRows.map((employee) => ({
        ...employee,
        access: sharedSources.map((source) => source.name),
        dedicatedSources: sourceRows
          .filter((source) => source.employeeId === employee.id)
          .map((source) => source.name),
      })),
      memory: {
        shortTerm: "Conversation context is maintained by the existing AI memory system.",
        longTerm: settings?.businessDescription || "Not configured",
        customerPreferences: "Available through customer and conversation records.",
        pastInteractions: "Available through conversation history.",
        importantFacts: settings?.aiInstructions || "Not configured",
      },
      rules: {
        communicationTone: settings?.tone || "Not configured",
        approvalRules: "Managed through existing action approval workflows.",
        workingHours: "Not configured",
        escalationRules: settings?.aiInstructions || "Not configured",
        restrictedActions: "External actions remain subject to existing approval controls.",
      },
    });
  } catch (error) {
    console.error("Business Brain error:", error);
    return NextResponse.json({ error: "Unable to load Business Brain." }, { status: 500 });
  }
}
