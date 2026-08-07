# Ventilation — NLP Playground

A browser-only natural language processing playground built with **Next.js 16**,
**Tailwind CSS v4**, and **[compromise.js](https://compromise.cool)**. Everything
runs locally on your device — no API keys, no network calls, no server-side NLP.

## Features

- **Line-based input** — type multiple lines (separated by newlines) and keep them
  stored in `localStorage`.
- **Parts of speech** — every line is tagged below the input with color-coded tokens
  (noun, verb, adjective, adverb, value, date, pronoun, …).
- **Full analysis page** — open any line for a detailed breakdown:
  - Overview (words, sentences, reading time, …)
  - Sentiment analysis (AFINN lexicon)
  - Named entities (people, places, organizations)
  - Key topics and keyword frequency
  - Numbers, money, percentages, dates and times
  - Extracted nouns & verbs
  - Emails, URLs, phone numbers, hashtags
  - Rewrite tools (past/present/future tense, negation, contraction
    expand/contract, case transforms, redaction)

## Tech stack

| Piece | Choice |
| --- | --- |
| Framework | Next.js 16 (App Router) |
| Styling | Tailwind CSS v4 |
| NLP tagging | compromise.js |
| Sentiment | `sentiment` (AFINN-111) |
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

Runs `scripts/nlp.test.ts` against the analysis engine (`lib/nlp.ts`) using
Node's built-in test runner — no extra test dependencies.

## Project structure

```
app/
  page.tsx            # /   — lines + parts-of-speech
  analysis/page.tsx   # /analysis?id=… — full analysis panels
components/
  lines-page.tsx      # input, localStorage lines, POS cards
  analysis-page.tsx   # full analysis view
  pos-stream.tsx      # shared color-coded token renderer
  panels.tsx          # analysis panels (sentiment, entities, …)
  use-local-storage.ts# SSR-safe localStorage hook
lib/
  nlp.ts              # analysis engine (analyze, tagTokens, transforms)
  storage.ts          # localStorage keys & line model
```

## How it works

1. `lib/nlp.ts` parses text with `compromise` (token tagging, entities, topics,
   numbers, dates) and scores sentiment with the AFINN lexicon.
2. Lines and the input draft are persisted to `localStorage`
   (`ventilation:lines`, `ventilation:draft`) and stay in sync across tabs.
3. `/analysis?id=…` re-reads the line from storage and renders the full panel
   grid for it.

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
