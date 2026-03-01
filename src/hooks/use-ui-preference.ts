"use client";

import { useEffect, useState } from "react";

export function useUiPreference(key: string, defaultValue: boolean) {
  const [value, setValue] = useState(defaultValue);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(key);
      if (saved === "1") {
        setValue(true);
      } else if (saved === "0") {
        setValue(false);
      }
    } catch {
      // ignore storage failures
    }
  }, [key]);

  useEffect(() => {
    try {
      window.localStorage.setItem(key, value ? "1" : "0");
    } catch {
      // ignore storage failures
    }
  }, [key, value]);

  return [value, setValue] as const;
}
