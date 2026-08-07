import nlp from "compromise";
import Sentiment from "sentiment";

export type PosCategory =
  | "noun"
  | "verb"
  | "adjective"
  | "adverb"
  | "value"
  | "date"
  | "pronoun"
  | "determiner"
  | "conjunction"
  | "preposition"
  | "expression"
  | "contact"
  | "other";

export interface PosToken {
  text: string;
  post: string;
  category: PosCategory;
}

export interface PosCount {
  category: PosCategory;
  count: number;
}

export interface CountItem {
  value: string;
  count: number;
}

export interface ValueItem {
  text: string;
  num: string;
  kind: "number" | "money" | "percent";
}

export interface Stats {
  chars: number;
  words: number;
  uniqueWords: number;
  sentences: number;
  avgWordsPerSentence: number;
  readingTimeSec: number;
  longestWord: string;
}

export interface SentimentResult {
  score: number;
  comparative: number;
  label: "Positive" | "Negative" | "Neutral";
  positive: string[];
  negative: string[];
}

export interface Analysis {
  stats: Stats;
  posTokens: PosToken[];
  posCounts: PosCount[];
  people: CountItem[];
  places: CountItem[];
  organizations: CountItem[];
  urls: string[];
  emails: string[];
  phones: string[];
  hashtags: string[];
  topics: CountItem[];
  values: ValueItem[];
  dates: string[];
  nouns: string[];
  verbs: string[];
  sentiment: SentimentResult;
}

const MAX_LENGTH = 20000;

const sentimentAnalyzer = new Sentiment();

const CATEGORY_TAGS: [PosCategory, string[]][] = [
  ["expression", ["Expression", "QuestionWord", "Condition", "There"]],
  ["contact", ["Url", "Email", "HashTag", "PhoneNumber", "AtMention", "Emoji", "Emoticon"]],
  ["verb", ["Verb"]],
  ["adjective", ["Adjective"]],
  ["adverb", ["Adverb"]],
  ["value", ["Value"]],
  ["date", ["Date"]],
  ["pronoun", ["Pronoun", "Reflexive"]],
  ["determiner", ["Determiner"]],
  ["conjunction", ["Conjunction"]],
  ["preposition", ["Preposition"]],
  ["noun", ["Noun"]],
];

function classify(tags: string[]): PosCategory {
  for (const [category, candidates] of CATEGORY_TAGS) {
    for (const tag of candidates) {
      if (tags.includes(tag)) return category;
    }
  }
  return "other";
}

function clean(word: string): string {
  return word
    .replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isCleanWord(word: string): boolean {
  return /^[\p{L}\p{N}\s'-]+$/u.test(word) && word.trim().length > 0;
}

function countIn(text: string, phrase: string): number {
  if (!phrase) return 0;
  const lower = text.toLowerCase();
  const needle = phrase.toLowerCase();
  let count = 0;
  let idx = 0;
  while ((idx = lower.indexOf(needle, idx)) !== -1) {
    count += 1;
    idx += needle.length;
  }
  return count;
}

function toCountItems(text: string, names: string[]): CountItem[] {
  const seen = new Set<string>();
  const items: CountItem[] = [];
  for (const raw of names) {
    const value = clean(raw);
    if (!value || seen.has(value.toLowerCase())) continue;
    seen.add(value.toLowerCase());
    items.push({ value, count: countIn(text, value) });
  }
  return items;
}

function buildPos(
  doc: ReturnType<typeof nlp>,
): { posTokens: PosToken[]; posCounts: PosCount[]; longestWord: string } {
  const posTokens: PosToken[] = [];
  const posMap = new Map<PosCategory, number>();
  const pushPos = (category: PosCategory) =>
    posMap.set(category, (posMap.get(category) ?? 0) + 1);

  const tokenJson = doc.terms().json() as {
    terms: { text: string; post: string; tags: string[] }[];
  }[];

  let longestWord = "";
  for (const phrase of tokenJson) {
    for (const term of phrase.terms) {
      const category = classify(term.tags);
      posTokens.push({ text: term.text, post: term.post, category });
      pushPos(category);
      if (term.text.length > longestWord.length) longestWord = term.text;
    }
  }

  const posCounts: PosCount[] = Array.from(posMap.entries())
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count);

  return { posTokens, posCounts, longestWord };
}

export function tagTokens(
  rawText: string,
): { posTokens: PosToken[]; posCounts: PosCount[] } | null {
  const text = rawText.trim();
  if (!text) return null;
  const { posTokens, posCounts } = buildPos(nlp(text));
  return { posTokens: posTokens.slice(0, 600), posCounts };
}

export function analyze(rawText: string): Analysis | null {
  const text = rawText.trim();
  if (!text) return null;

  const doc = nlp(text);
  const words = doc.wordCount();
  const sentences = doc.sentences().length;

  const { posTokens, posCounts, longestWord } = buildPos(doc);

  const uniqueWords = doc.terms().unique().wordCount();
  const avgWordsPerSentence =
    sentences > 0 ? Math.round((words / sentences) * 10) / 10 : 0;
  const readingTimeSec = Math.max(1, Math.round((words / 200) * 60));

  const people = toCountItems(text, doc.people().unique().out("array"));
  const places = toCountItems(text, doc.places().unique().out("array"));
  const organizations = toCountItems(text, doc.organizations().unique().out("array"));

  const cleanList = (view: ReturnType<typeof doc.terms>) =>
    view.unique().out("array").map(clean).filter(Boolean);

  const urls = cleanList(doc.urls());
  const emails = cleanList(doc.emails());
  const phones = cleanList(doc.phoneNumbers());
  const hashtags = cleanList(doc.hashTags());

  const topics = (doc.topics().out("topk") as { normal: string; count: number }[])
    .map((t) => ({ value: clean(t.normal), count: t.count }))
    .filter((t) => t.value)
    .slice(0, 12);

  const values: ValueItem[] = [];
  const seenValues = new Set<string>();
  const numberJson = doc.numbers().json({
    terms: { normal: true, tags: true },
  }) as { text: string; terms: { tags: string[] }[]; number: { num?: number } }[];
  for (const entry of numberJson) {
    const text = clean(entry.text);
    if (!text || seenValues.has(text)) continue;
    seenValues.add(text);
    const tags = entry.terms?.[0]?.tags ?? [];
    const kind: ValueItem["kind"] = tags.includes("Money")
      ? "money"
      : tags.includes("Percent")
        ? "percent"
        : "number";
    const num = entry.number?.num;
    values.push({
      text,
      num: num !== undefined ? num.toLocaleString() : "",
      kind,
    });
  }

  const dates = doc
    .match("#Date")
    .unique()
    .out("array")
    .map(clean)
    .filter(Boolean);

  const wordList = (view: ReturnType<typeof doc.terms>, max = 12) => {
    const words: string[] = view.unique().out("array").map(clean);
    return words
      .filter(isCleanWord)
      .filter((w, i, arr) => arr.indexOf(w) === i)
      .slice(0, max);
  };

  const nouns = wordList(doc.nouns());
  const verbs = wordList(doc.verbs());

  const result = sentimentAnalyzer.analyze(text);
  const score = result.score;
  const label: SentimentResult["label"] =
    score > 0 ? "Positive" : score < 0 ? "Negative" : "Neutral";

  return {
    stats: {
      chars: text.length,
      words,
      uniqueWords,
      sentences,
      avgWordsPerSentence,
      readingTimeSec,
      longestWord,
    },
    posTokens: posTokens.slice(0, 600),
    posCounts,
    people,
    places,
    organizations,
    urls,
    emails,
    phones,
    hashtags,
    topics,
    values,
    dates,
    nouns,
    verbs,
    sentiment: {
      score,
      comparative: Math.round(result.comparative * 100) / 100,
      label,
      positive: result.positive ?? [],
      negative: result.negative ?? [],
    },
  };
}

export interface Transform {
  name: string;
  description: string;
  apply: (text: string) => string;
}

export const TRANSFORMS: Transform[] = [
  {
    name: "Past tense",
    description: "Convert to past tense",
    apply: (t) => nlp(t).sentences().toPastTense().text(),
  },
  {
    name: "Present tense",
    description: "Convert to present tense",
    apply: (t) => nlp(t).sentences().toPresentTense().text(),
  },
  {
    name: "Future tense",
    description: "Convert to future tense",
    apply: (t) => nlp(t).sentences().toFutureTense().text(),
  },
  {
    name: "Negate",
    description: "Make sentences negative",
    apply: (t) => nlp(t).sentences().toNegative().text(),
  },
  {
    name: "Remove negation",
    description: "Make sentences positive",
    apply: (t) => nlp(t).sentences().toPositive().text(),
  },
  {
    name: "Expand contractions",
    description: "it's -> it is",
    apply: (t) => {
      const d = nlp(t);
      d.contractions().expand();
      return d.text();
    },
  },
  {
    name: "Contract",
    description: "it is -> it's",
    apply: (t) => {
      const d = nlp(t);
      d.contract();
      return d.text();
    },
  },
  {
    name: "Title case",
    description: "Transform to title case",
    apply: (t) => nlp(t).toTitleCase().text(),
  },
  {
    name: "UPPERCASE",
    description: "Transform to uppercase",
    apply: (t) => nlp(t).toUpperCase().text(),
  },
  {
    name: "Redact names",
    description: "Hide people, places and orgs",
    apply: (t) => nlp(t).redact().text(),
  },
];

export const MAX_INPUT_LENGTH = MAX_LENGTH;

export const SAMPLE_TEXT =
  "Alice Johnson recently joined the team at Tesla in Berlin, Germany. " +
  "She absolutely loves the fast-paced startup culture, but the daily commute " +
  "through the city can be quite frustrating. Sales jumped 40% in Q2 last year " +
  "to 1.2 million units, and the company plans to invest $5 million into a new " +
  "factory by Monday. You can reach her at alice@tesla.com or visit " +
  "https://tesla.com for more info. Honestly, it wasn't a bad week at all.";
