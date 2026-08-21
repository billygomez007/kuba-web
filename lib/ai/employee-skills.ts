import { eq } from "drizzle-orm";

import { db } from "@/db";
import {
  employeeSkills,
  skills,
} from "@/db/schema";


export async function getEmployeeSkills(
  employeeId: string,
) {

  const result =
    await db
      .select({
        name: skills.name,
        description: skills.description,
        category: skills.category,
        instructions: skills.instructions,
        tools: skills.tools,
      })
      .from(employeeSkills)
      .innerJoin(
        skills,
        eq(
          employeeSkills.skillId,
          skills.id,
        ),
      )
      .where(
        eq(
          employeeSkills.employeeId,
          employeeId,
        ),
      );


  return result;
}
