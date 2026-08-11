"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { SiteHeader } from "@/components/site-header";
import type { ProgressInfo } from "@/lib/speech-model";

const MODEL = "Xenova/whisper-tiny.en";
const REVISION = "main";
const BASE_URL = `https://huggingface.co/${MODEL}/resolve/${REVISION}/`;
const DEFAULT_CACHE_NAME = "transformers-cache";

const FILES = [
  "config.json",
  "tokenizer.json",
  "tokenizer_config.json",
  "preprocessor_config.json",
  "vocab.json",
  "merges.txt",
  "onnx/encoder_model_quantized.onnx",
  "onnx/decoder_model_merged_quantized.onnx",
];

type LogKind = "info" | "event" | "success" | "error";

interface LogRow {
  id: number;
  t: string;
  kind: LogKind;
  text: string;
  data?: string;
}

function fmtBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "n/a";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fmtTime(): string {
  const d = new Date();
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  const ms = String(d.getMilliseconds()).padStart(3, "0");
  return `${hh}:${mm}:${ss}.${ms}`;
}

function argToString(arg: unknown): string {
  if (typeof arg === "string") return arg;
  if (arg instanceof Error) return `${arg.name}: ${arg.message}`;
  try {
    return JSON.stringify(arg);
  } catch {
    return String(arg);
  }
}

function errorDetail(e: unknown): { message: string; name: string; stack?: string; cause?: unknown } {
  if (e instanceof Error) {
    return {
      message: e.message,
      name: e.name,
      stack: e.stack,
      cause: e.cause,
    };
  }
  return { message: String(e), name: typeof e };
}

const KIND_STYLE: Record<LogKind, string> = {
  info: "text-sky-300",
  event: "text-zinc-300",
  success: "text-emerald-300",
  error: "text-rose-300",
};

export function SpeechDiagnosticsPage() {
  const [rows, setRows] = useState<LogRow[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const idRef = useRef(0);
  const fileRowsRef = useRef<Record<string, number>>({});
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const push = useCallback(
    (kind: LogKind, text: string, data?: unknown): number => {
      const id = idRef.current++;
      setRows((rows) => [
        ...rows,
        {
          id,
          t: fmtTime(),
          kind,
          text,
          data:
            data === undefined
              ? undefined
              : typeof data === "string"
                ? data
                : JSON.stringify(data, null, 2),
        },
      ]);
      return id;
    },
    [],
  );

  const update = useCallback(
    (id: number, text: string, data?: string) => {
      setRows((rows) =>
        rows.map((row) =>
          row.id === id
            ? { ...row, text, data: data === undefined ? row.data : data }
            : row,
        ),
      );
    },
    [],
  );

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [rows]);

  const copyRow = useCallback(async (row: LogRow) => {
    const text = row.data ?? `${row.t}  ${row.text}`;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
    setCopiedId(row.id);
    setTimeout(() => setCopiedId((id) => (id === row.id ? null : id)), 1200);
  }, []);

  const inspectEnvironment = useCallback(async () => {
    setBusy("environment");
    try {
      push("info", `userAgent: ${navigator.userAgent}`);
      push(
        "info",
        `hardwareConcurrency=${navigator.hardwareConcurrency} deviceMemory=${
          (navigator as unknown as { deviceMemory?: number }).deviceMemory ?? "n/a"
        } MB language=${navigator.language}`,
      );
      push(
        "info",
        `caches API: ${typeof caches !== "undefined" ? "available" : "UNAVAILABLE"} · clipboard: ${
          typeof navigator.clipboard !== "undefined" ? "available" : "unavailable"
        }`,
      );

      const { env } = await import("@huggingface/transformers");
      push("info", `transformers ${env.version}`, {
        version: env.version,
        remoteHost: env.remoteHost,
        remotePathTemplate: env.remotePathTemplate,
        localModelPath: env.localModelPath,
        cacheKey: env.cacheKey,
        cacheDir: env.cacheDir,
        allowRemoteModels: env.allowRemoteModels,
        useBrowserCache: env.useBrowserCache,
        useWasmCache: env.useWasmCache,
      });

      if (typeof caches !== "undefined") {
        const cache = await caches.open(env.cacheKey);
        const keys = await cache.keys();
        const ours = keys.filter((key) => key.url.includes(MODEL));
        push(
          "info",
          `cache "${env.cacheKey}": ${keys.length} total entries, ${ours.length} matching ${MODEL}`,
          { total: keys.length, modelEntries: ours.length },
        );
        for (const key of ours) {
          let size = -1;
          try {
            const res = await cache.match(key);
            if (res) size = (await res.clone().arrayBuffer()).byteLength;
          } catch {
            // size stays -1
          }
          push("info", `cached: ${key.url} (${fmtBytes(size)})`, {
            url: key.url,
            bytes: size,
          });
        }
      } else {
        push("error", "caches API not available in this environment");
      }
    } catch (error) {
      push("error", `environment probe failed: ${argToString(error)}`, errorDetail(error));
    } finally {
      setBusy(null);
    }
  }, [push]);

  const downloadFiles = useCallback(async () => {
    setBusy("download");
    push("info", `downloading ${FILES.length} files from ${BASE_URL}`);
    for (const file of FILES) {
      const url = BASE_URL + file;
      const started = performance.now();
      try {
        push("event", `GET ${url}`);
        const res = await fetch(url, { cache: "no-store" });
        const buf = await res.arrayBuffer();
        const ms = Math.round(performance.now() - started);
        push(
          res.ok ? "success" : "error",
          `${file} → ${res.status} ${res.statusText} · ${fmtBytes(buf.byteLength)} · ${ms}ms`,
          {
            file,
            requestUrl: url,
            finalUrl: res.url,
            status: res.status,
            statusText: res.statusText,
            contentType: res.headers.get("content-type"),
            bytes: buf.byteLength,
            ms,
          },
        );
      } catch (error) {
        push("error", `✗ ${file} failed: ${argToString(error)}`, {
          file,
          url,
          ...errorDetail(error),
        });
      }
    }
    push("success", "download sweep complete");
    setBusy(null);
  }, [push]);

  const loadPipeline = useCallback(async () => {
    setBusy("pipeline");
    const origError = console.error;
    const origWarn = console.warn;
    console.error = (...args: unknown[]) => {
      push("error", `console.error: ${args.map(argToString).join(" ")}`, args);
      origError(...args);
    };
    console.warn = (...args: unknown[]) => {
      push("info", `console.warn: ${args.map(argToString).join(" ")}`, args);
      origWarn(...args);
    };
    try {
      const { pipeline } = await import("@huggingface/transformers");
      push(
        "info",
        `pipeline("automatic-speech-recognition", "${MODEL}", { dtype: "fp32" })`,
      );
      const transcriber = await pipeline(
        "automatic-speech-recognition",
        MODEL,
        {
          dtype: "fp32",
          progress_callback: (info: ProgressInfo) => {
            if (info.status === "progress" && info.file) {
              const text = `${info.file} — ${info.progress}% (${fmtBytes(info.loaded ?? 0)} / ${fmtBytes(info.total ?? 0)})`;
              const existing = fileRowsRef.current[info.file];
              if (existing === undefined) {
                fileRowsRef.current[info.file] = push("event", `▶ ${text}`, info);
              } else {
                update(existing, `▶ ${text}`, JSON.stringify(info, null, 2));
              }
              return;
            }
            if (info.status === "done" && info.file) {
              push("success", `✓ ${info.file} downloaded`, info);
              delete fileRowsRef.current[info.file];
              return;
            }
            if (info.status === "progress_total") {
              push(
                "event",
                `progress_total: ${info.progress}% (${fmtBytes(info.loaded ?? 0)} / ${fmtBytes(info.total ?? 0)})`,
                info,
              );
              return;
            }
            if (info.status === "ready") {
              push("success", "✓ all files loaded, pipeline ready", info);
              return;
            }
            push("info", `event: ${JSON.stringify(info)}`, info);
          },
        },
      );
      push(
        "success",
        "✓ pipeline constructed — running forward pass on 1 s of silence (16 kHz mono)",
      );
      const audio = new Float32Array(16000);
      const started = performance.now();
      const result = await transcriber(audio);
      const ms = Math.round(performance.now() - started);
      push(
        "success",
        `✓ forward pass OK in ${ms}ms → ${JSON.stringify(result)}`,
        { result, ms },
      );
    } catch (error) {
      push("error", `✗ pipeline failed: ${argToString(error)}`, errorDetail(error));
    } finally {
      fileRowsRef.current = {};
      console.error = origError;
      console.warn = origWarn;
      setBusy(null);
    }
  }, [push, update]);

  const clearCache = useCallback(async () => {
    setBusy("clear");
    try {
      if (typeof caches === "undefined") {
        push("error", "caches API not available in this environment");
        return;
      }
      const { env } = await import("@huggingface/transformers");
      const cacheName = env.cacheKey ?? DEFAULT_CACHE_NAME;
      const cache = await caches.open(cacheName);
      const keys = await cache.keys();
      const ours = keys.filter((key) => key.url.includes(MODEL));
      await Promise.all(ours.map((key) => cache.delete(key)));
      push(
        "success",
        `deleted ${ours.length} cached entries for ${MODEL} from "${cacheName}"`,
        { cacheName, deleted: ours.map((key) => key.url) },
      );
    } catch (error) {
      push("error", `clear cache failed: ${argToString(error)}`, errorDetail(error));
    } finally {
      setBusy(null);
    }
  }, [push]);

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader backHref="/" backLabel="Home" />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">
        <div className="mb-4">
          <h1 className="text-lg font-semibold text-zinc-100">
            Speech model diagnostics
          </h1>
          <p className="mt-1 text-xs text-zinc-400">
            Direct probe of the on-device whisper model download and load path.
            Every event, file and error is logged; tap any line to copy its
            contents to the clipboard.
          </p>
        </div>

        <div className="mb-4 flex flex-wrap gap-2">
          <button
            onClick={() => void inspectEnvironment()}
            disabled={busy !== null}
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-zinc-300 transition hover:border-white/25 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy === "environment" ? "Working…" : "Environment & cache"}
          </button>
          <button
            onClick={() => void downloadFiles()}
            disabled={busy !== null}
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-zinc-300 transition hover:border-white/25 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy === "download" ? "Working…" : "Download files"}
          </button>
          <button
            onClick={() => void loadPipeline()}
            disabled={busy !== null}
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-zinc-300 transition hover:border-white/25 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy === "pipeline" ? "Working…" : "Load + run pipeline"}
          </button>
          <button
            onClick={() => void clearCache()}
            disabled={busy !== null}
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-zinc-300 transition hover:border-white/25 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy === "clear" ? "Working…" : "Clear model cache"}
          </button>
          <button
            onClick={() => {
              setRows([]);
              fileRowsRef.current = {};
            }}
            disabled={busy !== null}
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-zinc-300 transition hover:border-white/25 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Clear log
          </button>
        </div>

        <div
          ref={scrollRef}
          className="h-[60vh] overflow-y-auto rounded-xl border border-white/10 bg-black/40 font-mono text-[11px] leading-relaxed"
        >
          {rows.length === 0 ? (
            <p className="p-4 text-zinc-600">
              No activity yet. Pick an action above.
            </p>
          ) : (
            rows.map((row) => (
              <button
                key={row.id}
                onClick={() => void copyRow(row)}
                title="Tap to copy"
                className="block w-full cursor-pointer px-3 py-1 text-left transition hover:bg-white/5"
              >
                <span className="mr-2 text-zinc-600">{row.t}</span>
                <span className={KIND_STYLE[row.kind]}>{row.text}</span>
                {copiedId === row.id && (
                  <span className="ml-2 text-emerald-400">copied</span>
                )}
              </button>
            ))
          )}
        </div>
      </main>
    </div>
  );
}
