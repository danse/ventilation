import Link from "next/link";

export function SiteHeader({ backHref, backLabel }: { backHref?: string; backLabel?: string }) {
  return (
    <header className="sticky top-0 z-10 border-b border-white/10 bg-zinc-950/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
        <Link
          href="/"
          className="text-sm font-semibold text-zinc-100 hover:text-zinc-300"
        >
          Ventilation
        </Link>
        <div className="flex items-center gap-4">
          <Link
            href="/speech-debug"
            className="text-xs text-zinc-500 transition hover:text-zinc-300"
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
        </div>
      </div>
    </header>
  );
}
