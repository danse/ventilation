"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { createFallbackEngine } from "@/components/speech-recognition-fallback";

export type SpeechStatus = "idle" | "listening" | "transcribing";

export interface SpeechEngineEvents {
  onFinal: (text: string) => void;
  onInterim: (text: string) => void;
  onTranscribing: () => void;
  onModelProgress: (percent: number | null) => void;
  onDetail: (message: string) => void;
  onEnd: () => void;
  onError: (message: string) => void;
}

export interface SpeechEngine {
  start(): void;
  stop(): void;
  dispose(): void;
}

function useHydrated() {
  return useSyncExternalStore(
    useCallback(() => () => {}, []),
    () => true,
    () => false,
  );
}

export function useSpeechRecognition({ onFinal }: { onFinal: (text: string) => void }) {
  const [status, setStatus] = useState<SpeechStatus>("idle");
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [detail, setDetail] = useState<string | null>(null);
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
      onInterim: setInterim,
      onTranscribing: () => {
        setStatus("transcribing");
        setInterim("");
        setDetail(null);
        setProgress(null);
      },
      onModelProgress: setProgress,
      onDetail: setDetail,
      onEnd: () => {
        setStatus("idle");
        setInterim("");
        setDetail(null);
        setProgress(null);
      },
      onError: (message) => {
        setStatus("idle");
        setInterim("");
        setDetail(null);
        setProgress(null);
        setError(message);
      },
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
    if (status === "listening" || status === "transcribing") {
      engine.stop();
      return;
    }
    setError(null);
    setInterim("");
    setDetail(null);
    setProgress(null);
    setStatus("listening");
    engine.start();
  }, [status]);

  return { status, interim, error, progress, detail, supported, toggle };
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
