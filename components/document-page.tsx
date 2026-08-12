"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useLocalStorage } from "@/components/use-local-storage";
import {
  DOCUMENTS_KEY,
  MAX_TITLE_LENGTH,
  formatLineTimestamp,
  type StoredDocument,
} from "@/lib/storage";
import { analyze } from "@/lib/nlp";
import { OverviewPanel, SentimentPanel } from "@/components/panels";
import { SiteHeader } from "@/components/site-header";

function EditableTitle({
  document,
  onSave,
}: {
  document: StoredDocument;
  onSave: (title: string) => void;
}) {
  const [value, setValue] = useState(document.title);

  function commit() {
    const next = value.trim();
    if (next) {
      onSave(next);
    } else {
      setValue(document.title);
    }
  }

  return (
    <input
      value={value}
      onChange={(e) => setValue(e.target.value.slice(0, MAX_TITLE_LENGTH))}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          commit();
          e.currentTarget.blur();
        }
        if (e.key === "Escape") {
          setValue(document.title);
          e.currentTarget.blur();
        }
      }}
      spellCheck={false}
      aria-label="Document title"
      className="w-full max-w-2xl rounded-lg border border-transparent bg-transparent px-1 py-0.5 text-2xl font-bold tracking-tight text-zinc-100 outline-none transition hover:border-white/10 focus:border-white/25 focus:bg-white/[0.03]"
    />
  );
}

export function DocumentPage() {
  const searchParams = useSearchParams();
  const id = searchParams.get("id");
  const [documents, setDocuments, ready] = useLocalStorage<StoredDocument[]>(
    DOCUMENTS_KEY,
    [],
  );

  const document = documents.find((d) => d.id === id);
  const analysis = useMemo(
    () => (document ? analyze(document.text) : null),
    [document],
  );
  const paragraphs = useMemo(
    () =>
      document
        ? document.text.split("\n").map((s) => s.trim()).filter(Boolean)
        : [],
    [document],
  );
  const timestamp = document ? formatLineTimestamp(document.createdAt) : null;

  function renameDocument(title: string) {
    if (!document) return;
    setDocuments(
      documents.map((d) => (d.id === document.id ? { ...d, title } : d)),
    );
  }

  return (
    <div className="min-h-screen">
      <SiteHeader backHref="/" backLabel="Lines" />

      <main className="mx-auto max-w-6xl px-4 pb-20">
        {!ready ? (
          <div className="flex justify-center py-24 text-sm text-zinc-500">
            Loading…
          </div>
        ) : !document || !analysis ? (
          <div className="flex flex-col items-center rounded-2xl border border-dashed border-white/10 px-6 py-16 text-center">
            <h2 className="text-lg font-semibold text-zinc-200">
              Document not found
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
              <EditableTitle document={document} onSave={renameDocument} />
              {timestamp && (
                <p className="mt-1 text-xs tabular-nums text-zinc-500">
                  Created {timestamp} · {paragraphs.length} paragraphs ·{" "}
                  {document.text.trim().split(/\s+/).length} words
                </p>
              )}
              <div className="mt-3 space-y-3">
                {paragraphs.map((paragraph, i) => (
                  <p
                    key={i}
                    className="max-w-3xl rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm leading-6 text-zinc-300"
                  >
                    {paragraph}
                  </p>
                ))}
              </div>
            </section>

            <section className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              <OverviewPanel analysis={analysis} />
              <SentimentPanel analysis={analysis} />
            </section>
          </>
        )}
      </main>
    </div>
  );
}
