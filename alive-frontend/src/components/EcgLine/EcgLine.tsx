import styles from "./EcgLine.module.scss";

export function EcgLine() {
  return (
    <div className={styles.wrap}>
      <svg viewBox="0 0 560 70" xmlns="http://www.w3.org/2000/svg" width="100%">
        <line x1="0" y1="35" x2="560" y2="35" stroke="#1A1A1A" strokeWidth="0.5" />
        <path
          className={styles.line}
          d="M0,35 L60,35 L82,20 L90,50 L100,5 L110,60 L118,35 L130,35
             L190,35 L212,20 L220,50 L230,5 L240,60 L248,35 L260,35
             L320,35 L342,20 L350,50 L360,5 L370,60 L378,35 L390,35
             L450,35 L472,20 L480,50 L490,5 L500,60 L508,35 L560,35"
          fill="none"
          stroke="#E24B4A"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}
