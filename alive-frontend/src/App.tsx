import styles from "./App.module.scss";
import { EcgLine } from "./components/EcgLine/EcgLine";
import { useHeartRate } from "./hooks/useHeartRate";

function formatAgo(date: Date | null): string {
  if (!date) return "—";
  const secs = Math.floor((Date.now() - date.getTime()) / 1000);
  if (secs < 60) return `${secs}s ago`;
  return `${Math.floor(secs / 60)}m ago`;
}

function getTagline(bpm: number | null, isError: boolean): string {
  if (isError) return "500: Fatal error. Goodbye, world.";
  if (bpm !== null && bpm < 55) return "400: Waaaaan! Heartbeat glitching...";
  return "200: All systems green. Heartbeat: True.";
}

export default function App() {
  const { data, error, lastFetched } = useHeartRate();

  const isError = !!error || !data;
  const bpm = data?.bpm ?? "—";

  return (
    <main className={styles.root}>
      <EcgLine />

      <div className={styles.statusRow}>
        <div className={`${styles.dot} ${isError ? styles.error : ""}`} />
        <span className={`${styles.statusLabel} ${isError ? styles.error : ""}`}>
          {isError ? "no signal" : "Live · Oura Ring"}
        </span>
      </div>

      <div className={styles.bpmWrap}>
        <div className={styles.ring} />
        <div className={styles.ring} />
        <div className={styles.ring} />
        <span className={`${styles.bpm} ${isError ? styles.error : ""}`}>{bpm}</span>
        <span className={styles.unit}>bpm</span>
      </div>

      <p className={styles.tagline}>{getTagline(data?.bpm ?? null, isError)}</p>

      <div className={styles.meta}>
        <div className={styles.metaItem}>
          <span className={styles.metaLabel}>Updated</span>
          <span className={styles.metaValue}>{formatAgo(lastFetched)}</span>
        </div>
        <div className={styles.metaItem}>
          <span className={styles.metaLabel}>Source</span>
          <span className={styles.metaValue}>Oura Ring 4</span>
        </div>
        <div className={styles.metaItem}>
          <span className={styles.metaLabel}>Status</span>
          <span className={styles.metaValue} style={{ color: isError ? "#333" : "#4A7A3F" }}>
            {isError ? "unknown" : "Alive"}
          </span>
        </div>
      </div>

      <span className={styles.byline}>alive.bysana.me</span>
    </main>
  );
}
