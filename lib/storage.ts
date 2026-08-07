export interface StoredLine {
  id: string;
  text: string;
  createdAt: number;
}

export const LINES_KEY = "ventilation:lines";
export const DRAFT_KEY = "ventilation:draft";
