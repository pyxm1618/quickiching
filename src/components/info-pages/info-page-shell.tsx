
import type { ReactNode } from "react";
import styles from "./info-pages.module.css";

export function InfoPageShell({ title, lead, meta, variant = "standard", seoPrimary, children }: {
  title: string;
  lead?: ReactNode;
  meta?: ReactNode;
  variant?: "question" | "standard" | "help" | "legal";
  seoPrimary?: string;
  children: ReactNode;
}) {
  const content = (
    <>
      <header className={styles.heading}>
        <h1 className={styles.title}>{title}</h1>
        <span className={styles.titleStroke} aria-hidden="true" />
        {lead ? <div className={styles.lead}>{lead}</div> : null}
        {meta ? <div className={styles.meta}>{meta}</div> : null}
      </header>
      {children}
    </>
  );

  return (
    <div className={styles.page} data-info-page="true" data-info-kind={variant}>
      {seoPrimary ? (
        <article className={styles.inner} data-seo-primary={seoPrimary}>{content}</article>
      ) : (
        <div className={styles.inner}>{content}</div>
      )}
    </div>
  );
}
