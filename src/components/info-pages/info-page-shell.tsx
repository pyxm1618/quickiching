
import type { ReactNode } from "react";
import styles from "./info-pages.module.css";

export function InfoPageShell({ title, lead, meta, variant = "standard", children }: {
  title: string;
  lead?: ReactNode;
  meta?: ReactNode;
  variant?: "question" | "standard" | "help" | "legal";
  children: ReactNode;
}) {
  return (
    <div className={styles.page} data-info-page="true" data-info-kind={variant}>
      <div className={styles.inner}>
        <header className={styles.heading}>
          <h1 className={styles.title}>{title}</h1>
          <span className={styles.titleStroke} aria-hidden="true" />
          {lead ? <div className={styles.lead}>{lead}</div> : null}
          {meta ? <div className={styles.meta}>{meta}</div> : null}
        </header>
        {children}
      </div>
    </div>
  );
}
