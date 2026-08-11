export interface StoredLine {
  id: string;
  text: string;
  createdAt: number;
}

export interface StoredDocument {
  id: string;
  title: string;
  createdAt: number;
  text: string;
}

export const LINES_KEY = "ventilation:lines";
export const DRAFT_KEY = "ventilation:draft";
export const DOCUMENTS_KEY = "ventilation:documents";

export const MAX_TITLE_LENGTH = 60;

/**
 * Derives a document title from its merged text: the first line, trimmed
 * and truncated to {@link MAX_TITLE_LENGTH} characters.
 */
export function buildDocumentTitle(text: string): string {
  const first = text.split("\n").map((s) => s.trim()).find(Boolean) ?? "";
  return first.length <= MAX_TITLE_LENGTH
    ? first
    : `${first.slice(0, MAX_TITLE_LENGTH).trimEnd()}…`;
}

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
