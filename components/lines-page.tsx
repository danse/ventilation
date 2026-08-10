"use client";

import { useCallback, useMemo } from "react";
import Link from "next/link";
import { useLocalStorage } from "@/components/use-local-storage";
import { useSpeechRecognition } from "@/components/use-speech-recognition";
import { DRAFT_KEY, LINES_KEY, type StoredLine } from "@/lib/storage";
import { MAX_INPUT_LENGTH, SAMPLE_TEXT, tagTokens } from "@/lib/nlp";
import { PosStream } from "@/components/pos-stream";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

function LineCard({
  line,
  index,
  onDelete,
}: {
  line: StoredLine;
  index: number;
  onDelete: () => void;
}) {
  const tokens = useMemo(() => tagTokens(line.text)?.posTokens ?? [], [line.text]);
  const words = line.text.trim() ? line.text.trim().split(/\s+/).length : 0;

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 transition hover:border-white/25 hover:bg-white/[0.05]">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-gradient-to-br from-violet-500 to-sky-500 text-xs font-bold text-white">
            {index + 1}
          </span>
          <span className="text-xs tabular-nums text-zinc-500">
            {words} words · {line.text.length} chars
          </span>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href={`/analysis?id=${line.id}`}
            className="text-xs font-medium text-violet-300 transition hover:text-violet-200"
          >
            Full analysis →
          </Link>
          <button
            onClick={onDelete}
            className="text-xs text-zinc-500 transition hover:text-rose-300"
          >
            Delete
          </button>
        </div>
      </div>
      <div className="mt-3 text-sm leading-7">
        <PosStream tokens={tokens} />
      </div>
    </div>
  );
}

export function LinesPage() {
  const [lines, setLines, linesReady] = useLocalStorage<StoredLine[]>(LINES_KEY, []);
  const [draft, setDraft, draftReady] = useLocalStorage<string>(DRAFT_KEY, "");

  const appendToDraft = useCallback(
    (text: string) => {
      setDraft((current) => {
        const joined = current.trimEnd()
          ? `${current.trimEnd()} ${text}`
          : text;
        return joined.slice(0, MAX_INPUT_LENGTH);
      });
    },
    [setDraft],
  );

  const speech = useSpeechRecognition({ onFinal: appendToDraft });
  const draftWords = draft.trim() ? draft.trim().split(/\s+/).length : 0;

  function addLines() {
    const parts = draft
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    if (!parts.length) return;
    const now = Date.now();
    const next: StoredLine[] = parts.map((text, i) => ({
      id: crypto.randomUUID(),
      text,
      createdAt: now + i,
    }));
    setLines([...next, ...lines]);
    setDraft("");
  }

  function deleteLine(id: string) {
    setLines(lines.filter((l) => l.id !== id));
  }

  return (
    <div className="min-h-screen">
      <SiteHeader />

      <main className="mx-auto max-w-6xl px-4 pb-20">
        <section className="pt-8">
          <h2 className="text-2xl font-bold tracking-tight text-zinc-100">
            Your lines, tagged
          </h2>
          <p className="mt-1 text-sm text-zinc-500">
            Each line you add is tagged with parts of speech below, and saved in
            your browser. Open a line for the full analysis.
          </p>

          <div className="mt-5 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
            <textarea
              value={draftReady ? draft : ""}
              onChange={(e) => setDraft(e.target.value.slice(0, MAX_INPUT_LENGTH))}
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === "Enter") addLines();
              }}
              placeholder="Type text here. Use a newline to split it into separate lines…"
              spellCheck={false}
              className="block min-h-36 w-full resize-y bg-transparent px-4 py-3 text-sm leading-6 text-zinc-100 placeholder-zinc-600 outline-none"
            />
            {(speech.status === "listening" ||
              speech.status === "transcribing" ||
              speech.error) && (
              <div className="flex items-center gap-2 border-t border-white/10 bg-black/20 px-4 py-2 text-xs text-zinc-400">
                <span
                  className={
                    speech.status === "listening" || speech.status === "transcribing"
                      ? "h-2 w-2 shrink-0 animate-pulse rounded-full bg-rose-500"
                      : "h-2 w-2 shrink-0 rounded-full bg-rose-500/60"
                  }
                  aria-hidden="true"
                />
                {speech.error
                  ? speech.error
                  : speech.status === "transcribing"
                    ? "Transcribing audio… (first use downloads a small speech model)"
                    : speech.interim
                      ? `Listening… "${speech.interim}"`
                      : "Listening… speak, then click the mic to stop"}
              </div>
            )}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 bg-black/20 px-4 py-2">
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={addLines}
                  disabled={!draft.trim()}
                  className="rounded-lg bg-gradient-to-r from-violet-500 to-sky-500 px-3 py-1.5 text-xs font-medium text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Add lines
                </button>
                <button
                  onClick={() => setDraft(SAMPLE_TEXT)}
                  className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-zinc-300 transition hover:border-white/25 hover:bg-white/10"
                >
                  Sample
                </button>
                <button
                  onClick={() => setDraft("")}
                  disabled={!draft}
                  className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-zinc-300 transition hover:border-white/25 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Clear draft
                </button>
                <button
                  onClick={speech.toggle}
                  disabled={!speech.supported}
                  aria-pressed={
                    speech.status === "listening" || speech.status === "transcribing"
                  }
                  title={
                    !speech.supported
                      ? "Speech input isn't supported in this browser"
                      : speech.status === "listening"
                        ? "Stop listening"
                        : speech.status === "transcribing"
                          ? "Transcribing…"
                          : "Dictate a line (first use downloads a small speech model)"
                  }
                  className={
                    speech.status === "listening" || speech.status === "transcribing"
                      ? "flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-rose-500 to-red-500 px-3 py-1.5 text-xs font-medium text-white transition hover:opacity-90"
                      : "flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-zinc-300 transition hover:border-white/25 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
                  }
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-3.5 w-3.5"
                    aria-hidden="true"
                  >
                    <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                    <path d="M12 19v3" />
                  </svg>
                  {speech.status === "transcribing"
                    ? "Transcribing…"
                    : speech.status === "listening"
                      ? "Listening…"
                      : !speech.supported
                        ? "Speech unavailable"
                        : "Dictate"}
                </button>
              </div>
              <div className="text-xs tabular-nums text-zinc-500">
                {draftWords} words · {draft.length.toLocaleString()} / {MAX_INPUT_LENGTH.toLocaleString()} chars
              </div>
            </div>
          </div>
        </section>

        <section className="mt-8">
          {!linesReady || !draftReady ? (
            <div className="flex justify-center py-24 text-sm text-zinc-500">
              Loading…
            </div>
          ) : lines.length === 0 ? (
            <div className="flex flex-col items-center rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-6 py-14 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500/20 to-sky-500/20 text-zinc-300">
                <span className="text-lg font-semibold">Aa</span>
              </div>
              <h3 className="mt-4 text-lg font-semibold text-zinc-200">
                No lines yet
              </h3>
              <p className="mt-1 max-w-sm text-sm text-zinc-500">
                Type above and hit <span className="text-zinc-300">Add lines</span>.
                Every line gets color-coded parts of speech below the input.
              </p>
              <button
                onClick={() => setDraft(SAMPLE_TEXT)}
                className="mt-5 rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-zinc-300 transition hover:border-white/25 hover:bg-white/10"
              >
                Start with the sample
              </button>
            </div>
          ) : (
            <>
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-widest text-zinc-400">
                Lines{" "}
                <span className="text-zinc-600">
                  ({lines.length} · stored locally)
                </span>
              </h3>
              <div className="space-y-3">
                {lines.map((line, i) => (
                  <LineCard
                    key={line.id}
                    line={line}
                    index={i}
                    onDelete={() => deleteLine(line.id)}
                  />
                ))}
              </div>
            </>
          )}
        </section>

        <SiteFooter />
      </main>
    </div>
  );
}
