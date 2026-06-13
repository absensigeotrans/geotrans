/**
 * Timezone utility for consistent date handling across the application.
 * All dates are normalized to Asia/Jakarta (WIB, UTC+7) timezone.
 */

const TIMEZONE = 'Asia/Jakarta';

/**
 * Get current date string in YYYY-MM-DD format in WIB timezone.
 * Use this instead of new Date().toISOString().split('T')[0]
 */
export function getWIBDate(): string {
  const now = new Date();
  return now.toLocaleDateString('en-CA', { timeZone: TIMEZONE });
}

/**
 * Get start of day in WIB as ISO string for database queries.
 * WIB 00:00:00 = UTC (day-1) 17:00:00
 */
export function getWIBStartOfDay(date?: Date): string {
  const d = date || new Date();
  const dateStr = d.toLocaleDateString('en-CA', { timeZone: TIMEZONE });
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day - 1, 17, 0, 0, 0)).toISOString();
}

/**
 * Get end of day in WIB as ISO string for database queries.
 * WIB 23:59:59 = UTC same day 16:59:59
 */
export function getWIBEndOfDay(date?: Date): string {
  const d = date || new Date();
  const dateStr = d.toLocaleDateString('en-CA', { timeZone: TIMEZONE });
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day, 16, 59, 59, 999)).toISOString();
}

/**
 * Convert a WIB date string (YYYY-MM-DD) to UTC ISO boundaries.
 * Returns { start: UTC ISO of WIB 00:00, end: UTC ISO of WIB 23:59:59 }
 */
export function getWIBDateRange(dateStr: string): { start: string; end: string } {
  const [year, month, day] = dateStr.split('-').map(Number);
  return {
    start: new Date(Date.UTC(year, month - 1, day - 1, 17, 0, 0, 0)).toISOString(),
    end: new Date(Date.UTC(year, month - 1, day, 16, 59, 59, 999)).toISOString(),
  };
}

/**
 * Format a date/time string for display in WIB timezone.
 * Returns formatted time string like "08:30" or "14:15"
 */
export function formatWIBTime(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleTimeString('en-GB', {
    timeZone: TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

/**
 * Format a date for display in WIB timezone.
 * Returns formatted date string like "2026-05-21"
 */
export function formatWIBDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-CA', { timeZone: TIMEZONE });
}

/**
 * Get date N days ago in WIB.
 */
export function getWIBDaysAgo(days: number): string {
  const now = new Date();
  const pastDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  return pastDate.toLocaleDateString('en-CA', { timeZone: TIMEZONE });
}

/**
 * Format a date/time string with seconds in WIB timezone.
 * Returns formatted time string like "08:30:45"
 */
export function formatWIBTimeWithSeconds(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleTimeString('en-GB', {
    timeZone: TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

/**
 * Format a date for display like "21 May 2026" in WIB timezone.
 */
export function formatWIBDateDisplay(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-GB', {
    timeZone: TIMEZONE,
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

/**
 * Format a date for display like "21 May" in WIB timezone.
 */
export function formatWIBDateShort(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-GB', {
    timeZone: TIMEZONE,
    day: '2-digit',
    month: 'short',
  });
}

/**
 * Format current date for header display like "Senin, 26 May 2026" in WIB.
 * Uses the date string if provided, otherwise uses current WIB date.
 */
export function formatWIBDateHeader(dateString?: string): string {
  if (dateString) {
    const date = new Date(dateString);
    const dayName = date.toLocaleDateString('id-ID', { timeZone: TIMEZONE, weekday: 'long' });
    const formatted = date.toLocaleDateString('en-GB', { timeZone: TIMEZONE, day: '2-digit', month: 'long', year: 'numeric' });
    return `${dayName}, ${formatted}`;
  }
  const now = new Date();
  const dayName = now.toLocaleDateString('id-ID', { timeZone: TIMEZONE, weekday: 'long' });
  const formatted = now.toLocaleDateString('en-GB', { timeZone: TIMEZONE, day: '2-digit', month: 'long', year: 'numeric' });
  return `${dayName}, ${formatted}`;
}

/**
 * Format a month like "May 2026" in WIB timezone.
 */
export function formatWIBMonth(dateString?: string): string {
  if (dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', { timeZone: TIMEZONE, month: 'long', year: 'numeric' });
  }
  const now = new Date();
  return now.toLocaleDateString('en-GB', { timeZone: TIMEZONE, month: 'long', year: 'numeric' });
}

/**
 * Format a date for chart tick display like "21 May" in WIB.
 * The input is typically a date string from DB query results.
 */
export function formatWIBChartTick(d: string): string {
  const date = new Date(d);
  return date.toLocaleDateString('en-GB', {
    timeZone: TIMEZONE,
    day: '2-digit',
    month: 'short',
  });
}

/**
 * Format a date for chart label display like "21 May 2026" in WIB.
 */
export function formatWIBChartLabel(d: string): string {
  const date = new Date(d);
  return date.toLocaleDateString('en-GB', {
    timeZone: TIMEZONE,
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

/**
 * Get a Date object representing NOW in WIB timezone.
 * Used for week/month boundary calculations.
 */
export function getWIBDateObj(): Date {
  const dateStr = getWIBDate();
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
}
