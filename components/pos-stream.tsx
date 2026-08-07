"use client";

import type { PosCategory, PosToken } from "@/lib/nlp";
import type { ChipTone } from "@/components/ui";

export const POS_STYLE: Record<
  PosCategory,
  { label: string; pill: string; dot: string; bar: string; tone: ChipTone }
> = {
  noun: { label: "Noun", pill: "bg-sky-500/10 text-sky-300 ring-sky-500/40", dot: "bg-sky-400", bar: "bg-sky-500/70", tone: "sky" },
  verb: { label: "Verb", pill: "bg-emerald-500/10 text-emerald-300 ring-emerald-500/40", dot: "bg-emerald-400", bar: "bg-emerald-500/70", tone: "emerald" },
  adjective: { label: "Adjective", pill: "bg-amber-500/10 text-amber-300 ring-amber-500/40", dot: "bg-amber-400", bar: "bg-amber-500/70", tone: "amber" },
  adverb: { label: "Adverb", pill: "bg-fuchsia-500/10 text-fuchsia-300 ring-fuchsia-500/40", dot: "bg-fuchsia-400", bar: "bg-fuchsia-500/70", tone: "fuchsia" },
  value: { label: "Value", pill: "bg-violet-500/10 text-violet-300 ring-violet-500/40", dot: "bg-violet-400", bar: "bg-violet-500/70", tone: "violet" },
  date: { label: "Date", pill: "bg-rose-500/10 text-rose-300 ring-rose-500/40", dot: "bg-rose-400", bar: "bg-rose-500/70", tone: "rose" },
  pronoun: { label: "Pronoun", pill: "bg-teal-500/10 text-teal-300 ring-teal-500/40", dot: "bg-teal-400", bar: "bg-teal-500/70", tone: "teal" },
  determiner: { label: "Det.", pill: "bg-stone-500/10 text-stone-300 ring-stone-500/40", dot: "bg-stone-400", bar: "bg-stone-500/70", tone: "stone" },
  conjunction: { label: "Conj.", pill: "bg-zinc-500/10 text-zinc-300 ring-zinc-500/40", dot: "bg-zinc-400", bar: "bg-zinc-500/70", tone: "zinc" },
  preposition: { label: "Prep.", pill: "bg-cyan-500/10 text-cyan-300 ring-cyan-500/40", dot: "bg-cyan-400", bar: "bg-cyan-500/70", tone: "cyan" },
  expression: { label: "Word", pill: "bg-orange-500/10 text-orange-300 ring-orange-500/40", dot: "bg-orange-400", bar: "bg-orange-500/70", tone: "orange" },
  contact: { label: "Contact", pill: "bg-lime-500/10 text-lime-300 ring-lime-500/40", dot: "bg-lime-400", bar: "bg-lime-500/70", tone: "lime" },
  other: { label: "Other", pill: "bg-slate-500/10 text-slate-300 ring-slate-500/40", dot: "bg-slate-400", bar: "bg-slate-500/70", tone: "zinc" },
};

export function PosStream({ tokens }: { tokens: PosToken[] }) {
  if (tokens.length === 0) {
    return <span className="text-xs text-zinc-600">No tokens found.</span>;
  }
  return (
    <div className="flex flex-wrap items-center">
      {tokens.map((token, i) => {
        const style = POS_STYLE[token.category];
        return (
          <span key={i} className="mr-1 inline-flex items-baseline gap-0.5">
            <span
              className={`rounded px-1 ring-1 ${style.pill}`}
              title={style.label}
            >
              {token.text}
            </span>
            <span className="text-zinc-500">{token.post}</span>
          </span>
        );
      })}
    </div>
  );
}
