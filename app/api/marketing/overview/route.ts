import { NextResponse } from "next/server";
import { requireMarketingAccess } from "@/lib/marketing/context";
import { getMarketingOverview } from "@/lib/marketing/overview";

export async function GET() {
  const access = await requireMarketingAccess("view");
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  const overview = await getMarketingOverview(access.businessId);
  return NextResponse.json({ overview });
}
