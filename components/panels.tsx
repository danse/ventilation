"use client";

import { useState } from "react";
import type { Analysis, Transform } from "@/lib/nlp";
import { Card, Chip, RankedList, Stat } from "@/components/ui";
import { POS_STYLE, PosStream } from "@/components/pos-stream";

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

export function PosPanel({ analysis }: { analysis: Analysis }) {
  const { posCounts, posTokens } = analysis;
  const max = Math.max(1, ...posCounts.map((c) => c.count));

  return (
    <Card title="Parts of Speech" subtitle="Token tags" dot="bg-violet-400" className="md:col-span-2">
      <div className="grid gap-5 md:grid-cols-[220px_1fr]">
        <div className="space-y-2">
          {posCounts.map(({ category, count }) => {
            const style = POS_STYLE[category];
            return (
              <div key={category} className="flex items-center gap-2 text-sm">
                <span className={`h-2 w-2 rounded-full ${style.dot}`} />
                <span className="w-16 text-zinc-400">{style.label}</span>
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/5">
                  <div
                    className={`h-full rounded-full ${style.bar}`}
                    style={{ width: `${Math.max(5, (count / max) * 100)}%` }}
                  />
                </div>
                <span className="w-6 text-right text-xs tabular-nums text-zinc-500">
                  {count}
                </span>
              </div>
            );
          })}
        </div>

        <div className="max-h-72 overflow-y-auto rounded-xl border border-white/10 bg-black/20 p-3 text-sm leading-7">
          <PosStream tokens={posTokens} />
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {posCounts.map(({ category }) => {
          const style = POS_STYLE[category];
          return (
            <Chip key={category} tone={style.tone}>
              <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} />
              {style.label}
            </Chip>
          );
        })}
      </div>
    </Card>
  );
}

function EntityGroup({
  label,
  dot,
  items,
  empty,
}: {
  label: string;
  dot: string;
  items: { value: string; count: number }[];
  empty?: string;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-zinc-400">
        <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
        {label}
        <span className="text-zinc-600">({items.length})</span>
      </div>
      {items.length ? (
        <div className="flex flex-wrap gap-1">
          {items.map((item) => (
            <Chip key={item.value}>
              {item.value}
              {item.count > 1 ? (
                <span className="text-zinc-500">×{item.count}</span>
              ) : null}
            </Chip>
          ))}
        </div>
      ) : (
        <span className="text-xs text-zinc-600">{empty ?? "None found"}</span>
      )}
    </div>
  );
}

export function EntitiesPanel({ analysis }: { analysis: Analysis }) {
  return (
    <Card title="Named Entities" subtitle="People, places and organizations" dot="bg-cyan-400">
      <div className="space-y-3">
        <EntityGroup label="People" dot="bg-sky-400" items={analysis.people} />
        <EntityGroup label="Places" dot="bg-amber-400" items={analysis.places} />
        <EntityGroup label="Organizations" dot="bg-violet-400" items={analysis.organizations} />
      </div>
    </Card>
  );
}

export function TopicsPanel({ analysis }: { analysis: Analysis }) {
  return (
    <Card title="Key Topics" subtitle="Frequent phrases & names" dot="bg-orange-400">
      {analysis.topics.length ? (
        <RankedList items={analysis.topics} tone="bg-orange-500/70" />
      ) : (
        <span className="text-sm text-zinc-600">No topics detected.</span>
      )}
    </Card>
  );
}

const VALUE_TONES = {
  number: "sky",
  money: "emerald",
  percent: "violet",
} as const;

export function ValuesPanel({ analysis }: { analysis: Analysis }) {
  const { values, dates } = analysis;
  return (
    <Card title="Numbers & Dates" subtitle="Parsed values" dot="bg-violet-400">
      <div className="space-y-3">
        <div>
          <div className="mb-1.5 text-xs font-medium text-zinc-400">Values</div>
          {values.length ? (
            <div className="flex flex-wrap gap-1">
              {values.map((v) => (
                <Chip key={v.text} tone={VALUE_TONES[v.kind]}>
                  {v.text}
                  {v.num ? <span className="text-zinc-500">= {v.num}</span> : null}
                </Chip>
              ))}
            </div>
          ) : (
            <span className="text-xs text-zinc-600">None found</span>
          )}
        </div>
        <div>
          <div className="mb-1.5 text-xs font-medium text-zinc-400">Dates & times</div>
          {dates.length ? (
            <div className="flex flex-wrap gap-1">
              {dates.map((d) => (
                <Chip key={d} tone="rose">{d}</Chip>
              ))}
            </div>
          ) : (
            <span className="text-xs text-zinc-600">None found</span>
          )}
        </div>
      </div>
    </Card>
  );
}

export function NounsVerbsPanel({ analysis }: { analysis: Analysis }) {
  const { nouns, verbs } = analysis;
  return (
    <Card title="Nouns & Verbs" subtitle="Extracted phrases" dot="bg-emerald-400">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <div className="mb-1.5 text-xs font-medium text-sky-300">Nouns</div>
          {nouns.length ? (
            <ul className="max-h-44 space-y-1 overflow-y-auto text-sm text-zinc-300">
              {nouns.map((n) => (
                <li key={n} className="truncate">{n}</li>
              ))}
            </ul>
          ) : (
            <span className="text-xs text-zinc-600">None</span>
          )}
        </div>
        <div>
          <div className="mb-1.5 text-xs font-medium text-emerald-300">Verbs</div>
          {verbs.length ? (
            <ul className="max-h-44 space-y-1 overflow-y-auto text-sm text-zinc-300">
              {verbs.map((v) => (
                <li key={v} className="truncate">{v}</li>
              ))}
            </ul>
          ) : (
            <span className="text-xs text-zinc-600">None</span>
          )}
        </div>
      </div>
    </Card>
  );
}

export function ContactsPanel({ analysis }: { analysis: Analysis }) {
  const groups: { label: string; items: string[]; tone: "lime" | "cyan" | "orange" | "teal" }[] = [
    { label: "URLs", items: analysis.urls, tone: "lime" },
    { label: "Emails", items: analysis.emails, tone: "cyan" },
    { label: "Phones", items: analysis.phones, tone: "orange" },
    { label: "Hashtags", items: analysis.hashtags, tone: "teal" },
  ];
  return (
    <Card title="Contact & Social" subtitle="Emails, URLs, phones, hashtags" dot="bg-lime-400">
      <div className="space-y-3">
        {groups.map((group) => (
          <div key={group.label}>
            <div className="mb-1.5 text-xs font-medium text-zinc-400">
              {group.label}{" "}
              <span className="text-zinc-600">({group.items.length})</span>
            </div>
            {group.items.length ? (
              <div className="flex flex-wrap gap-1">
                {group.items.map((item) => (
                  <Chip key={item} tone={group.tone}>{item}</Chip>
                ))}
              </div>
            ) : (
              <span className="text-xs text-zinc-600">None found</span>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}

export function TransformsPanel({
  transforms,
  text,
}: {
  transforms: Transform[];
  text: string;
}) {
  const [active, setActive] = useState<string | null>(null);
  const selected = transforms.find((t) => t.name === active);
  let output = "";
  if (selected && text.trim()) {
    try {
      output = selected.apply(text);
    } catch {
      output = "Could not transform this text.";
    }
  }

  return (
    <Card title="Rewrite" subtitle="Rule-based transforms run on your text" dot="bg-rose-400" className="md:col-span-2">
      <div className="flex flex-wrap gap-2">
        {transforms.map((t) => (
          <button
            key={t.name}
            onClick={() => setActive(t.name)}
            title={t.description}
            className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition ${
              active === t.name
                ? "border-rose-500/50 bg-rose-500/15 text-rose-200"
                : "border-white/10 bg-white/5 text-zinc-300 hover:border-white/25 hover:bg-white/10"
            }`}
          >
            {t.name}
          </button>
        ))}
      </div>
      <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-4">
        {active ? (
          text.trim() ? (
            <p className="whitespace-pre-wrap text-sm leading-6 text-zinc-200">
              {output || "Transforming…"}
            </p>
          ) : (
            <p className="text-sm text-zinc-600">Add some text to preview a rewrite.</p>
          )
        ) : (
          <p className="text-sm text-zinc-600">
            Pick a transform above to preview how your text is rewritten.
          </p>
        )}
      </div>
    </Card>
  );
}
