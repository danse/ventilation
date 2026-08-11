"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useLocalStorage } from "@/components/use-local-storage";
import { LINES_KEY, formatLineTimestamp, type StoredLine } from "@/lib/storage";
import { analyze } from "@/lib/nlp";
import { OverviewPanel, SentimentPanel } from "@/components/panels";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

export function AnalysisPage() {
  const searchParams = useSearchParams();
  const id = searchParams.get("id");
  const [lines, , ready] = useLocalStorage<StoredLine[]>(LINES_KEY, []);

  const line = lines.find((l) => l.id === id);
  const analysis = useMemo(() => (line ? analyze(line.text) : null), [line]);

  return (
    <div className="min-h-screen">
      <SiteHeader backHref="/" backLabel="Lines" />

      <main className="mx-auto max-w-6xl px-4 pb-20">
        {!ready ? (
          <div className="flex justify-center py-24 text-sm text-zinc-500">
            Loading…
          </div>
        ) : !line || !analysis ? (
          <div className="flex flex-col items-center rounded-2xl border border-dashed border-white/10 px-6 py-16 text-center">
            <h2 className="text-lg font-semibold text-zinc-200">
              Line not found
            </h2>
            <p className="mt-1 text-sm text-zinc-500">
              It may have been deleted or the link is stale.
            </p>
            <Link
              href="/"
              className="mt-5 rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-zinc-300 transition hover:border-white/25 hover:bg-white/10"
            >
              ← Back to lines
            </Link>
          </div>
        ) : (
          <>
            <section className="pt-8">
              <h2 className="text-2xl font-bold tracking-tight text-zinc-100">
                Full analysis
              </h2>
              {formatLineTimestamp(line.createdAt) && (
                <p className="mt-1 text-xs tabular-nums text-zinc-500">
                  Entered {formatLineTimestamp(line.createdAt)}
                </p>
              )}
              <p className="mt-2 max-w-3xl rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm leading-6 text-zinc-300">
                {line.text}
              </p>
            </section>

            <section className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              <OverviewPanel analysis={analysis} />
              <SentimentPanel analysis={analysis} />
            </section>

            <SiteFooter />
          </>
        )}
      </main>
    </div>
  );
}
