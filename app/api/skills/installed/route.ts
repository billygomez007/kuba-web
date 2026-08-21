import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import {
  skills,
  employeeSkills,
  aiEmployees,
} from "@/db/schema";

import {
  requireBusinessMembership,
} from "@/lib/auth/tenant";


export async function GET() {

  try {

    const {
      membership,
    } = await requireBusinessMembership();


    if (!membership) {
      return NextResponse.json(
        {
          error:
            "Unauthorized",
        },
        {
          status:401,
        },
      );
    }


    const result =
      await db
        .select({
          skillId:
            skills.id,

          skillName:
            skills.name,

          category:
            skills.category,

          employeeId:
            aiEmployees.id,

          employeeName:
            aiEmployees.name,
        })
        .from(employeeSkills)
        .innerJoin(
          skills,
          eq(
            employeeSkills.skillId,
            skills.id,
          ),
        )
        .innerJoin(
          aiEmployees,
          eq(
            employeeSkills.employeeId,
            aiEmployees.id,
          ),
        )
        .where(
          eq(
            aiEmployees.businessId,
            membership.businessId,
          ),
        );


    return NextResponse.json({
      installedSkills:
        result,
    });


  } catch(error) {

    console.error(
      "Installed skills error:",
      error,
    );


    return NextResponse.json(
      {
        error:
          "Unable to load installed skills.",
      },
      {
        status:500,
      },
    );
  }
}
