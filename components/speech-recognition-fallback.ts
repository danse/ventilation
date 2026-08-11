"use client";

import type { SpeechEngine, SpeechEngineEvents } from "@/components/use-speech-recognition";

type Transcriber = (audio: Float32Array) => Promise<{ text?: string }>;

let transcriberPromise: Promise<Transcriber> | null = null;
let audioContext: AudioContext | null = null;

function getAudioContext() {
  audioContext ??= new AudioContext();
  return audioContext;
}

async function loadTranscriber(
  onProgress: (percent: number | null) => void,
): Promise<Transcriber> {
  if (!transcriberPromise) {
    transcriberPromise = import("@huggingface/transformers").then(({ pipeline }) =>
      pipeline("automatic-speech-recognition", "Xenova/whisper-tiny.en", {
        progress_callback: (info) => {
          const { status, progress } = info as {
            status?: string;
            progress?: number;
          };
          if (status === "progress_total" || status === "progress") {
            if (typeof progress === "number") onProgress(progress);
          } else if (status === "done" || status === "ready") {
            onProgress(null);
          }
        },
      }) as unknown as Promise<Transcriber>,
    );
  }
  try {
    return await transcriberPromise;
  } catch (error) {
    transcriberPromise = null;
    throw error;
  }
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

export function createFallbackEngine(events: SpeechEngineEvents): SpeechEngine {
  let stream: MediaStream | null = null;
  let recorder: MediaRecorder | null = null;
  let chunks: Blob[] = [];
  let active = false;

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
            } catch {
              events.onError(
                "Could not download the speech model — check your connection and try again.",
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
  };
}
