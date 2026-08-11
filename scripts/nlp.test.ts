import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { analyze, SAMPLE_TEXT, MAX_INPUT_LENGTH, tagTokens } from "../lib/nlp.ts";
import { buildDocumentTitle, MAX_TITLE_LENGTH } from "../lib/storage.ts";

describe("analyze()", () => {
  const analysis = analyze(SAMPLE_TEXT);
  assert.ok(analysis, "analysis of sample text should not be null");

  it("detects sentiment and polar words", () => {
    assert.ok(analysis.sentiment.positive.some((w) => w.startsWith("love")));
    assert.ok(analysis.sentiment.negative.length > 0);
    assert.ok(["Positive", "Negative", "Neutral"].includes(analysis.sentiment.label));
    assert.equal(typeof analysis.sentiment.score, "number");
  });

  it("computes basic stats", () => {
    assert.ok(analysis.stats.words > 0);
    assert.ok(analysis.stats.sentences >= 4);
    assert.equal(analysis.stats.chars, SAMPLE_TEXT.trim().length);
    assert.ok(analysis.stats.uniqueWords <= analysis.stats.words);
    assert.ok(analysis.stats.avgWordsPerSentence > 0);
  });

  it("returns null for empty or whitespace input", () => {
    assert.equal(analyze(""), null);
    assert.equal(analyze("   \n\t "), null);
  });
});

describe("tagTokens()", () => {
  it("returns POS tokens without the full analysis", () => {
    const tagged = tagTokens("Alice runs quickly to the park.");
    assert.ok(tagged);
    assert.ok(tagged.posTokens.length > 0);
    assert.ok(tagged.posCounts.length > 0);
    const total = tagged.posCounts.reduce((sum, c) => sum + c.count, 0);
    assert.equal(total, tagged.posTokens.length);
    assert.ok(tagged.posCounts.some((c) => c.category === "verb"));
  });

  it("returns null for empty input", () => {
    assert.equal(tagTokens("  "), null);
  });
});

describe("MAX_INPUT_LENGTH", () => {
  it("is a positive finite number", () => {
    assert.ok(Number.isFinite(MAX_INPUT_LENGTH));
    assert.ok(MAX_INPUT_LENGTH > 0);
  });
});

describe("buildDocumentTitle()", () => {
  it("uses the first non-empty line, trimmed", () => {
    assert.equal(
      buildDocumentTitle("  First thought\n\nSecond thought"),
      "First thought",
    );
  });

  it("truncates long titles with an ellipsis", () => {
    const long = "a".repeat(MAX_TITLE_LENGTH + 20);
    const title = buildDocumentTitle(long);
    assert.ok(title.endsWith("…"));
    assert.ok(title.length <= MAX_TITLE_LENGTH + 1);
  });

  it("keeps short titles intact", () => {
    assert.equal(buildDocumentTitle("Short"), "Short");
  });

  it("falls back to empty string when there is no text", () => {
    assert.equal(buildDocumentTitle("   \n  "), "");
  });
});
