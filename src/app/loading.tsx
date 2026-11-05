import Image from "next/image";
import styles from "./loading.module.css";

export default function Loading() {
  return (
    <div className={styles.screen} role="status" aria-live="polite">
      <div className={styles.content}>
        <div className={styles.emblem} aria-hidden="true">
          <Image
            src="/hexagram-detail/delivery/taiji-290.avif"
            alt=""
            width={150}
            height={150}
            priority
            unoptimized
            className={styles.taiji}
          />
        </div>
        <h1 className={styles.title}>Preparing Your Experience</h1>
        <div className={styles.rule} aria-hidden="true" />
        <p className={styles.description}>
          One moment while Quick I Ching prepares the next step.
        </p>
      </div>
    </div>
  );
}
