
import type { ReactNode } from "react";
import styles from "./info-pages.module.css";

export function InfoPageShell({ eyebrow, title, lead, meta, decorated = true, children }: {
  eyebrow: string;
  title: string;
  lead?: ReactNode;
  meta?: ReactNode;
  decorated?: boolean;
  children: ReactNode;
}) {
  return (
    <div className={styles.page} data-info-page="true">
      {decorated ? <div className={styles.decorations} aria-hidden="true" /> : null}
      <div className={styles.inner}>
        <header className={styles.heading}>
          <p className={styles.eyebrow}>{eyebrow}</p>
          <h1 className={styles.title}>{title}</h1>
          <span className={styles.titleStroke} aria-hidden="true" />
          {meta ? <div className={styles.meta}>{meta}</div> : null}
          {lead ? <div className={styles.lead}>{lead}</div> : null}
        </header>
        {children}
      </div>
    </div>
  );
}
