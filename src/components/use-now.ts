"use client";

import { useEffect, useState } from "react";

/** Current time that re-renders on an interval, paused while the tab is hidden. */
export function useNow(intervalMs: number): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | undefined;
    const tick = () => setNow(Date.now());
    const start = () => {
      tick();
      clearInterval(timer);
      timer = setInterval(tick, intervalMs);
    };
    const onVisibility = () => (document.visibilityState === "visible" ? start() : clearInterval(timer));

    start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [intervalMs]);

  return now;
}
