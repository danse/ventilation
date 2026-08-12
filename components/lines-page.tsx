"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { useLocalStorage } from "@/components/use-local-storage";
import { useSpeechRecognition } from "@/components/use-speech-recognition";
import {
  DOCUMENTS_KEY,
  DRAFT_KEY,
  LINES_KEY,
  buildDocumentTitle,
  formatLineTimestamp,
  type StoredDocument,
  type StoredLine,
} from "@/lib/storage";
import { MAX_INPUT_LENGTH, SAMPLE_TEXT, tagTokens } from "@/lib/nlp";
import { PosStream } from "@/components/pos-stream";
import { SiteHeader } from "@/components/site-header";

function LineCard({
  line,
  index,
  selected,
  onToggleSelect,
  onEdit,
  onDelete,
}: {
  line: StoredLine;
  index: number;
  selected: boolean;
  onToggleSelect: () => void;
  onEdit?: () => void;
  onDelete: () => void;
}) {
  const tokens = useMemo(() => tagTokens(line.text)?.posTokens ?? [], [line.text]);
  const words = line.text.trim() ? line.text.trim().split(/\s+/).length : 0;
  const timestamp = formatLineTimestamp(line.createdAt);

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 transition hover:border-white/25 hover:bg-white/[0.05]">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <label
            className={`flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded-md border transition ${
              selected
                ? "border-violet-400 bg-violet-500/20 text-violet-200"
                : "border-white/15 bg-white/5 text-transparent hover:border-white/30"
            }`}
            title={selected ? "Deselect" : "Select"}
          >
            <input
              type="checkbox"
              checked={selected}
              onChange={onToggleSelect}
              className="sr-only"
            />
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-3.5 w-3.5"
              aria-hidden="true"
            >
              <path d="M20 6 9 17l-5-5" />
            </svg>
          </label>
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-white/10 text-xs font-semibold text-zinc-400">
            {index + 1}
          </span>
          <span className="text-xs tabular-nums text-zinc-500">
            {words} words · {line.text.length} chars
            {timestamp ? ` · ${timestamp}` : ""}
          </span>
        </div>
        <div className="flex items-center gap-3">
          {onEdit && (
            <button
              onClick={onEdit}
              title="Move back to the input for editing"
              className="text-xs text-zinc-500 transition hover:text-sky-300"
            >
              Edit
            </button>
          )}
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

function DocumentCard({
  document,
  index,
  onDelete,
}: {
  document: StoredDocument;
  index: number;
  onDelete: () => void;
}) {
  const words = document.text.trim()
    ? document.text.trim().split(/\s+/).length
    : 0;
  const timestamp = formatLineTimestamp(document.createdAt);

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 transition hover:border-white/25 hover:bg-white/[0.05]">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-white/10 text-xs font-semibold text-zinc-400">
            {index + 1}
          </span>
          <span className="truncate text-sm font-medium text-zinc-200">
            {document.title}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <span className="text-xs tabular-nums text-zinc-500">
            {words} words
            {timestamp ? ` · ${timestamp}` : ""}
          </span>
          <Link
            href={`/document?id=${document.id}`}
            className="text-xs font-medium text-violet-300 transition hover:text-violet-200"
          >
            Open →
          </Link>
          <button
            onClick={onDelete}
            className="text-xs text-zinc-500 transition hover:text-rose-300"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

export function LinesPage() {
  const [lines, setLines, linesReady] = useLocalStorage<StoredLine[]>(LINES_KEY, []);
  const [draft, setDraft, draftReady] = useLocalStorage<string>(DRAFT_KEY, "");
  const [documents, setDocuments] = useLocalStorage<StoredDocument[]>(
    DOCUMENTS_KEY,
    [],
  );
  const [selected, setSelected] = useState<Set<string>>(() => new Set());

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
    setLines([...next.reverse(), ...lines]);
    setDraft("");
  }

  function deleteLine(id: string) {
    setLines(lines.filter((l) => l.id !== id));
    setSelected((current) => {
      const next = new Set(current);
      next.delete(id);
      return next;
    });
  }

  function editLine(line: StoredLine) {
    setDraft(line.text);
    deleteLine(line.id);
  }

  function deleteDocument(id: string) {
    setDocuments(documents.filter((d) => d.id !== id));
  }

  function toggleSelect(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function mergeSelectedIntoDocument() {
    const selectedLines = lines
      .filter((l) => selected.has(l.id))
      .sort((a, b) => a.createdAt - b.createdAt);
    if (selectedLines.length < 2) return;
    const text = selectedLines.map((l) => l.text.trim()).filter(Boolean).join("\n");
    if (!text) return;
    const document: StoredDocument = {
      id: crypto.randomUUID(),
      title: buildDocumentTitle(text),
      createdAt: Date.now(),
      text,
    };
    const selectedIds = new Set(selectedLines.map((l) => l.id));
    setDocuments([document, ...documents]);
    setLines(lines.filter((l) => !selectedIds.has(l.id)));
    setSelected(new Set());
  }

  return (
    <div className="min-h-screen">
      <SiteHeader />

      <main className="mx-auto max-w-6xl px-4 pb-20">
        <section className="pt-8">
          <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
            <textarea
              value={draftReady ? draft : ""}
              onChange={(e) => setDraft(e.target.value.slice(0, MAX_INPUT_LENGTH))}
              onKeyDown={(e) => {
                if (e.key !== "Enter" || e.shiftKey || e.nativeEvent.isComposing) return;
                e.preventDefault();
                addLines();
              }}
              placeholder="Type and press Enter to add a line. Use Shift+Enter for a newline…"
              spellCheck={false}
              className="block min-h-36 w-full resize-y bg-transparent px-4 py-3 text-sm leading-6 text-zinc-100 placeholder-zinc-600 outline-none"
            />
            {(speech.status === "listening" ||
              speech.status === "transcribing" ||
              speech.error) && (
              <div className="border-t border-white/10 bg-black/20 px-4 py-2 text-xs text-zinc-400">
                {speech.status === "transcribing" ? (
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center gap-2">
                      <span
                        className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-rose-500"
                        aria-hidden="true"
                      />
                      <span>{speech.detail ?? "Transcribing audio…"}</span>
                      {speech.progress !== null && speech.progress < 100 && (
                        <span className="ml-auto tabular-nums text-zinc-500">
                          {Math.round(speech.progress)}%
                        </span>
                      )}
                    </div>
                    {speech.progress !== null && speech.progress < 100 && (
                      <div
                        className="h-1 w-full overflow-hidden rounded-full bg-white/10"
                        role="progressbar"
                        aria-valuenow={Math.round(speech.progress)}
                        aria-valuemin={0}
                        aria-valuemax={100}
                      >
                        <div
                          className="h-full rounded-full bg-violet-500 transition-[width]"
                          style={{ width: `${speech.progress}%` }}
                        />
                      </div>
                    )}
                  </div>
                ) : speech.error ? (
                  <div className="flex items-center gap-2">
                    <span
                      className="h-2 w-2 shrink-0 rounded-full bg-rose-500/60"
                      aria-hidden="true"
                    />
                    <span>{speech.error}</span>
                    {speech.modelError && (
                      <button
                        onClick={() => void speech.clearModel()}
                        className="ml-auto shrink-0 rounded border border-white/15 bg-white/5 px-2 py-0.5 text-[11px] font-medium text-zinc-300 transition hover:border-white/30 hover:bg-white/10"
                      >
                        Remove model
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <span
                      className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-rose-500"
                      aria-hidden="true"
                    />
                    {speech.interim
                      ? `Listening… "${speech.interim}"`
                      : "Listening… speak, then click the mic to stop"}
                  </div>
                )}
              </div>
            )}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 bg-black/20 px-4 py-2">
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={addLines}
                  disabled={!draft.trim()}
                  className="rounded-lg bg-violet-500 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-violet-400 disabled:cursor-not-allowed disabled:opacity-40"
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
                      ? "flex items-center gap-1.5 rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-rose-500"
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
              <h3 className="text-lg font-semibold text-zinc-200">
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
              {selected.size > 0 && (
                <button
                  onClick={mergeSelectedIntoDocument}
                  disabled={selected.size < 2}
                  className="mb-3 rounded-lg bg-violet-500 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-violet-400 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Merge {selected.size} selected into a document
                </button>
              )}
              <div className="space-y-3">
                {lines.map((line, i) => (
                  <LineCard
                    key={line.id}
                    line={line}
                    index={i}
                    selected={selected.has(line.id)}
                    onToggleSelect={() => toggleSelect(line.id)}
                    onEdit={i === 0 ? () => editLine(line) : undefined}
                    onDelete={() => deleteLine(line.id)}
                  />
                ))}
              </div>
            </>
          )}
        </section>

        {documents.length > 0 && (
          <section className="mt-8">
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-widest text-zinc-400">
              Documents{" "}
              <span className="text-zinc-600">
                ({documents.length} · stored locally)
              </span>
            </h3>
            <div className="space-y-3">
              {documents.map((document, i) => (
                <DocumentCard
                  key={document.id}
                  document={document}
                  index={i}
                  onDelete={() => deleteDocument(document.id)}
                />
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
