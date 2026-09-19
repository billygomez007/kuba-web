import { NextResponse } from "next/server";

import { getMarketingAnalyticsOperations } from "@/lib/marketing/analytics-operations";
import { requireMarketingAccess } from "@/lib/marketing/context";

function parseDateParam(value: string | null) {
  if (!value) return null;

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
}

export async function GET(request: Request) {
  const access = await requireMarketingAccess("view");

  if (!access.ok) {
    return NextResponse.json(
      { error: access.error },
      { status: access.status },
    );
  }

  const url = new URL(request.url);

  const fromRaw = url.searchParams.get("from");
  const toRaw = url.searchParams.get("to");

  const from = parseDateParam(fromRaw);
  const to = parseDateParam(toRaw);

  if (fromRaw && !from) {
    return NextResponse.json(
      { error: "Invalid analytics from date." },
      { status: 400 },
    );
  }

  if (toRaw && !to) {
    return NextResponse.json(
      { error: "Invalid analytics to date." },
      { status: 400 },
    );
  }

  if (from && to && from > to) {
    return NextResponse.json(
      { error: "Analytics from date must be on or before to date." },
      { status: 400 },
    );
  }

  const analytics = await getMarketingAnalyticsOperations(
    access.businessId,
    {
      from,
      to,
    },
  );

  return NextResponse.json({
    ...analytics,
    range: {
      from,
      to,
    },
  });
}
