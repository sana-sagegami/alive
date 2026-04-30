import { useState, useEffect, useCallback } from "react";

const WORKER_URL = import.meta.env.VITE_WORKER_URL;
const POLL_INTERVAL = 60_000; // 1分ごとにポーリング

interface HeartRateData {
  bpm: number;
  timestamp: string;
}

export function useHeartRate() {
  const [data, setData] = useState<HeartRateData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastFetched, setLastFetched] = useState<Date | null>(null);

  const fetch_ = useCallback(async () => {
    try {
      const res = await fetch(WORKER_URL);
      if (!res.ok) throw new Error("fetch failed");
      const json = await res.json();
      if (json.heartrate) {
        setData(json.heartrate);
        setLastFetched(new Date());
        setError(null);
      }
    } catch {
      setError("signal lost");
    }
  }, []);

  useEffect(() => {
    const id = setInterval(fetch_, POLL_INTERVAL);
    return () => clearInterval(id);
  }, [fetch_]);

  return { data, error, lastFetched };
}
