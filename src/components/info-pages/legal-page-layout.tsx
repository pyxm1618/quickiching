
import type { ReactNode } from "react";
import { InfoPageShell } from "./info-page-shell";
import { PaperArtwork } from "./paper-artwork";
import styles from "./info-pages.module.css";

export type LegalSection = { title: string; body: ReactNode; };

function headingId(title: string) {
  return title.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

export function LegalPageLayout({ title, updated, lead, sections, intro, footer }: {
  title: string;
  updated?: ReactNode;
  lead?: ReactNode;
  sections: readonly LegalSection[];
  intro?: ReactNode;
  footer?: ReactNode;
}) {
  const hasToc = sections.length > 0;

  return (
    <InfoPageShell variant="legal" title={title} meta={updated} lead={lead}>
      <div
        className={styles.legalLayout}
        style={hasToc ? undefined : { gridTemplateColumns: "minmax(0, 1fr)" }}
      >
        {hasToc ? (
          <aside className={styles.legalToc} aria-label="On this page">
            <PaperArtwork kind="toc" />
            <h2 className={styles.tocTitle}>On this page</h2>
            <ol className={styles.tocList}>
              {sections.map((section, index) => {
                const id = headingId(section.title);
                return <li key={section.title}>
                  <a href={"#" + id}>
                    <span className={styles.tocNumber}>{index + 1}</span>
                    <span>{section.title}</span>
                  </a>
                </li>;
              })}
            </ol>
          </aside>
        ) : null}
        <article className={styles.legalPaper}>
          <PaperArtwork kind="legal" />
          {intro ? <div className={styles.legalIntro}>{intro}</div> : null}
          {sections.map((section, index) => {
            const id = headingId(section.title);
            return <section className={styles.legalSection} key={section.title}>
              <div className={styles.legalHeadingRow}>
                <span className={styles.legalNumber} aria-hidden="true">{index + 1}</span>
                <h2 className={styles.legalHeading} id={id}>{section.title}</h2>
                <span className={styles.legalRule} aria-hidden="true" />
              </div>
              <div className={styles.legalBody}>{section.body}</div>
            </section>;
          })}
          {footer ? <div className={styles.legalFooter}>{footer}</div> : null}
        </article>
      </div>
    </InfoPageShell>
  );
}
