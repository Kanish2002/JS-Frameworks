import { useCallback, useState } from "react";

export function usePersistentState<T>(key: string, initialValue: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const stored = window.localStorage.getItem(key);
      return stored ? (JSON.parse(stored) as T) : initialValue;
    } catch {
      return initialValue;
    }
  });

  const setPersistentValue = useCallback(
    (nextValue: T | ((current: T) => T)) => {
      setValue((current) => {
        const resolved = typeof nextValue === "function"
          ? (nextValue as (current: T) => T)(current)
          : nextValue;
        try {
          window.localStorage.setItem(key, JSON.stringify(resolved));
        } catch {
          // The editor remains usable if storage is unavailable or full.
        }
        return resolved;
      });
    },
    [key],
  );

  return [value, setPersistentValue] as const;
}
