import { and, eq } from "drizzle-orm";
import { RequestContext } from "@mastra/core/request-context";

import { db } from "@/db";
import {
  automations,
  automationRuns,
  aiEmployees,
  followUps,
  leads,
  tasks,
  conversations,
  conversationRouting,
  handoffs,
  integrations,
} from "@/db/schema";
import { getChannelAdapter } from "@/lib/channels/router";
import { getBusinessLocalization } from "@/lib/localization";
import type { ChannelType } from "@/lib/channels/types";
import { kubaSalesAgent } from "@/mastra/agents/sales";
import { kubaReceptionistAgent } from "@/mastra/agents/receptionist";
import { kubaCustomerSupportAgent } from "@/mastra/agents/customer-support";


type AutomationCondition = {
  field: string;
  operator:
    | "equals"
    | "not_equals"
    | "contains"
    | "exists";
  value?: string;
};


type AutomationAction =
  | {
      type: "assign_employee";
      employeeType: string;
    }
  | {
      type: "create_follow_up";
      title: string;
      description?: string;
      delayMinutes: number;
    }
  | {
      type: "create_task";
      title: string;
      description?: string;
      priority?: "low" | "normal" | "high" | "urgent";
      delayMinutes?: number;
      assignToEmployeeType?: string;
    }
  | {
      type: "send_message";
      channel?: string;
      recipient?: string;
      message: string;
    }
  | {
      type: "create_lead";
      name?: string;
      email?: string;
      phone?: string;
      service?: string;
      stage?: string;
    }
  | {
      type: "update_lead_status";
      status: string;
    }
  | {
      type: "assign_conversation";
      employeeType?: string;
      userId?: string;
    }
  | {
      type: "notify_team_member";
      message?: string;
    }
  | {
      type: "escalate_to_human";
      reason?: string;
    }
  | {
      type: "run_ai_employee";
      employeeType: string;
      message?: string;
    };


type AutomationDefinition = {
  trigger: string;
  conditions?: AutomationCondition[];
  actions: AutomationAction[];
};


type TriggerData = Record<string, unknown>;


function matchesCondition(
  condition: AutomationCondition,
  data: TriggerData,
): boolean {
  const actual = data[condition.field];

  if (condition.operator === "exists") {
    return (
      actual !== undefined &&
      actual !== null &&
      String(actual).trim() !== ""
    );
  }

  if (condition.operator === "equals") {
    return (
      String(actual ?? "").toLowerCase() ===
      String(condition.value ?? "").toLowerCase()
    );
  }

  if (condition.operator === "not_equals") {
    return (
      String(actual ?? "").toLowerCase() !==
      String(condition.value ?? "").toLowerCase()
    );
  }

  if (condition.operator === "contains") {
    return String(actual ?? "")
      .toLowerCase()
      .includes(
        String(condition.value ?? "").toLowerCase(),
      );
  }

  return false;
}


function matchesConditions(
  conditions: AutomationCondition[],
  data: TriggerData,
): boolean {
  return conditions.every((condition) =>
    matchesCondition(condition, data),
  );
}


export async function runAutomationTrigger({
  businessId,
  trigger,
  data,
}: {
  businessId: string;
  trigger: string;
  data: TriggerData;
}) {
  const activeAutomations = await db
    .select()
    .from(automations)
    .where(
      and(
        eq(automations.businessId, businessId),
        eq(automations.trigger, trigger),
        eq(automations.status, "active"),
      ),
    );

  const results: Array<Record<string, unknown>> = [];

  for (const automation of activeAutomations) {
    let definition: AutomationDefinition;

    try {
      definition = {
        trigger: automation.trigger,
        conditions: automation.conditions
          ? JSON.parse(automation.conditions)
          : [],
        actions: JSON.parse(automation.actions),
      };
    } catch {
      results.push({
        automationId: automation.id,
        status: "failed",
        error: "Invalid automation configuration.",
      });

      continue;
    }

    const conditions = definition.conditions || [];

    if (!matchesConditions(conditions, data)) {
      results.push({
        automationId: automation.id,
        status: "skipped",
        reason: "Conditions did not match.",
      });

      continue;
    }

    const runId = crypto.randomUUID();
    const startedAt = new Date();

    await db.insert(automationRuns).values({
      id: runId,
      businessId,
      automationId: automation.id,
      triggerType: trigger,
      triggerData: JSON.stringify(data),
      status: "running",
      error: null,
      startedAt,
      completedAt: null,
    });

    try {
      for (const action of definition.actions) {
        if (action.type === "assign_employee") {
          if (typeof data.leadId !== "string") {
            throw new Error(
              "assign_employee requires leadId.",
            );
          }

          const employee = await db
            .select({
              id: aiEmployees.id,
            })
            .from(aiEmployees)
            .where(
              and(
                eq(
                  aiEmployees.businessId,
                  businessId,
                ),
                eq(
                  aiEmployees.type,
                  action.employeeType,
                ),
                eq(
                  aiEmployees.status,
                  "active",
                ),
              ),
            )
            .limit(1);

          if (!employee[0]) {
            throw new Error(
              `No active ${action.employeeType} employee found.`,
            );
          }

          await db
            .update(leads)
            .set({
              assignedEmployeeId: employee[0].id,
              updatedAt: new Date(),
            })
            .where(
              and(
                eq(leads.id, data.leadId),
                eq(
                  leads.businessId,
                  businessId,
                ),
              ),
            );
        }


        else if (action.type === "send_message") {
          const channel = String(
            action.channel || data.channel || "",
          ) as ChannelType;
          const recipient = String(
            action.recipient || data.recipient || data.customerPhone || data.customerEmail || "",
          );

          if (!channel || !recipient || !action.message) {
            throw new Error("send_message requires channel, recipient, and message.");
          }

          const connection = await db
            .select({ id: integrations.id })
            .from(integrations)
            .where(and(
              eq(integrations.businessId, businessId),
              eq(integrations.provider, channel),
              eq(integrations.status, "active"),
            ))
            .limit(1);

          if (!connection[0]) {
            throw new Error(`No active ${channel} integration is configured.`);
          }

          const adapter = getChannelAdapter(channel);
          await adapter.send({
            businessId,
            conversationId: typeof data.conversationId === "string" ? data.conversationId : "",
            recipient,
            message: action.message,
          });
        }

        else if (action.type === "create_lead") {
          const localization = await getBusinessLocalization(businessId);
          await db.insert(leads).values({
            id: crypto.randomUUID(),
            businessId,
            customerId: typeof data.customerId === "string" ? data.customerId : null,
            name: action.name || (typeof data.customerName === "string" ? data.customerName : null),
            email: action.email || (typeof data.customerEmail === "string" ? data.customerEmail : null),
            phone: action.phone || (typeof data.customerPhone === "string" ? data.customerPhone : null),
            service: action.service || null,
            destination: null,
            intent: null,
            notes: null,
            studyLevel: null,
            program: null,
            university: null,
            preferredIntake: null,
            budget: null,
            source: `automation:${automation.id}`,
            stage: action.stage || "new",
            estimatedValue: null,
            currency: localization.currencyCode,
            dealStatus: "open",
            closedAt: null,
            assignedEmployeeId: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          });
        }

        else if (action.type === "update_lead_status") {
          if (typeof data.leadId !== "string" || !action.status) {
            throw new Error("update_lead_status requires leadId and status.");
          }

          await db.update(leads).set({
            stage: action.status,
            updatedAt: new Date(),
          }).where(and(
            eq(leads.id, data.leadId),
            eq(leads.businessId, businessId),
          ));
        }

        else if (action.type === "assign_conversation") {
          if (typeof data.conversationId !== "string") {
            throw new Error("assign_conversation requires conversationId.");
          }

          const conversation = await db.select({
            businessId: conversations.businessId,
          }).from(conversations).where(and(
            eq(conversations.id, data.conversationId),
            eq(conversations.businessId, businessId),
          )).limit(1);

          if (!conversation[0]) throw new Error("Conversation not found for automation.");

          const employee = action.employeeType
            ? await db.select({ id: aiEmployees.id }).from(aiEmployees).where(and(
                eq(aiEmployees.businessId, businessId),
                eq(aiEmployees.type, action.employeeType),
                eq(aiEmployees.status, "active"),
              )).limit(1)
            : [];

          if (action.employeeType && !employee[0]) {
            throw new Error(`No active ${action.employeeType} employee found.`);
          }

          await db.update(conversations).set({
            assignedEmployeeId: employee[0]?.id || null,
            updatedAt: new Date(),
          }).where(and(
            eq(conversations.id, data.conversationId),
            eq(conversations.businessId, businessId),
          ));

          const routing = await db.select({ id: conversationRouting.id }).from(conversationRouting).where(eq(
            conversationRouting.conversationId,
            data.conversationId,
          )).limit(1);

          if (routing[0]) {
            await db.update(conversationRouting).set({
              aiEmployeeId: employee[0]?.id || null,
              assignedUserId: action.userId || null,
              assignmentType: action.userId ? "user" : "ai",
              status: action.userId ? "human_handling" : "ai_handling",
              updatedAt: new Date(),
            }).where(eq(conversationRouting.id, routing[0].id));
          }
        }

        else if (action.type === "notify_team_member") {
          throw new Error("notify_team_member is not available until a notification service is configured.");
        }

        else if (action.type === "escalate_to_human") {
          if (typeof data.conversationId !== "string") {
            throw new Error("escalate_to_human requires conversationId.");
          }

          await db.insert(handoffs).values({
            id: crypto.randomUUID(),
            businessId,
            conversationId: data.conversationId,
            fromEmployeeId: typeof data.employeeId === "string" ? data.employeeId : null,
            toUserId: null,
            reason: action.reason || "Escalated by automation.",
            status: "pending",
            createdAt: new Date(),
            updatedAt: new Date(),
          });

          await db.update(conversations).set({
            status: "escalated",
            updatedAt: new Date(),
          }).where(and(
            eq(conversations.id, data.conversationId),
            eq(conversations.businessId, businessId),
          ));
        }

        else if (action.type === "run_ai_employee") {
          const employee = await db.select({
            id: aiEmployees.id,
            type: aiEmployees.type,
          }).from(aiEmployees).where(and(
            eq(aiEmployees.businessId, businessId),
            eq(aiEmployees.type, action.employeeType),
            eq(aiEmployees.status, "active"),
          )).limit(1);

          if (!employee[0]) throw new Error(`No active ${action.employeeType} employee found.`);

          const prompt = action.message || String(data.message || "Review the current business event.");
          const agent = employee[0].type === "sales"
            ? kubaSalesAgent
            : employee[0].type === "customer-support"
              ? kubaCustomerSupportAgent
              : employee[0].type === "receptionist"
                ? kubaReceptionistAgent
                : null;

          if (!agent) throw new Error(`No runtime is available for ${action.employeeType}.`);
          await agent.generate(prompt, {
            memory: {
              resource: businessId,
              thread: `automation-${automation.id}`,
            },
            requestContext: new RequestContext([["businessId", businessId]]),
          });
        }

        else if (action.type === "create_follow_up") {
          if (typeof data.leadId !== "string") {
            throw new Error(
              "create_follow_up requires leadId.",
            );
          }

          const dueAt = new Date(
            Date.now() +
              Math.max(
                0,
                action.delayMinutes,
              ) *
                60 *
                1000,
          );

          await db.insert(followUps).values({
            id: crypto.randomUUID(),

            businessId,

            leadId: data.leadId,

            assignedEmployeeId:
              typeof data.employeeId === "string"
                ? data.employeeId
                : null,

            title: action.title,

            description:
              action.description || null,

            dueAt,

            status: "pending",

            createdAt: new Date(),

            updatedAt: new Date(),
          });
        }

        else if (action.type === "create_task") {
          const delayMinutes = Math.max(
            0,
            Number(action.delayMinutes || 0),
          );

          const dueAt = new Date(
            Date.now() +
              delayMinutes *
                60 *
                1000,
          );

          let assignedEmployeeId:
            string | null = null;

          if (action.assignToEmployeeType) {
            const employee = await db
              .select({
                id: aiEmployees.id,
              })
              .from(aiEmployees)
              .where(
                and(
                  eq(
                    aiEmployees.businessId,
                    businessId,
                  ),
                  eq(
                    aiEmployees.type,
                    action.assignToEmployeeType,
                  ),
                  eq(
                    aiEmployees.status,
                    "active",
                  ),
                ),
              )
              .limit(1);

            if (!employee[0]) {
              throw new Error(
                `No active ${action.assignToEmployeeType} employee found.`,
              );
            }

            assignedEmployeeId =
              employee[0].id;
          }

          await db.insert(tasks).values({
            id: crypto.randomUUID(),

            businessId,

            title: action.title,

            description:
              action.description || null,

            status: "pending",

            priority:
              action.priority || "normal",

            assignedUserId: null,

            assignedEmployeeId,

            leadId:
              typeof data.leadId === "string"
                ? data.leadId
                : null,

            customerId:
              typeof data.customerId === "string"
                ? data.customerId
                : null,

            automationId:
              automation.id,

            dueAt,

            completedAt: null,

            createdAt: new Date(),

            updatedAt: new Date(),
          });
        }
      }

      await db
        .update(automationRuns)
        .set({
          status: "completed",
          completedAt: new Date(),
        })
        .where(
          eq(
            automationRuns.id,
            runId,
          ),
        );

      results.push({
        automationId: automation.id,
        runId,
        status: "completed",
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Automation failed.";

      await db
        .update(automationRuns)
        .set({
          status: "failed",
          error: message,
          completedAt: new Date(),
        })
        .where(
          eq(
            automationRuns.id,
            runId,
          ),
        );

      results.push({
        automationId: automation.id,
        runId,
        status: "failed",
        error: message,
      });
    }
  }

  return {
    trigger,
    matched: activeAutomations.length,
    results,
  };
}
