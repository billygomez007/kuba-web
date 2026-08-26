/**
 * Canonical, pure formatting utilities. All monetary/date/number display in
 * the app should go through these instead of manual string concatenation or
 * ad hoc Intl calls, so currency/timezone/locale semantics stay consistent.
 *
 * Currency FORMATTING only — never converts between currencies.
 */
import { DEFAULT_LOCALIZATION, type CurrencyCode } from "./registry";

export function formatCurrency(amount: number, currencyCode: CurrencyCode | string, locale: string = DEFAULT_LOCALIZATION.locale): string {
  return new Intl.NumberFormat(locale, { style: "currency", currency: currencyCode }).format(amount);
}

export function formatNumber(value: number, locale: string = DEFAULT_LOCALIZATION.locale, options?: Intl.NumberFormatOptions): string {
  return new Intl.NumberFormat(locale, options).format(value);
}

export function formatPercent(value: number, locale: string = DEFAULT_LOCALIZATION.locale, options?: Intl.NumberFormatOptions): string {
  return new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 1, ...options }).format(value);
}

export function formatDate(date: Date, timeZone: string, locale: string = DEFAULT_LOCALIZATION.locale): string {
  return new Intl.DateTimeFormat(locale, { timeZone, year: "numeric", month: "short", day: "numeric" }).format(date);
}

export function formatTime(date: Date, timeZone: string, locale: string = DEFAULT_LOCALIZATION.locale): string {
  return new Intl.DateTimeFormat(locale, { timeZone, hour: "numeric", minute: "2-digit" }).format(date);
}

export function formatDateTime(date: Date, timeZone: string, locale: string = DEFAULT_LOCALIZATION.locale): string {
  return new Intl.DateTimeFormat(locale, { timeZone, year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(date);
}

/**
 * The timezone's offset from UTC, in minutes, AT the given instant
 * (DST-correct — recomputed per instant, never a fixed GMT+N constant).
 */
export function getTimeZoneOffsetMinutes(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  }).formatToParts(date).reduce<Record<string, string>>((acc, part) => {
    if (part.type !== "literal") acc[part.type] = part.value;
    return acc;
  }, {});
  const asUTC = Date.UTC(
    Number(parts.year), Number(parts.month) - 1, Number(parts.day),
    Number(parts.hour), Number(parts.minute), Number(parts.second),
  );
  return (asUTC - date.getTime()) / 60000;
}

function localDateParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" })
    .formatToParts(date).reduce<Record<string, string>>((acc, part) => {
      if (part.type !== "literal") acc[part.type] = part.value;
      return acc;
    }, {});
  return { year: Number(parts.year), month: Number(parts.month), day: Number(parts.day) };
}

/** The UTC instant of local midnight (00:00:00) for the given Y/M/D in timeZone, DST-safe via a two-pass offset refinement. */
function localMidnightUtc(year: number, month: number, day: number, timeZone: string): Date {
  const naiveGuess = Date.UTC(year, month - 1, day, 0, 0, 0);
  const offset1 = getTimeZoneOffsetMinutes(new Date(naiveGuess), timeZone);
  const refined = naiveGuess - offset1 * 60000;
  const offset2 = getTimeZoneOffsetMinutes(new Date(refined), timeZone);
  return new Date(naiveGuess - offset2 * 60000);
}

/**
 * The UTC instants bounding "today" as experienced in timeZone — used for
 * business-day-aware analytics/reporting ("today", "this week") instead of
 * blindly using server UTC midnight.
 */
export function getBusinessDayBounds(timeZone: string, referenceDate: Date = new Date()): { start: Date; end: Date } {
  const today = localDateParts(referenceDate, timeZone);
  const start = localMidnightUtc(today.year, today.month, today.day, timeZone);
  // Pure calendar arithmetic for "tomorrow's" Y/M/D (Date.UTC correctly
  // normalizes day overflow, e.g. day 32 of January -> Feb 1) — deliberately
  // NOT instant arithmetic (start + N hours), since start is already exactly
  // local midnight and no fixed hour offset reliably lands on the next
  // calendar day across both 23-hour and 25-hour DST-transition days.
  const nextDay = new Date(Date.UTC(today.year, today.month - 1, today.day + 1));
  const end = localMidnightUtc(nextDay.getUTCFullYear(), nextDay.getUTCMonth() + 1, nextDay.getUTCDate(), timeZone);
  return { start, end };
}

export function getBusinessWeekBounds(timeZone: string, referenceDate: Date = new Date()): { start: Date; end: Date } {
  const { start: todayStart } = getBusinessDayBounds(timeZone, referenceDate);
  const weekday = new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short" }).format(todayStart);
  const weekdayIndex = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(weekday);
  const daysSinceMonday = weekdayIndex === 0 ? 6 : weekdayIndex - 1;
  const mondayReference = new Date(todayStart.getTime() - daysSinceMonday * 24 * 60 * 60 * 1000);
  const { start } = getBusinessDayBounds(timeZone, mondayReference);
  const { end } = getBusinessDayBounds(timeZone, new Date(start.getTime() + 6 * 24 * 60 * 60 * 1000));
  return { start, end };
}

export function getBusinessMonthBounds(timeZone: string, referenceDate: Date = new Date()): { start: Date; end: Date } {
  const today = localDateParts(referenceDate, timeZone);
  const start = localMidnightUtc(today.year, today.month, 1, timeZone);
  const nextMonth = today.month === 12 ? { y: today.year + 1, m: 1 } : { y: today.year, m: today.month + 1 };
  const end = localMidnightUtc(nextMonth.y, nextMonth.m, 1, timeZone);
  return { start, end };
}
