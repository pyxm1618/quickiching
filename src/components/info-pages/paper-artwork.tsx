import styles from "./info-pages.module.css";

// Nine slices render the untouched source. Only the quiet middle grows with text;
// the roller caps, corners and mountain foot retain their original proportions.
export function PaperArtwork({ kind = "main" }: { kind?: "main" | "secondary" | "legal" | "toc" | "helpTop" | "helpBottom"; }) {
  const sources = {
    main: { src: "runtime/guide/guide-main-scroll.webp", x: 0, y: 145, width: 2172, height: 405, side: 175, top: 85, bottom: 125 },
    secondary: { src: "runtime/guide/guide-secondary-scroll.webp", x: 0, y: 229, width: 2172, height: 285, side: 130, top: 50, bottom: 110 },
    legal: { src: "runtime/legal/legal-main-paper.webp", x: 8, y: 10, width: 1668, height: 915, side: 65, top: 65, bottom: 250 },
    toc: { src: "runtime/legal/legal-toc-panel.webp", x: 40, y: 45, width: 807, height: 1690, side: 65, top: 90, bottom: 420 },
    helpTop: { src: "runtime/help/help-main-panel.webp", x: 15, y: 20, width: 1955, height: 370, side: 105, top: 100, bottom: 120 },
    helpBottom: { src: "runtime/help/help-main-panel.webp", x: 15, y: 385, width: 1955, height: 395, side: 105, top: 55, bottom: 145 },
  };
  const s = sources[kind];
  const widths = [s.side, s.width - 2 * s.side, s.side];
  const heights = [s.top, s.height - s.top - s.bottom, s.bottom];
  return <div className={styles.artwork} data-paper-artwork={kind} aria-hidden="true">
    {heights.flatMap((height, row) => widths.map((width, col) => {
      const x = s.x + widths.slice(0, col).reduce((sum, n) => sum + n, 0);
      const y = s.y + heights.slice(0, row).reduce((sum, n) => sum + n, 0);
      const original = <image href={`/info-pages/${s.src}`} width={kind === "legal" ? 1683 : kind === "toc" ? 887 : kind.startsWith("help") ? 1983 : 2172} height={kind === "legal" ? 935 : kind === "toc" ? 1774 : kind.startsWith("help") ? 793 : 724} />;
      return <svg key={`${row}-${col}`} viewBox={`${x} ${y} ${width} ${height}`} preserveAspectRatio="none">{original}</svg>;
    }))}
  </div>;
}

export function GuideDecoration({ kind }: { kind: "coins" | "landscape" | "lantern" | "books"; }) {
  return <img
    aria-hidden="true"
    alt=""
    className={styles.guideDecoration}
    src={`/info-pages/decorative/${kind}.webp`}
    width="170"
    height="145"
    loading="lazy"
    decoding="async"
    fetchPriority="low"
  />;
}
