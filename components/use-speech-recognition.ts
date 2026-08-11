"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useSyncExternalStore,
} from "react";
import { createFallbackEngine } from "@/components/speech-recognition-fallback";
import {
  INITIAL_SPEECH_STATE,
  speechReducer,
} from "@/lib/speech-state";

export type SpeechStatus = "idle" | "listening" | "transcribing";

export interface SpeechEngineEvents {
  onFinal: (text: string) => void;
  onInterim: (text: string) => void;
  onTranscribing: () => void;
  onModelProgress: (percent: number | null) => void;
  onDetail: (message: string) => void;
  onEnd: () => void;
  onError: (message: string, options?: { model?: boolean }) => void;
}

export interface SpeechEngine {
  start(): void;
  stop(): void;
  dispose(): void;
  clearModel?: () => Promise<boolean>;
}

function useHydrated() {
  return useSyncExternalStore(
    useCallback(() => () => {}, []),
    () => true,
    () => false,
  );
}

export function useSpeechRecognition({ onFinal }: { onFinal: (text: string) => void }) {
  const [speech, dispatch] = useReducer(speechReducer, INITIAL_SPEECH_STATE);
  const hydrated = useHydrated();
  const engineRef = useRef<SpeechEngine | null>(null);
  const onFinalRef = useRef(onFinal);

  useEffect(() => {
    onFinalRef.current = onFinal;
  });

  const nativeSupported = useMemo(
    () =>
      typeof window !== "undefined" &&
      !!(window.SpeechRecognition ?? window.webkitSpeechRecognition),
    [],
  );

  const fallbackSupported = useMemo(
    () =>
      typeof window !== "undefined" &&
      typeof navigator !== "undefined" &&
      !!navigator.mediaDevices?.getUserMedia,
    [],
  );

  useEffect(() => {
    if (!hydrated) return;
    if (!nativeSupported && !fallbackSupported) return;

    const events: SpeechEngineEvents = {
      onFinal: (text) => onFinalRef.current(text),
      onInterim: (text) => dispatch({ type: "interim", text }),
      onTranscribing: () => dispatch({ type: "transcribing" }),
      onModelProgress: (percent) =>
        dispatch({ type: "modelProgress", percent }),
      onDetail: (message) => dispatch({ type: "detail", message }),
      onEnd: () => dispatch({ type: "end" }),
      onError: (message, options) =>
        dispatch({
          type: "error",
          message,
          model: options?.model ?? false,
        }),
    };

    const engine = nativeSupported
      ? createNativeEngine(events)
      : createFallbackEngine(events);
    engineRef.current = engine;

    return () => {
      engine.dispose();
      engineRef.current = null;
    };
  }, [hydrated, nativeSupported, fallbackSupported]);

  const supported = hydrated && (nativeSupported || fallbackSupported);

  const toggle = useCallback(() => {
    const engine = engineRef.current;
    if (!engine) return;
    if (speech.status === "listening" || speech.status === "transcribing") {
      engine.stop();
      return;
    }
    dispatch({ type: "start" });
    engine.start();
  }, [speech.status]);

  const clearModel = useCallback(async () => {
    const engine = engineRef.current;
    if (!engine?.clearModel) return false;
    try {
      const ok = await engine.clearModel();
      if (ok) dispatch({ type: "clearModel" });
      return ok;
    } catch {
      return false;
    }
  }, []);

  return {
    status: speech.status,
    interim: speech.interim,
    error: speech.error,
    modelError: speech.modelError,
    progress: speech.progress,
    detail: speech.detail,
    supported,
    toggle,
    clearModel,
  };
}

export function createNativeEngine(events: SpeechEngineEvents): SpeechEngine {
  const Ctor = window.SpeechRecognition ?? window.webkitSpeechRecognition!;
  const recognition = new Ctor();

  recognition.lang = "en-US";
  recognition.continuous = false;
  recognition.interimResults = true;
  recognition.maxAlternatives = 1;

  recognition.onresult = (event) => {
    let interimText = "";
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const result = event.results[i];
      if (result.isFinal) {
        events.onFinal(result[0].transcript.trim());
      } else {
        interimText += result[0].transcript;
      }
    }
    events.onInterim(interimText);
  };

  recognition.onerror = (event) => {
    if (event.error === "not-allowed") {
      events.onError("Microphone access was denied.");
    } else if (event.error !== "aborted" && event.error !== "no-speech") {
      events.onError("Speech recognition failed — please try again.");
    } else {
      events.onEnd();
    }
  };

  recognition.onend = () => events.onEnd();

  return {
    start: () => {
      try {
        recognition.start();
      } catch {
        events.onError("Speech recognition failed — please try again.");
      }
    },
    stop: () => recognition.stop(),
    dispose: () => recognition.abort(),
  };
}
