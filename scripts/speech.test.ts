import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  resolveProgressUpdate,
  TranscriberManager,
} from "../lib/speech-model.ts";
import type { ModelLoader } from "../lib/speech-model.ts";
import {
  INITIAL_SPEECH_STATE,
  speechReducer,
} from "../lib/speech-state.ts";
import { createFallbackEngine } from "../components/speech-recognition-fallback.ts";
import type { SpeechEngineEvents } from "../components/use-speech-recognition.ts";

type Call = [string, ...unknown[]];

function makeEvents(): {
  events: SpeechEngineEvents;
  calls: Call[];
  ended: Promise<void>;
} {
  const calls: Call[] = [];
  let resolveEnded: () => void = () => {};
  const ended = new Promise<void>((resolve) => {
    resolveEnded = resolve;
  });
  const events: SpeechEngineEvents = {
    onFinal: (text) => calls.push(["final", text]),
    onInterim: (text) => calls.push(["interim", text]),
    onTranscribing: () => calls.push(["transcribing"]),
    onModelProgress: (percent) => calls.push(["progress", percent]),
    onDetail: (message) => calls.push(["detail", message]),
    onEnd: () => {
      calls.push(["end"]);
      resolveEnded();
    },
    onError: (message, options) => calls.push(["error", message, options]),
  };
  return { events, calls, ended };
}

function tick() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

const fakeAudioBuffer = {
  sampleRate: 16000,
  duration: 0.5,
  getChannelData: () => new Float32Array(8000),
};

class FakeAudioContext {
  decodeAudioData() {
    return Promise.resolve(fakeAudioBuffer);
  }
}

class FakeMediaRecorder {
  static isTypeSupported() {
    return true;
  }
  state: "inactive" | "recording" = "inactive";
  mimeType = "audio/webm";
  ondataavailable: ((event: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;
  stream: MediaStream;
  options?: MediaRecorderOptions;
  constructor(stream: MediaStream, options?: MediaRecorderOptions) {
    this.stream = stream;
    this.options = options;
  }
  start() {
    this.state = "recording";
  }
  stop() {
    this.state = "inactive";
    this.ondataavailable?.({ data: new Blob([new Uint8Array([1, 2, 3])]) });
    this.onstop?.();
  }
}

let getUserMediaImpl: () => Promise<MediaStream> = async () =>
  ({ getTracks: () => [{ stop() {} }] }) as unknown as MediaStream;

const originals = {
  navigator: globalThis.navigator,
  MediaRecorder: (globalThis as Record<string, unknown>).MediaRecorder,
  AudioContext: (globalThis as Record<string, unknown>).AudioContext,
  caches: (globalThis as Record<string, unknown>).caches,
};

function installGlobal(name: string, value: unknown) {
  try {
    Object.defineProperty(globalThis, name, {
      value,
      configurable: true,
      writable: true,
    });
  } catch {
    (globalThis as Record<string, unknown>)[name] = value;
  }
}

before(() => {
  installGlobal("MediaRecorder", FakeMediaRecorder);
  installGlobal("AudioContext", FakeAudioContext);
  installGlobal("navigator", {
    mediaDevices: { getUserMedia: () => getUserMediaImpl() },
  });
});

after(() => {
  for (const [name, value] of Object.entries(originals)) {
    if (value === undefined) {
      delete (globalThis as Record<string, unknown>)[name];
    } else {
      installGlobal(name, value);
    }
  }
});

describe("resolveProgressUpdate()", () => {
  it("tracks only the aggregate progress_total event", () => {
    assert.deepEqual(
      resolveProgressUpdate({ status: "progress_total", progress: 25 }),
      { kind: "set", percent: 25 },
    );
  });

  it("ignores raw per-file progress events", () => {
    assert.deepEqual(
      resolveProgressUpdate({ status: "progress", progress: 80 }),
      { kind: "none" },
    );
  });

  it("ignores per-file done events so the bar does not vanish mid-load", () => {
    assert.deepEqual(
      resolveProgressUpdate({ status: "done", file: "decoder.onnx" }),
      { kind: "none" },
    );
  });

  it("clears on the final ready event", () => {
    assert.deepEqual(resolveProgressUpdate({ status: "ready" }), {
      kind: "clear",
    });
  });

  it("ignores events without a numeric progress", () => {
    assert.deepEqual(resolveProgressUpdate({ status: "progress_total" }), {
      kind: "none",
    });
    assert.deepEqual(resolveProgressUpdate({}), { kind: "none" });
  });
});

describe("speechReducer()", () => {
  it("start resets everything and enters listening", () => {
    const s = speechReducer(
      { ...INITIAL_SPEECH_STATE, error: "old", modelError: true },
      { type: "start" },
    );
    assert.equal(s.status, "listening");
    assert.equal(s.error, null);
    assert.equal(s.modelError, false);
    assert.equal(s.interim, "");
    assert.equal(s.progress, null);
    assert.equal(s.detail, null);
  });

  it("transcribing clears the model error from a previous attempt", () => {
    const s = speechReducer(
      { ...INITIAL_SPEECH_STATE, modelError: true, error: "old" },
      { type: "transcribing" },
    );
    assert.equal(s.status, "transcribing");
    assert.equal(s.modelError, false);
    assert.equal(s.progress, null);
  });

  it("a model error flags modelError and returns to idle", () => {
    const s = speechReducer(INITIAL_SPEECH_STATE, {
      type: "error",
      message: "Could not load the speech model — boom",
      model: true,
    });
    assert.equal(s.status, "idle");
    assert.equal(s.modelError, true);
    assert.equal(s.error, "Could not load the speech model — boom");
  });

  it("keeps modelError after end so the Remove-model button stays visible", () => {
    const withError = speechReducer(INITIAL_SPEECH_STATE, {
      type: "error",
      message: "Could not load the speech model — boom",
      model: true,
    });
    const s = speechReducer(withError, { type: "end" });
    assert.equal(s.status, "idle");
    assert.equal(s.modelError, true);
    assert.equal(s.error, "Could not load the speech model — boom");
  });

  it("clearModel clears the error and modelError", () => {
    const withError = speechReducer(INITIAL_SPEECH_STATE, {
      type: "error",
      message: "Could not load the speech model — boom",
      model: true,
    });
    const s = speechReducer(withError, { type: "clearModel" });
    assert.equal(s.error, null);
    assert.equal(s.modelError, false);
  });

  it("a non-model error clears modelError", () => {
    const s = speechReducer(
      { ...INITIAL_SPEECH_STATE, modelError: true },
      { type: "error", message: "No speech detected — please try again." },
    );
    assert.equal(s.modelError, false);
    assert.equal(s.status, "idle");
  });

  it("updates interim, progress and detail", () => {
    let s = speechReducer(INITIAL_SPEECH_STATE, { type: "interim", text: "hi" });
    assert.equal(s.interim, "hi");
    s = speechReducer(s, { type: "modelProgress", percent: 42 });
    assert.equal(s.progress, 42);
    s = speechReducer(s, { type: "detail", message: "Decoding audio…" });
    assert.equal(s.detail, "Decoding audio…");
    s = speechReducer(s, { type: "end" });
    assert.equal(s.interim, "");
    assert.equal(s.progress, null);
    assert.equal(s.detail, null);
  });
});

describe("TranscriberManager", () => {
  it("deduplicates concurrent loads", async () => {
    let calls = 0;
    const manager = new TranscriberManager(() => {
      calls += 1;
      return Promise.resolve(async () => ({ text: "" }));
    });
    await Promise.all([
      manager.get(() => {}),
      manager.get(() => {}),
      manager.get(() => {}),
    ]);
    assert.equal(calls, 1);
  });

  it("retries after a failed load", async () => {
    let calls = 0;
    const manager = new TranscriberManager(() => {
      calls += 1;
      return calls === 1
        ? Promise.reject(new Error("TransposeDQWeightsForMatMulNBits"))
        : Promise.resolve(async () => ({ text: "ok" }));
    });
    await assert.rejects(manager.get(() => {}), /TransposeDQWeightsForMatMulNBits/);
    const transcriber = await manager.get(() => {});
    assert.equal(typeof transcriber, "function");
    assert.equal(calls, 2);
  });

  it("reset() forces a fresh download on the next get()", async () => {
    let calls = 0;
    const manager = new TranscriberManager(() => {
      calls += 1;
      return Promise.resolve(async () => ({ text: "ok" }));
    });
    await manager.get(() => {});
    manager.reset();
    await manager.get(() => {});
    assert.equal(calls, 2);
  });

  it("forwards aggregate progress events and clears on ready", async () => {
    const received: Array<number | null> = [];
    const manager = new TranscriberManager((onProgress) => {
      onProgress({ status: "progress", file: "tokenizer.json", progress: 30 });
      onProgress({ status: "progress_total", progress: 25 });
      onProgress({ status: "done", file: "tokenizer.json" });
      onProgress({ status: "progress_total", progress: 55 });
      onProgress({ status: "ready" });
      return Promise.resolve(async () => ({ text: "ok" }));
    });
    await manager.get((percent) => received.push(percent));
    assert.deepEqual(received, [25, 55, null]);
  });

  it("reports progress up to failure, then a fresh get reloads", async () => {
    const received: Array<number | null> = [];
    let calls = 0;
    const manager = new TranscriberManager((onProgress) => {
      calls += 1;
      onProgress({ status: "progress_total", progress: 12 });
      onProgress({ status: "progress_total", progress: 49 });
      return Promise.reject(new Error("TransposeDQWeightsForMatMulNBits"));
    });
    await assert.rejects(manager.get((p) => received.push(p)), /TransposeDQWeightsForMatMulNBits/);
    assert.deepEqual(received, [12, 49]);
    await assert.rejects(manager.get(() => {}), /TransposeDQWeightsForMatMulNBits/);
    assert.equal(calls, 2);
  });
});

describe("createFallbackEngine()", () => {
  it("surfaces a model load failure with the model flag", async () => {
    const harness = makeEvents();
    const loadModel: ModelLoader = async () => {
      throw new Error("TransposeDQWeightsForMatMulNBits");
    };
    const engine = createFallbackEngine(harness.events, loadModel);
    engine.start();
    await tick();
    engine.stop();
    await harness.ended;

    const errors = harness.calls.filter(([t]) => t === "error");
    assert.equal(errors.length, 1);
    assert.equal(
      errors[0][1],
      "Could not load the speech model — TransposeDQWeightsForMatMulNBits",
    );
    assert.deepEqual(errors[0][2], { model: true });
    assert.ok(harness.calls.some(([t]) => t === "end"));
    assert.ok(!harness.calls.some(([t]) => t === "final"));
  });

  it("shows progress up to 50%, then reports the same failure", async () => {
    const harness = makeEvents();
    const loadModel: ModelLoader = (onProgress) => {
      onProgress({ status: "progress_total", progress: 12 });
      onProgress({ status: "progress_total", progress: 49 });
      return Promise.reject(new Error("TransposeDQWeightsForMatMulNBits"));
    };
    const engine = createFallbackEngine(harness.events, loadModel);
    engine.start();
    await tick();
    engine.stop();
    await harness.ended;

    const progressCalls = harness.calls.filter(([t]) => t === "progress");
    assert.deepEqual(
      progressCalls.map((c) => c[1]),
      [12, 49],
    );
    const errorCalls = harness.calls.filter(([t]) => t === "error");
    assert.equal(errorCalls.length, 1);
    assert.deepEqual(errorCalls[0][2], { model: true });
    const progressIndex = harness.calls.indexOf(progressCalls[1]);
    const errorIndex = harness.calls.indexOf(errorCalls[0]);
    assert.ok(progressIndex < errorIndex, "progress should precede the error");
  });

  it("transcribes a recording and emits the final text", async () => {
    const harness = makeEvents();
    const loadModel: ModelLoader = async () => async () => ({
      text: "hello world",
    });
    const engine = createFallbackEngine(harness.events, loadModel);
    engine.start();
    await tick();
    engine.stop();
    await harness.ended;

    assert.deepEqual(
      harness.calls.find(([t]) => t === "final")?.[1],
      "hello world",
    );
    assert.ok(!harness.calls.some(([t]) => t === "error"));
    assert.ok(harness.calls.some(([t]) => t === "end"));
    assert.ok(
      harness.calls.some(([t, m]) => t === "detail" && m === "Transcribing…"),
    );
  });

  it("reports a runtime transcription failure without the model flag", async () => {
    const harness = makeEvents();
    const loadModel: ModelLoader = async () => async () => {
      throw new Error("inference exploded");
    };
    const engine = createFallbackEngine(harness.events, loadModel);
    engine.start();
    await tick();
    engine.stop();
    await harness.ended;

    const errors = harness.calls.filter(([t]) => t === "error");
    assert.equal(errors.length, 1);
    assert.equal(errors[0][1], "Transcription failed — please try again.");
    assert.deepEqual(errors[0][2], undefined);
  });

  it("reports denied microphone access", async () => {
    const harness = makeEvents();
    getUserMediaImpl = async () => {
      throw new DOMException("denied", "NotAllowedError");
    };
    const loadModel: ModelLoader = async () => async () => ({ text: "" });
    const engine = createFallbackEngine(harness.events, loadModel);
    engine.start();
    await harness.ended;

    const errors = harness.calls.filter(([t]) => t === "error");
    assert.equal(errors.length, 1);
    assert.equal(errors[0][1], "Microphone access was denied.");
    assert.deepEqual(errors[0][2], undefined);
  });

  it("clearModel purges only cached files for the whisper model", async () => {
    const deleted: string[] = [];
    installGlobal("caches", {
      open: async () => ({
        keys: async () => [
          {
            url: "https://cdn-lfs.huggingface.co/repos/Xenova/whisper-tiny.en/revision/main/onnx/decoder_model_merged_quantized.onnx",
          },
          {
            url: "https://cdn-lfs.huggingface.co/repos/Xenova/whisper-tiny.en/revision/main/onnx/encoder_model_quantized.onnx",
          },
          {
            url: "https://cdn-lfs.huggingface.co/repos/Xenova/whisper-tiny.en/revision/main/tokenizer.json",
          },
          {
            url: "https://cdn-lfs.huggingface.co/repos/Some/other-model/config.json",
          },
        ],
        delete: async (key: { url: string }) => {
          deleted.push(key.url);
          return true;
        },
      }),
    });

    const harness = makeEvents();
    const loadModel: ModelLoader = async () => async () => ({ text: "" });
    const engine = createFallbackEngine(harness.events, loadModel);
    assert.ok(engine.clearModel, "engine should expose clearModel");
    const ok = await engine.clearModel();
    assert.equal(ok, true);
    assert.equal(deleted.length, 3);
    assert.ok(deleted.every((url) => url.includes("Xenova/whisper-tiny.en")));
    assert.ok(!deleted.some((url) => url.includes("other-model")));
  });
});
