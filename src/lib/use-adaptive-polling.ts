"use client";

import { useEffect, useRef } from "react";

type AdaptivePollingOptions = {
  enabled?: boolean;
  isRealtimeHealthy: boolean;
  healthyIntervalMs: number;
  unhealthyIntervalMs: number;
  pollKey: string;
  poll: () => Promise<void> | void;
};

function nextDelay(baseDelay: number, failureCount: number) {
  if (failureCount < 3) return baseDelay;
  return Math.min(baseDelay * 2 ** (failureCount - 2), 30_000);
}

export function useAdaptivePolling({
  enabled = true,
  isRealtimeHealthy,
  healthyIntervalMs,
  unhealthyIntervalMs,
  pollKey,
  poll
}: AdaptivePollingOptions) {
  const pollRef = useRef(poll);

  useEffect(() => {
    pollRef.current = poll;
  }, [poll]);

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;
    let timer: number | null = null;
    let failureCount = 0;
    const baseDelay = isRealtimeHealthy ? healthyIntervalMs : unhealthyIntervalMs;

    const clearTimer = () => {
      if (timer !== null) {
        window.clearTimeout(timer);
        timer = null;
      }
    };

    const schedule = () => {
      clearTimer();
      if (cancelled || document.visibilityState === "hidden") return;
      timer = window.setTimeout(() => {
        void run();
      }, nextDelay(baseDelay, failureCount));
    };

    const run = async () => {
      if (cancelled || document.visibilityState === "hidden") return;
      try {
        await pollRef.current();
        failureCount = 0;
      } catch {
        failureCount += 1;
      } finally {
        schedule();
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        clearTimer();
        return;
      }
      void run();
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    void run();

    return () => {
      cancelled = true;
      clearTimer();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [enabled, healthyIntervalMs, unhealthyIntervalMs, isRealtimeHealthy, pollKey]);
}
