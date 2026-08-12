# Ventilation — NLP Playground

[Demo](https://danse.github.io/ventilation/)

A browser-only natural language processing playground built with **Next.js 16**,
**Tailwind CSS v4**, **[compromise.js](https://compromise.cool)**, and
**transformers.js**. Everything runs locally on your device — no API keys, no
server-side NLP, and the only network traffic is the one-time download of the
on-device speech model.

## Features

- **Line-based input** — type multiple lines (separated by newlines) and keep them
  stored in `localStorage`. Lines are listed newest-first; when a multi-line
  paragraph is split, its lines are saved in reverse so earlier lines sink to the
  bottom. Each line carries the timestamp it was entered.
- **Edit the last line** — the most recently entered line has an **Edit** button
  that moves its text back to the input and deletes the line.
- **Parts of speech** — every line is tagged below the input with color-coded tokens
  (noun, verb, adjective, adverb, value, date, pronoun, …).
- **Documents** — select two or more lines and merge them into a single document
  (joined in reading order, originals removed). Documents get a combined analysis
  and can be renamed.
- **Full analysis page** — open any line or document for a detailed breakdown:
  - Overview (words, sentences, reading time, longest token, …)
  - Sentiment analysis (AFINN lexicon)
- **On-device dictation** — dictate a line straight into the input using an
  in-browser whisper model (transformers.js); the model downloads once on first use.

## Tech stack

| Piece | Choice |
| --- | --- |
| Framework | Next.js 16 (App Router) |
| Styling | Tailwind CSS v4 |
| NLP tagging | compromise.js |
| Sentiment | `sentiment` (AFINN-111) |
| On-device speech | transformers.js (`Xenova/whisper-tiny.en`, fp32) |
| State persistence | `localStorage` via `useSyncExternalStore` |
| Tests | Node 24 built-in test runner (`node --test`) |

## Getting started

Requires Node 24+ (tests rely on native TypeScript type-stripping).

```bash
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

> The project uses pnpm — do not mix in `npm install`, which can corrupt the
> `node_modules` layout and crash the native Turbopack worker at startup.

## Tests

```bash
pnpm test
```

Runs `scripts/*.test.ts` (`nlp.test.ts` for the analysis engine, `speech.test.ts`
for the speech model loader) using Node's built-in test runner — no extra test
dependencies.

## Project structure

```
app/
  page.tsx             # /   — lines + parts-of-speech + dictation
  analysis/page.tsx    # /analysis?id=… — line analysis panels
  document/page.tsx    # /document?id=… — document analysis panels
  speech-debug/        # /speech-debug — on-device model diagnostics
components/
  lines-page.tsx       # input, localStorage lines, POS cards, documents
  analysis-page.tsx    # line analysis view
  document-page.tsx    # document view (editable title, combined analysis)
  pos-stream.tsx       # shared color-coded token renderer
  panels.tsx           # analysis panels (overview, sentiment)
  use-speech-recognition.ts  # dictation hook (whisper via transformers.js)
  speech-recognition-fallback.ts # mic → transcribe → draft
  use-local-storage.ts # SSR-safe localStorage hook
lib/
  nlp.ts               # analysis engine (analyze, tagTokens)
  storage.ts           # localStorage keys & line/document model
  speech-model.ts      # whisper model loading & progress
```

## How it works

1. `lib/nlp.ts` parses text with `compromise` (token tagging, word/sentence
   stats) and scores sentiment with the AFINN lexicon.
2. Lines, the input draft, and documents are persisted to `localStorage`
   (`ventilation:lines`, `ventilation:draft`, `ventilation:documents`) and stay
   in sync across tabs.
3. `/analysis?id=…` and `/document?id=…` re-read the entry from storage and
   render the overview + sentiment panels for it.

## Deploy to GitHub Pages

The app is configured for static export (`output: "export"` in
`next.config.ts`). A GitHub Actions workflow (`.github/workflows/deploy.yml`)
builds it with `NEXT_PUBLIC_BASE_PATH=/<repo>` and deploys to GitHub Pages on
every push to `main`.

1. In repo **Settings → Pages → Source**, select **GitHub Actions**.
2. Push to `main`; the site appears at `https://<user>.github.io/<repo>/`.

To build locally: `NEXT_PUBLIC_BASE_PATH=/<repo> pnpm build` (output in `out/`).

Note: because state lives in `localStorage`, each visitor's lines stay in their
own browser.
