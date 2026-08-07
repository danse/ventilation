export function SiteFooter() {
  return (
    <footer className="mx-auto mt-12 max-w-6xl border-t border-white/10 px-4 pb-8 pt-6 text-center text-xs text-zinc-600">
      Built with{" "}
      <a
        href="https://compromise.cool"
        target="_blank"
        rel="noreferrer"
        className="text-zinc-400 underline underline-offset-2 hover:text-zinc-200"
      >
        compromise
      </a>{" "}
      and the{" "}
      <a
        href="https://www.npmjs.com/package/sentiment"
        target="_blank"
        rel="noreferrer"
        className="text-zinc-400 underline underline-offset-2 hover:text-zinc-200"
      >
        AFINN
      </a>{" "}
      sentiment lexicon. All processing happens on your device.
    </footer>
  );
}
