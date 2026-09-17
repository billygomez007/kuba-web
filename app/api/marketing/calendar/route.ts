import { NextResponse } from "next/server";
import { requireMarketingAccess } from "@/lib/marketing/context";
import { getMarketingCalendar } from "@/lib/marketing/publishing-operations";
import { marketingCalendarRange } from "@/lib/marketing/publishing-policy";

export async function GET(request: Request) {
  const access = await requireMarketingAccess("view");
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  const url = new URL(request.url);
  const range = marketingCalendarRange(url.searchParams.get("from"), url.searchParams.get("to"));
  if (!range) return NextResponse.json({ error: "Invalid calendar range. Use ISO dates with from on or before to." }, { status: 400 });
  const calendar = await getMarketingCalendar(access.businessId, range.from, range.to);
  return NextResponse.json({ ...calendar, from: range.from, to: range.to });
}
