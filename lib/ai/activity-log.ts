import { db } from "@/db";
import {
  aiEmployeeActivities,
} from "@/db/schema";
import { runAutomationTrigger } from "@/lib/automations/engine";


export async function logAIActivity({

  businessId,
  employeeId,
  type,
  title,
  description,
  status = "completed",

}:{

  businessId:string;
  employeeId:string;
  type:string;
  title:string;
  description?:string;
  status?:string;

}){

  await db
    .insert(aiEmployeeActivities)
    .values({

      id:
        crypto.randomUUID(),

      businessId,

      employeeId,

      type,

      title,

      description:
        description || null,

      status,

      createdAt:
        new Date(),

    });

    if (status === "completed") {
      try {
        await runAutomationTrigger({
          businessId,
          trigger: "ai_employee.action_completed",
          data: {
            employeeId,
            type,
            title,
            description: description || null,
          },
        });
      } catch (automationError) {
        console.error("AI activity automation error:", automationError);
      }
    }

}
