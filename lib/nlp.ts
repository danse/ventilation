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

  const { longestWord } = buildPos(doc);

  const uniqueWords = doc.terms().unique().wordCount();
  const avgWordsPerSentence =
    sentences > 0 ? Math.round((words / sentences) * 10) / 10 : 0;
  const readingTimeSec = Math.max(1, Math.round((words / 200) * 60));

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
    sentiment: {
      score,
      comparative: Math.round(result.comparative * 100) / 100,
      label,
      positive: result.positive ?? [],
      negative: result.negative ?? [],
    },
  };
}

export const MAX_INPUT_LENGTH = MAX_LENGTH;

export const SAMPLE_TEXT =
  "Alice Johnson recently joined the team at Tesla in Berlin, Germany. " +
  "She absolutely loves the fast-paced startup culture, but the daily commute " +
  "through the city can be quite frustrating. Sales jumped 40% in Q2 last year " +
  "to 1.2 million units, and the company plans to invest $5 million into a new " +
  "factory by Monday. You can reach her at alice@tesla.com or visit " +
  "https://tesla.com for more info. Honestly, it wasn't a bad week at all.";
