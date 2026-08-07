"use client";

import { useCallback, useSyncExternalStore } from "react";

function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  return () => window.removeEventListener("storage", callback);
}

function notify() {
  window.dispatchEvent(new Event("storage"));
}

function useHydrated() {
  return useSyncExternalStore(
    useCallback(() => () => {}, []),
    () => true,
    () => false,
  );
}

export function useLocalStorage<T>(key: string, initialValue: T) {
  const getSnapshot = useCallback((): string | null => {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  }, [key]);

  const getServerSnapshot = useCallback((): string | null => null, []);

  const raw = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const hydrated = useHydrated();

  let value: T = initialValue;
  if (raw !== null) {
    try {
      value = JSON.parse(raw) as T;
    } catch {
      value = initialValue;
    }
  }

  const setValue = useCallback(
    (updater: T | ((prev: T) => T)) => {
      const next =
        typeof updater === "function"
          ? (updater as (prev: T) => T)(value)
          : updater;
      try {
        window.localStorage.setItem(key, JSON.stringify(next));
      } catch {
        // storage full or blocked
      }
      notify();
    },
    [key, value],
  );

  return [value, setValue, hydrated] as const;
}
