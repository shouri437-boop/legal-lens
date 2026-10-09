import { format, formatDistanceToNow, parseISO } from "date-fns";

export function formatTimelineDate(
  date: string | Date,
  formatString?: string,
): string {
  const dateObj = typeof date === "string" ? parseISO(date) : date;
  return format(dateObj, formatString || "MMM d, yyyy");
}

/**
 * Timeline events hold the date and time written in the document, stored as UTC.
 * Show them as stored (not shifted into the browser's timezone) by building a local
 * Date with the same wall-clock fields.
 */
export function utcWallClock(value: string | Date): Date {
  const d = typeof value === "string" ? new Date(value) : value;
  return new Date(
    d.getUTCFullYear(),
    d.getUTCMonth(),
    d.getUTCDate(),
    d.getUTCHours(),
    d.getUTCMinutes(),
  );
}

export function formatEventDate(value: string | Date, formatString: string) {
  return format(utcWallClock(value), formatString);
}

/** "h:mm a", or null when the document gave only a date (stored as midnight). */
export function formatEventClock(value: string | Date): string | null {
  const d = typeof value === "string" ? new Date(value) : value;
  if (d.getUTCHours() === 0 && d.getUTCMinutes() === 0) return null;
  return format(utcWallClock(d), "h:mm a");
}

export function formatTimelineTime(date: string | Date): string {
  const dateObj = typeof date === "string" ? parseISO(date) : date;
  return format(dateObj, "h:mm a");
}

export function formatTimelineDateTime(date: string | Date): string {
  const dateObj = typeof date === "string" ? parseISO(date) : date;
  return format(dateObj, "MMM d, yyyy h:mm a");
}

export function formatRelativeTime(date: string | Date): string {
  const dateObj = typeof date === "string" ? parseISO(date) : date;
  return formatDistanceToNow(dateObj, { addSuffix: true });
}

export function getDateRangeLabel(startDate: string, endDate: string): string {
  const start = parseISO(startDate);
  const end = parseISO(endDate);

  if (start.getFullYear() === end.getFullYear()) {
    if (start.getMonth() === end.getMonth()) {
      return `${format(start, "MMM d")} - ${format(end, "d, yyyy")}`;
    }
    return `${format(start, "MMM d")} - ${format(end, "MMM d, yyyy")}`;
  }

  return `${format(start, "MMM d, yyyy")} - ${format(end, "MMM d, yyyy")}`;
}
