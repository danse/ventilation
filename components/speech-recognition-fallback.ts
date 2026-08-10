"use client";

import type { SpeechEngine, SpeechEngineEvents } from "@/components/use-speech-recognition";

type Transcriber = (audio: Float32Array) => Promise<{ text?: string }>;

let transcriberPromise: Promise<Transcriber> | null = null;
let audioContext: AudioContext | null = null;

function getTranscriber(): Promise<Transcriber> {
  if (!transcriberPromise) {
    transcriberPromise = import("@huggingface/transformers").then(({ pipeline }) =>
      pipeline(
        "automatic-speech-recognition",
        "Xenova/whisper-tiny.en",
      ) as unknown as Promise<Transcriber>,
    );
  }
  return transcriberPromise;
}

function getAudioContext() {
  audioContext ??= new AudioContext();
  return audioContext;
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

async function transcribe(blob: Blob): Promise<string> {
  const transcriber = await getTranscriber();
  const decoded = await getAudioContext().decodeAudioData(await blob.arrayBuffer());
  const audio = await resampleToMono16k(decoded);
  const result = await transcriber(audio);
  return result.text ?? "";
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

  return {
    start() {
      if (active) return;
      void (async () => {
        let recorderForStop: MediaRecorder | null = null;
        try {
          stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          chunks = [];
          const mime = pickMime();
          recorder = mime
            ? new MediaRecorder(stream, { mimeType: mime })
            : new MediaRecorder(stream);
          recorderForStop = recorder;
          recorder.ondataavailable = (event) => {
            if (event.data.size > 0) chunks.push(event.data);
          };
          recorder.onstop = () => {
            active = false;
            void (async () => {
              events.onTranscribing();
              try {
                const blob = new Blob(chunks, { type: mime });
                const text = (await transcribe(blob)).trim();
                if (text) events.onFinal(text);
              } catch {
                events.onError("Speech recognition failed — please try again.");
              } finally {
                stream?.getTracks().forEach((track) => track.stop());
                stream = null;
                recorder = null;
                events.onEnd();
              }
            })();
          };
          active = true;
          recorder.start();
        } catch {
          active = false;
          if (recorderForStop && recorderForStop.state !== "inactive") {
            recorderForStop.stop();
          }
          stream?.getTracks().forEach((track) => track.stop());
          stream = null;
          recorder = null;
          events.onError("Speech recognition failed — please try again.");
          events.onEnd();
        }
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
