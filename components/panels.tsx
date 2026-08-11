"use client";

import type { Analysis } from "@/lib/nlp";
import { Card, Chip, Stat } from "@/components/ui";

export function OverviewPanel({ analysis }: { analysis: Analysis }) {
  const { stats } = analysis;
  return (
    <Card title="Overview" subtitle="Document statistics" dot="bg-zinc-400" className="md:col-span-2">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        <Stat label="Words" value={stats.words} />
        <Stat label="Characters" value={stats.chars} />
        <Stat label="Unique words" value={stats.uniqueWords} />
        <Stat label="Sentences" value={stats.sentences} />
        <Stat label="Avg words / sentence" value={stats.avgWordsPerSentence} />
        <Stat label="Reading time" value={`${stats.readingTimeSec}s`} hint="at ~200 wpm" />
      </div>
      {stats.longestWord ? (
        <p className="mt-3 text-xs text-zinc-500">
          Longest token:{" "}
          <span className="font-medium text-zinc-300">{stats.longestWord}</span>
        </p>
      ) : null}
    </Card>
  );
}

const SENTIMENT_META = {
  Positive: { label: "Positive", text: "text-emerald-300", ring: "ring-emerald-500/40", chip: "emerald" as const },
  Negative: { label: "Negative", text: "text-rose-300", ring: "ring-rose-500/40", chip: "rose" as const },
  Neutral: { label: "Neutral", text: "text-zinc-300", ring: "ring-zinc-500/40", chip: "zinc" as const },
};

export function SentimentPanel({ analysis }: { analysis: Analysis }) {
  const { sentiment } = analysis;
  const meta = SENTIMENT_META[sentiment.label];
  const pct = Math.max(2, Math.min(98, ((sentiment.score + 5) / 10) * 100));

  return (
    <Card title="Sentiment" subtitle="AFINN lexicon · runs offline" dot="bg-emerald-400">
      <div className="flex items-end gap-3">
        <div className="text-4xl font-bold tabular-nums text-zinc-100">
          {sentiment.score}
        </div>
        <div className="pb-1">
          <span
            className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ring-1 ${meta.ring} ${meta.text}`}
          >
            {meta.label}
          </span>
          <div className="mt-1 text-xs text-zinc-500">
            comparative {sentiment.comparative}
          </div>
        </div>
      </div>

      <div className="relative mt-4 h-2 rounded-full bg-gradient-to-r from-rose-500/40 via-zinc-500/30 to-emerald-500/40">
        <span
          className="absolute -top-1 h-4 w-1.5 rounded-full bg-zinc-100 shadow"
          style={{ left: `${pct}%` }}
        />
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-zinc-600">
        <span>-5</span>
        <span>0</span>
        <span>+5</span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <div>
          <div className="mb-1.5 text-xs font-medium text-emerald-300">Positive words</div>
          <div className="flex flex-wrap gap-1">
            {sentiment.positive.length ? (
              sentiment.positive.map((w) => (
                <Chip key={w} tone="emerald">{w}</Chip>
              ))
            ) : (
              <span className="text-xs text-zinc-600">None detected</span>
            )}
          </div>
        </div>
        <div>
          <div className="mb-1.5 text-xs font-medium text-rose-300">Negative words</div>
          <div className="flex flex-wrap gap-1">
            {sentiment.negative.length ? (
              sentiment.negative.map((w) => (
                <Chip key={w} tone="rose">{w}</Chip>
              ))
            ) : (
              <span className="text-xs text-zinc-600">None detected</span>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}
