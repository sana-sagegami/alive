import styles from "./App.module.scss";
import { EcgLine } from "./components/EcgLine/EcgLine";
import { useHeartRate } from "./hooks/useHeartRate";

const STATUS = {
  ok:   { code: 200, key: "ok"   as const, message: "Hello, I'm still here and alive!", label: "Alive" },
  warn: { code: 400, key: "warn" as const, message: "Waaaaan! Heartbeat glitching...",    label: "Weak"  },
  err:  { code: 500, key: "err"  as const, message: "Fatal error. Goodbye, world.",        label: "Unknown" },
};

function getStatus(bpm: number | null, isError: boolean) {
  if (isError)                       return STATUS.err;
  if (bpm !== null && bpm < 55)      return STATUS.warn;
  return STATUS.ok;
}

const metaValueClass: Record<"ok" | "warn" | "err", string> = {
  ok:   styles.metaValueOk,
  warn: styles.metaValueWarn,
  err:  styles.metaValueErr,
};

export default function App() {
  const { data, error } = useHeartRate();

  const isError = !!error || !data;
  const bpm = data?.bpm ?? "—";
  const status = getStatus(data?.bpm ?? null, isError);

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

      <div className={styles.statusDisplay}>
        <p className={styles.statusMessage}>{status.message}</p>
      </div>

      <div className={styles.meta}>
        <div className={styles.metaItem}>
          <span className={styles.metaLabel}>Source</span>
          <span className={styles.metaValue}>Oura Ring 4</span>
        </div>
        <div className={styles.metaItem}>
          <span className={styles.metaLabel}>Status</span>
          <span className={`${styles.metaValue} ${metaValueClass[status.key]}`}>
            {status.label}
          </span>
        </div>
      </div>

      <span className={styles.byline}>alive.bysana.me</span>
    </main>
  );
}
