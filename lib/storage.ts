export interface StoredLine {
  id: string;
  text: string;
  createdAt: number;
}

export const LINES_KEY = "ventilation:lines";
export const DRAFT_KEY = "ventilation:draft";

const timeFormat = new Intl.DateTimeFormat(undefined, { timeStyle: "short" });
const dayFormat = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
});

/**
 * Formats a line's entry timestamp as a local time (e.g. "2:07 PM"),
 * prefixed with the date when the line was not entered today
 * (e.g. "Aug 11 · 2:07 PM"). Returns null for missing/invalid timestamps.
 */
export function formatLineTimestamp(createdAt: number): string | null {
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) return null;
  const sameDay = date.toDateString() === new Date().toDateString();
  return sameDay
    ? timeFormat.format(date)
    : `${dayFormat.format(date)} · ${timeFormat.format(date)}`;
}
