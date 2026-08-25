import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";

import { db } from "@/db";
import {
  aiBusinessSettings,
  aiEmployeeActivities,
  aiEmployees,
  conversations,
  followUps,
  handoffs,
  knowledgeSources,
  leads,
  messages,
} from "@/db/schema";
import { requireBusinessMembership } from "@/lib/auth/tenant";
import { hasPermission, PERMISSIONS } from "@/lib/auth/permissions";

type MemoryItem = {
  id: string;
  category: string;
  title: string;
  content: string;
  source: string;
  updatedAt: Date;
  usedBy: string[];
  deletable: boolean;
};

function topCounts(values: string[], limit = 5) {
  const counts = new Map<string, number>();
  for (const value of values) {
    const normalized = value.trim().replace(/\s+/g, " ");
    if (normalized) counts.set(normalized, (counts.get(normalized) || 0) + 1);
  }
  return [...counts.entries()]
    .sort((first, second) => second[1] - first[1])
    .slice(0, limit)
    .map(([label, count]) => ({ label, count }));
}

export async function GET() {
  try {
    const { user, membership, error } = await requireBusinessMembership();
    if (!user) return NextResponse.json({ error: error || "Unauthorized" }, { status: 401 });
    if (!membership) return NextResponse.json({ error: error || "Business access denied." }, { status: 403 });
    if (!hasPermission(membership.role, membership.permissions, PERMISSIONS.KNOWLEDGE_VIEW)) return NextResponse.json({ error: "Knowledge access denied." }, { status: 403 });
    const businessId = membership.businessId;
    const [settings, sources, employees, conversationsData, messagesData, leadsData, followUpsData, handoffsData, activities] = await Promise.all([
      db.select().from(aiBusinessSettings).where(eq(aiBusinessSettings.businessId, businessId)).limit(1),
      db.select().from(knowledgeSources).where(eq(knowledgeSources.businessId, businessId)).orderBy(desc(knowledgeSources.updatedAt)),
      db.select({ id: aiEmployees.id, name: aiEmployees.name, type: aiEmployees.type }).from(aiEmployees).where(eq(aiEmployees.businessId, businessId)),
      db.select().from(conversations).where(eq(conversations.businessId, businessId)),
      db.select().from(messages).where(eq(messages.businessId, businessId)).orderBy(desc(messages.createdAt)).limit(200),
      db.select().from(leads).where(eq(leads.businessId, businessId)).orderBy(desc(leads.updatedAt)).limit(100),
      db.select().from(followUps).where(eq(followUps.businessId, businessId)).orderBy(desc(followUps.updatedAt)).limit(100),
      db.select().from(handoffs).where(eq(handoffs.businessId, businessId)).orderBy(desc(handoffs.updatedAt)).limit(100),
      db.select().from(aiEmployeeActivities).where(eq(aiEmployeeActivities.businessId, businessId)).orderBy(desc(aiEmployeeActivities.createdAt)).limit(100),
    ]);

    const now = new Date();
    const memory: MemoryItem[] = [];
    const sharedUsers = employees.map((employee) => employee.name);
    const businessSettings = settings[0];
    const addSetting = (id: string, title: string, content: string | null, source: string) => {
      if (content) memory.push({ id, category: "Business memory", title, content, source, updatedAt: businessSettings?.updatedAt || now, usedBy: sharedUsers, deletable: false });
    };

    addSetting("business-description", "Business description", businessSettings?.businessDescription || null, "Business Brain");
    addSetting("products-services", "Products and services", businessSettings?.productsAndServices || null, "Business Brain");
    addSetting("target-customers", "Target customers", businessSettings?.targetCustomers || null, "Business Brain");
    addSetting("faq", "Frequently asked questions", businessSettings?.frequentlyAskedQuestions || null, "Business Brain");
    addSetting("ai-instructions", "Business operating instructions", businessSettings?.aiInstructions || null, "Business Brain");

    for (const source of sources) {
      memory.push({
        id: source.id,
        category: "Knowledge source",
        title: source.name || source.originalName,
        content: source.description || `${source.fileType} knowledge source`,
        source: source.originalName,
        updatedAt: source.updatedAt,
        usedBy: source.employeeId ? employees.filter((employee) => employee.id === source.employeeId).map((employee) => employee.name) : sharedUsers,
        deletable: true,
      });
    }

    for (const lead of leadsData.slice(0, 20)) {
      memory.push({ id: `lead-${lead.id}`, category: "Customer memory", title: lead.name || lead.email || "Customer lead", content: [lead.service, lead.intent, lead.notes].filter(Boolean).join(" · ") || `Lead stage: ${lead.stage}`, source: "Lead record", updatedAt: lead.updatedAt, usedBy: employees.filter((employee) => employee.id === lead.assignedEmployeeId).map((employee) => employee.name), deletable: false });
    }

    for (const followUp of followUpsData.slice(0, 20)) {
      memory.push({ id: `follow-up-${followUp.id}`, category: "Customer memory", title: followUp.title, content: followUp.description || `Follow-up status: ${followUp.status}`, source: "Follow-up record", updatedAt: followUp.updatedAt, usedBy: employees.filter((employee) => employee.id === followUp.assignedEmployeeId).map((employee) => employee.name), deletable: false });
    }

    for (const activity of activities.slice(0, 20)) {
      memory.push({ id: `activity-${activity.id}`, category: "Employee memory", title: activity.title, content: activity.description || activity.type, source: "AI activity record", updatedAt: activity.createdAt, usedBy: employees.filter((employee) => employee.id === activity.employeeId).map((employee) => employee.name), deletable: false });
    }

    const inbound = messagesData.filter((message) => message.direction === "inbound");
    const questions = topCounts(inbound.filter((message) => message.content.includes("?")).map((message) => message.content.slice(0, 100)));
    const learning = {
      commonQuestions: questions,
      failedResponses: activities.filter((activity) => activity.status === "failed").map((activity) => activity.title),
      escalationReasons: topCounts(handoffsData.map((handoff) => handoff.reason)),
      customerObjections: topCounts(leadsData.map((lead) => lead.notes || "").filter((note) => /not|concern|expensive|price|cannot|can't/i.test(note))),
      knowledgeGaps: questions.filter((question) => !businessSettings?.frequentlyAskedQuestions?.toLowerCase().includes(question.label.toLowerCase())),
      suggestions: [
        ...(questions.length ? ["Review the most common customer questions and add confirmed answers to Business Brain."] : []),
        ...(handoffsData.length ? ["Review recurring handoff reasons and refine escalation guidance."] : []),
        ...(sources.length === 0 ? ["Connect a knowledge source so AI employees can answer with business-specific context."] : []),
      ],
    };

    return NextResponse.json({
      success: true,
      memory,
      learning,
      stats: {
        businessMemory: memory.filter((item) => item.category === "Business memory").length,
        knowledgeSources: sources.length,
        customerMemory: memory.filter((item) => item.category === "Customer memory").length,
        employeeMemory: memory.filter((item) => item.category === "Employee memory").length,
        conversations: conversationsData.length,
      },
    });
  } catch (error) {
    console.error("Business memory error:", error);
    return NextResponse.json({ error: "Unable to load business memory." }, { status: 500 });
  }
}
