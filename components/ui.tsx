import type { ReactNode } from "react";

export function Card({
  title,
  subtitle,
  dot,
  children,
  className = "",
}: {
  title: string;
  subtitle?: string;
  dot?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-2xl border border-white/10 bg-white/[0.03] p-5 shadow-sm backdrop-blur ${className}`}
    >
      <header className="mb-4 flex items-center gap-2">
        {dot ? <span className={`h-2 w-2 rounded-full ${dot}`} /> : null}
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-widest text-zinc-300">
            {title}
          </h2>
          {subtitle ? (
            <p className="mt-0.5 text-xs text-zinc-500">{subtitle}</p>
          ) : null}
        </div>
      </header>
      {children}
    </section>
  );
}

export function Chip({
  children,
  tone = "zinc",
}: {
  children: ReactNode;
  tone?: ChipTone;
}) {
  const styles: Record<ChipTone, string> = {
    zinc: "border-white/10 bg-white/5 text-zinc-300",
    sky: "border-sky-500/30 bg-sky-500/10 text-sky-300",
    emerald: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
    amber: "border-amber-500/30 bg-amber-500/10 text-amber-300",
    rose: "border-rose-500/30 bg-rose-500/10 text-rose-300",
    violet: "border-violet-500/30 bg-violet-500/10 text-violet-300",
    fuchsia: "border-fuchsia-500/30 bg-fuchsia-500/10 text-fuchsia-300",
    teal: "border-teal-500/30 bg-teal-500/10 text-teal-300",
    cyan: "border-cyan-500/30 bg-cyan-500/10 text-cyan-300",
    orange: "border-orange-500/30 bg-orange-500/10 text-orange-300",
    lime: "border-lime-500/30 bg-lime-500/10 text-lime-300",
    stone: "border-stone-500/30 bg-stone-500/10 text-stone-300",
  };
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs ${styles[tone]}`}
    >
      {children}
    </span>
  );
}

export type ChipTone =
  | "zinc"
  | "sky"
  | "emerald"
  | "amber"
  | "rose"
  | "violet"
  | "fuchsia"
  | "teal"
  | "cyan"
  | "orange"
  | "lime"
  | "stone";

export function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5">
      <div className="text-lg font-semibold tabular-nums text-zinc-100">
        {value}
      </div>
      <div className="text-xs text-zinc-500">{label}</div>
      {hint ? <div className="mt-0.5 text-[11px] text-zinc-600">{hint}</div> : null}
    </div>
  );
}

export function RankedList({
  items,
  tone = "bg-violet-500/70",
}: {
  items: { value: string; count: number }[];
  tone?: string;
}) {
  const max = Math.max(1, ...items.map((i) => i.count));
  return (
    <ul className="space-y-2">
      {items.map((item) => (
        <li key={item.value} className="flex items-center gap-3">
          <span className="w-1/2 truncate text-sm text-zinc-200">{item.value}</span>
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/5">
            <div
              className={`h-full rounded-full ${tone}`}
              style={{ width: `${Math.max(6, (item.count / max) * 100)}%` }}
            />
          </div>
          <span className="w-6 text-right text-xs tabular-nums text-zinc-500">
            {item.count}
          </span>
        </li>
      ))}
    </ul>
  );
}
