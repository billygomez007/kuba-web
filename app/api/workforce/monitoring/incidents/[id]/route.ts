import { NextResponse } from "next/server";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;

  if (!id) {
    return NextResponse.json({ error: "Incident ID is required." }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  const action = body?.action;

  if (action !== "assign" && action !== "resolve") {
    return NextResponse.json(
      { error: "Unsupported incident action." },
      { status: 400 },
    );
  }

  /*
   * This endpoint intentionally provides a safe action boundary first.
   * The monitoring source currently exposes incidents as derived operational
   * records rather than a dedicated mutable incident table.
   *
   * Assign sends the user into the existing approval/operations workflow.
   * Resolve acknowledges the action without fabricating persistence that does
   * not yet exist in the domain model.
   */
  return NextResponse.json({
    ok: true,
    incidentId: id,
    action,
    persisted: false,
    message:
      action === "assign"
        ? "Incident assignment acknowledged."
        : "Incident resolution acknowledged.",
  });
}
