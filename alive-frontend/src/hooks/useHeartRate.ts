import { useState, useEffect } from "react";

const WORKER_URL = import.meta.env.VITE_WORKER_URL;
const POLL_INTERVAL = 60_000;

interface HeartRateData {
  bpm: number;
  timestamp: string;
}

export function useHeartRate() {
  const [data, setData] = useState<HeartRateData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastFetched, setLastFetched] = useState<Date | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const res = await fetch(WORKER_URL);
        if (!res.ok) throw new Error("fetch failed");
        const json = await res.json();
        if (cancelled) return;
        if (json.heartrate) {
          setData(json.heartrate);
          setLastFetched(new Date());
          setError(null);
        } else {
          setData(null);
          setError(json.error_reason ?? "no data");
        }
      } catch {
        if (!cancelled) setError("signal lost");
      }
    }

    poll();
    const id = setInterval(poll, POLL_INTERVAL);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  return { data, error, lastFetched };
}
