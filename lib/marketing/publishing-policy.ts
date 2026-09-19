/** Accept ISO dates/timestamps only, including a real calendar day (no rollover). */
export function parseMarketingDate(value: unknown): Date | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2}))?$/.test(value)) return null;
  if (value.length > 10) {
    const [hour, minute, second = "0"] = value.slice(11).split(/[.:Z+-]/);
    if (Number(hour) > 23 || Number(minute) > 59 || Number(second) > 59) return null;
  }
  const day = value.slice(0, 10);
  const calendarDay = new Date(`${day}T00:00:00Z`);
  if (!Number.isFinite(calendarDay.getTime()) || calendarDay.toISOString().slice(0, 10) !== day) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

export function marketingCalendarRange(from: string | null, to: string | null) {
  const start = from === null ? new Date(0) : parseMarketingDate(from);
  const end = to === null ? new Date("2100-01-01T00:00:00Z") : parseMarketingDate(to);
  // Date-only end filters include the whole UTC day.
  if (end && to?.length === 10) end.setUTCHours(23, 59, 59, 999);
  return start && end && start <= end ? { from: start, to: end } : null;
}
