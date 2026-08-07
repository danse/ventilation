import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { analyze, SAMPLE_TEXT, TRANSFORMS, MAX_INPUT_LENGTH, tagTokens } from "../lib/nlp.ts";

describe("analyze()", () => {
  const analysis = analyze(SAMPLE_TEXT);
  assert.ok(analysis, "analysis of sample text should not be null");

  it("extracts named entities", () => {
    assert.ok(analysis.people.some((p) => p.value === "Alice Johnson"));
    assert.ok(analysis.places.some((p) => p.value.startsWith("Berlin")));
  });

  it("detects sentiment and polar words", () => {
    assert.ok(analysis.sentiment.positive.some((w) => w.startsWith("love")));
    assert.ok(analysis.sentiment.negative.length > 0);
    assert.ok(["Positive", "Negative", "Neutral"].includes(analysis.sentiment.label));
    assert.equal(typeof analysis.sentiment.score, "number");
  });

  it("parses numbers, money and percentages", () => {
    assert.ok(analysis.values.some((v) => v.kind === "money"));
    assert.ok(analysis.values.some((v) => v.kind === "percent"));
    assert.ok(analysis.values.some((v) => v.kind === "number"));
  });

  it("extracts dates and times", () => {
    assert.ok(analysis.dates.length > 0);
  });

  it("computes basic stats", () => {
    assert.ok(analysis.stats.words > 0);
    assert.ok(analysis.stats.sentences >= 4);
    assert.equal(analysis.stats.chars, SAMPLE_TEXT.trim().length);
    assert.ok(analysis.stats.uniqueWords <= analysis.stats.words);
    assert.ok(analysis.stats.avgWordsPerSentence > 0);
  });

  it("produces part-of-speech tags", () => {
    assert.ok(analysis.posTokens.length > 0);
    assert.ok(analysis.posCounts.length > 0);
    const total = analysis.posCounts.reduce((sum, c) => sum + c.count, 0);
    assert.equal(total, analysis.posTokens.length);
  });

  it("extracts topics, nouns and verbs", () => {
    assert.ok(analysis.topics.length > 0);
    assert.ok(analysis.nouns.length > 0);
    assert.ok(analysis.verbs.length > 0);
  });

  it("finds contact info", () => {
    assert.ok(analysis.emails.some((e) => e.includes("@")));
    assert.ok(analysis.urls.some((u) => u.startsWith("https")));
  });

  it("returns null for empty or whitespace input", () => {
    assert.equal(analyze(""), null);
    assert.equal(analyze("   \n\t "), null);
  });
});

describe("TRANSFORMS", () => {
  it("all transforms produce string output without throwing", () => {
    for (const t of TRANSFORMS) {
      assert.doesNotThrow(() => {
        const out = t.apply(SAMPLE_TEXT);
        assert.equal(typeof out, "string");
      }, `${t.name} threw`);
    }
  });

  it("past tense actually rewrites verbs", () => {
    const past = TRANSFORMS.find((t) => t.name === "Past tense")!;
    const out = past.apply("She walks to work.");
    assert.ok(out.toLowerCase().includes("walked"));
  });

  it("negation rewrites the sentence", () => {
    const neg = TRANSFORMS.find((t) => t.name === "Negate")!;
    const out = neg.apply("She is happy.");
    assert.notEqual(out.toLowerCase(), "she is happy.");
  });

  it("expansion turns contractions into full words", () => {
    const expand = TRANSFORMS.find((t) => t.name === "Expand contractions")!;
    assert.equal(expand.apply("It's great!"), "It is great!");
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
