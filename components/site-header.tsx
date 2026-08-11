import Link from "next/link";

export function SiteHeader({ backHref, backLabel }: { backHref?: string; backLabel?: string }) {
  return (
    <header className="sticky top-0 z-10 border-b border-white/10 bg-zinc-950/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link href="/" className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-sky-500 text-sm font-bold text-white">
            V
          </div>
          <div>
            <h1 className="text-sm font-semibold text-zinc-100">Ventilation</h1>
            <p className="text-xs text-zinc-500">NLP playground</p>
          </div>
        </Link>
        <div className="flex items-center gap-3">
          <Link
            href="/speech-debug"
            className="text-xs text-zinc-400 transition hover:text-zinc-200"
          >
            Model diagnostics
          </Link>
          {backHref ? (
            <Link
              href={backHref}
              className="text-xs text-zinc-400 transition hover:text-zinc-200"
            >
              ← {backLabel ?? "Back"}
            </Link>
          ) : null}
          <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-300">
            100% in-browser
          </span>
        </div>
      </div>
    </header>
  );
}
