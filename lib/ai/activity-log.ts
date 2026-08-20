import { db } from "@/db";
import {
  aiEmployeeActivities,
} from "@/db/schema";


export async function logAIActivity({

  businessId,
  employeeId,
  type,
  title,
  description,

}:{

  businessId:string;
  employeeId:string;
  type:string;
  title:string;
  description?:string;

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

      status:
        "completed",

      createdAt:
        new Date(),

    });

}
