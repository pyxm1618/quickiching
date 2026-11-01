
import type { ReactNode } from "react";
import Image from "next/image";
import styles from "./info-pages.module.css";

export function InfoPageShell({ eyebrow, title, lead, meta, decorated = true, optimizedArtwork = false, children }: {
  eyebrow: string;
  title: string;
  lead?: ReactNode;
  meta?: ReactNode;
  decorated?: boolean;
  optimizedArtwork?: boolean;
  children: ReactNode;
}) {
  return (
    <div className={[styles.page, optimizedArtwork ? styles.pageOptimizedArtwork : ""].filter(Boolean).join(" ")} data-info-page="true">
      {optimizedArtwork ? (
        <div className={styles.pageBackgroundOptimized} aria-hidden="true">
          <Image
            src="/info-pages/shared/info-page-background.png"
            alt=""
            fill
            sizes="(max-width: 760px) 1600px, 100vw"
            priority
            fetchPriority="high"
          />
        </div>
      ) : null}
      {decorated ? optimizedArtwork ? (
        <div className={[styles.decorations, styles.decorationsOptimized].join(" ")} aria-hidden="true">
          <Image
            src="/info-pages/decorative/guide-decorations.png"
            alt=""
            width={1536}
            height={1024}
            sizes="(max-width: 1600px) 100vw, 1600px"
            priority
            fetchPriority="high"
          />
        </div>
      ) : <div className={styles.decorations} aria-hidden="true" /> : null}
      <div className={styles.inner}>
        <header className={styles.heading}>
          <p className={styles.eyebrow}>{eyebrow}</p>
          <h1 className={styles.title}>{title}</h1>
          {optimizedArtwork ? (
            <span className={[styles.titleStroke, styles.titleStrokeOptimized].join(" ")} aria-hidden="true">
              <Image
                src="/info-pages/shared/title-brush-stroke.png"
                alt=""
                fill
                sizes="(max-width: 760px) 70vw, 29rem"
                priority
              />
            </span>
          ) : <span className={styles.titleStroke} aria-hidden="true" />}
          {meta ? <div className={styles.meta}>{meta}</div> : null}
          {lead ? <div className={styles.lead}>{lead}</div> : null}
        </header>
        {children}
      </div>
    </div>
  );
}
