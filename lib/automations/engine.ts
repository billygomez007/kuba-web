import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import {
  automations,
  automationRuns,
  aiEmployees,
  followUps,
  leads,
  tasks,
} from "@/db/schema";


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
