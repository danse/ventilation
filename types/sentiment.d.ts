declare module "sentiment" {
  export interface SentimentResult {
    score: number;
    comparative: number;
    tokens: string[];
    words: string[];
    positive: string[];
    negative: string[];
  }

  export default class Sentiment {
    constructor(options?: object);
    analyze(phrase: string, opts?: object): SentimentResult;
  }
}
