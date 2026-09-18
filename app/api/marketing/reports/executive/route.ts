import { NextResponse } from "next/server";

import { getMarketingExecutiveReport } from "@/lib/marketing/executive-reporting";
import { requireMarketingAccess } from "@/lib/marketing/context";

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;
const DATE_TIME =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?(Z|[+-]\d{2}:\d{2})$/;

function validCalendarDate(
  year: number,
  month: number,
  day: number,
) {
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function parseStrictDate(value: string | null) {
  if (value === null) return { ok: true as const, date: null };

  const dateOnly = DATE_ONLY.exec(value);

  if (dateOnly) {
    const year = Number(dateOnly[1]);
    const month = Number(dateOnly[2]);
    const day = Number(dateOnly[3]);

    if (!validCalendarDate(year, month, day)) {
      return { ok: false as const, date: null };
    }

    return {
      ok: true as const,
      date: new Date(Date.UTC(year, month - 1, day)),
    };
  }

  const dateTime = DATE_TIME.exec(value);

  if (!dateTime) {
    return { ok: false as const, date: null };
  }

  const year = Number(dateTime[1]);
  const month = Number(dateTime[2]);
  const day = Number(dateTime[3]);
  const hour = Number(dateTime[4]);
  const minute = Number(dateTime[5]);
  const second = Number(dateTime[6]);

  if (
    !validCalendarDate(year, month, day) ||
    hour > 23 ||
    minute > 59 ||
    second > 59
  ) {
    return { ok: false as const, date: null };
  }

  const timezone = dateTime[8];

  if (timezone !== "Z") {
    const timezoneHour = Number(timezone.slice(1, 3));
    const timezoneMinute = Number(timezone.slice(4, 6));

    if (timezoneHour > 23 || timezoneMinute > 59) {
      return { ok: false as const, date: null };
    }
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return { ok: false as const, date: null };
  }

  return { ok: true as const, date };
}

function endOfDateOnly(value: string | null, date: Date | null) {
  if (!value || !date || !DATE_ONLY.test(value)) return date;

  return new Date(date.getTime() + 86_400_000 - 1);
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

  const parsedFrom = parseStrictDate(fromRaw);
  const parsedTo = parseStrictDate(toRaw);

  if (!parsedFrom.ok) {
    return NextResponse.json(
      { error: "Invalid report from date." },
      { status: 400 },
    );
  }

  if (!parsedTo.ok) {
    return NextResponse.json(
      { error: "Invalid report to date." },
      { status: 400 },
    );
  }

  const from = parsedFrom.date;
  const to = endOfDateOnly(toRaw, parsedTo.date);

  if (from && to && from > to) {
    return NextResponse.json(
      { error: "Report from date must be on or before to date." },
      { status: 400 },
    );
  }

  const report = await getMarketingExecutiveReport(
    access.businessId,
    { from, to },
  );

  return NextResponse.json(report);
}
