"use client";

import type { SpeechEngine, SpeechEngineEvents } from "@/components/use-speech-recognition";
import { TranscriberManager } from "../lib/speech-model.ts";
import type { ModelLoader, Transcriber } from "../lib/speech-model.ts";

let audioContext: AudioContext | null = null;

function getAudioContext() {
  audioContext ??= new AudioContext();
  return audioContext;
}

const defaultModelLoader: ModelLoader = (onProgress) =>
  import("@huggingface/transformers").then(({ pipeline }) =>
    pipeline("automatic-speech-recognition", "Xenova/whisper-tiny.en", {
      dtype: "q8",
      progress_callback: onProgress,
    }) as unknown as Promise<Transcriber>,
  );

const managersByLoader = new WeakMap<ModelLoader, TranscriberManager>();

function getManager(loadModel: ModelLoader): TranscriberManager {
  let manager = managersByLoader.get(loadModel);
  if (!manager) {
    manager = new TranscriberManager(loadModel);
    managersByLoader.set(loadModel, manager);
  }
  return manager;
}

async function resampleToMono16k(buffer: AudioBuffer): Promise<Float32Array> {
  if (buffer.sampleRate === 16000) {
    return buffer.getChannelData(0);
  }
  const length = Math.round(buffer.duration * 16000);
  const offline = new OfflineAudioContext(1, length, 16000);
  const source = offline.createBufferSource();
  source.buffer = buffer;
  source.connect(offline.destination);
  source.start(0);
  const rendered = await offline.startRendering();
  return rendered.getChannelData(0);
}

export function createFallbackEngine(
  events: SpeechEngineEvents,
  loadModel: ModelLoader = defaultModelLoader,
): SpeechEngine {
  let stream: MediaStream | null = null;
  let recorder: MediaRecorder | null = null;
  let chunks: Blob[] = [];
  let active = false;

  const manager = getManager(loadModel);

  function loadTranscriber(
    onProgress: (percent: number | null) => void,
  ): Promise<Transcriber> {
    return manager.get(onProgress);
  }

  function pickMime(): string | undefined {
    for (const mime of ["audio/webm", "audio/mp4"]) {
      if (MediaRecorder.isTypeSupported(mime)) return mime;
    }
    return undefined;
  }

  function finish() {
    stream?.getTracks().forEach((track) => track.stop());
    stream = null;
    recorder = null;
    chunks = [];
    events.onEnd();
  }

  return {
    start() {
      if (active) return;
      void (async () => {
        try {
          stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        } catch {
          events.onError("Microphone access was denied.");
          events.onEnd();
          return;
        }
        chunks = [];
        const mime = pickMime();
        recorder = mime
          ? new MediaRecorder(stream, { mimeType: mime })
          : new MediaRecorder(stream);
        recorder.ondataavailable = (event) => {
          if (event.data.size > 0) chunks.push(event.data);
        };
        recorder.onstop = () => {
          active = false;
          const mimeType = recorder?.mimeType;
          void (async () => {
            events.onTranscribing();
            events.onDetail("Loading speech model…");
            let transcriber: Transcriber;
            try {
              transcriber = await loadTranscriber(events.onModelProgress);
            } catch (error) {
              const reason =
                error instanceof Error ? error.message : String(error);
              events.onError(
                `Could not load the speech model — ${reason.slice(0, 300)}`,
                { model: true },
              );
              finish();
              return;
            }
            events.onDetail("Decoding audio…");
            let decoded: AudioBuffer;
            try {
              const blob = new Blob(chunks, { type: mimeType });
              decoded = await getAudioContext().decodeAudioData(
                await blob.arrayBuffer(),
              );
            } catch {
              events.onError(
                "Could not decode the recording — please try again.",
              );
              finish();
              return;
            }
            events.onDetail("Transcribing…");
            try {
              const audio = await resampleToMono16k(decoded);
              const result = await transcriber(audio);
              const text = (result.text ?? "").trim();
              if (text) {
                events.onFinal(text);
              } else {
                events.onError("No speech detected — please try again.");
              }
            } catch {
              events.onError("Transcription failed — please try again.");
            }
            finish();
          })();
        };
        active = true;
        recorder.start();
      })();
    },
    stop() {
      if (active && recorder && recorder.state !== "inactive") {
        recorder.stop();
      }
    },
    dispose() {
      active = false;
      if (recorder && recorder.state !== "inactive") {
        recorder.stop();
      }
      stream?.getTracks().forEach((track) => track.stop());
      stream = null;
      recorder = null;
    },
    clearModel: async () => {
      manager.reset();
      try {
        if (typeof caches === "undefined") return true;
        const cache = await caches.open("transformers-cache");
        const keys = await cache.keys();
        const ours = keys.filter((key) =>
          key.url.includes("Xenova/whisper-tiny.en"),
        );
        await Promise.all(ours.map((key) => cache.delete(key)));
      } catch {
        // Cache Storage unavailable; the in-memory reset already forces a
        // fresh download.
      }
      return true;
    },
  };
}
