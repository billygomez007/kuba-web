import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { aiEmployees, websiteWidgets } from "@/db/schema";
import { authorizationErrorResponse, requirePermission } from "@/lib/auth/authorization";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { readJsonObject, requiredString, validationErrorResponse } from "@/lib/api/validation";


export async function POST(request: Request) {
  try {
    const context = await requirePermission(PERMISSIONS.INTEGRATIONS_MANAGE, request);
    const body = await readJsonObject(request);


    const name =
      typeof body.name === "string" && body.name.trim()
        ? requiredString(body.name, "Name", 120)
        : "Kuba Website Assistant";


    const websiteUrl =
      typeof body.websiteUrl === "string" ? body.websiteUrl.trim() : "";


    const employeeId =
      typeof body.employeeId === "string" ? body.employeeId.trim() : "";

    if (websiteUrl && !URL.canParse(websiteUrl)) {
      return NextResponse.json({ error: "Website URL is invalid." }, { status: 400 });
    }

    if (employeeId) {
      const employee = (await db.select({ id: aiEmployees.id }).from(aiEmployees).where(and(eq(aiEmployees.id, employeeId), eq(aiEmployees.businessId, context.business.id))).limit(1))[0];
      if (!employee) return NextResponse.json({ error: "AI employee not found." }, { status: 404 });
    }


    const now = new Date();


    const widget = {
      id: crypto.randomUUID(),

      businessId:
        context.business.id,

      name,

      websiteUrl:
        websiteUrl || null,

      employeeId:
        employeeId || null,

      publicKey:
        `kuba_${crypto.randomUUID().replaceAll("-", "")}`,

      status:
        "active",

      welcomeMessage:
        "Hello 👋 How can Kuba help you today?",

      position:
        "bottom-right",

      createdAt:
        now,

      updatedAt:
        now,
    };


    await db
      .insert(websiteWidgets)
      .values(widget);


    return NextResponse.json({
      success: true,
      widget,
    });


  } catch (error) {

    const authorizationResponse = authorizationErrorResponse(error);
    if (authorizationResponse) return authorizationResponse;
    const validationResponse = validationErrorResponse(error);
    if (validationResponse) return validationResponse;

    console.error(
      "Create website widget error:",
      error,
    );


    return NextResponse.json(
      {
        error:
          "Unable to create website widget.",
      },
      {
        status: 500,
      },
    );
  }
}
