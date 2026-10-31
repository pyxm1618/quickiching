import styles from "./info-pages.module.css";

// Nine slices render the untouched source. Only the quiet middle grows with text;
// the roller caps, corners and mountain foot retain their original proportions.
export function PaperArtwork({ kind = "main" }: { kind?: "main" | "secondary" | "legal" | "toc" | "helpTop" | "helpBottom"; }) {
  const sources = {
    main: { src: "guide/guide-main-scroll.png", x: 0, y: 145, width: 2172, height: 405, side: 175, top: 85, bottom: 125 },
    secondary: { src: "guide/guide-secondary-scroll.png", x: 0, y: 229, width: 2172, height: 285, side: 130, top: 50, bottom: 110 },
    legal: { src: "legal/legal-main-paper.png", x: 8, y: 10, width: 1668, height: 915, side: 65, top: 65, bottom: 250 },
    toc: { src: "legal/legal-toc-panel.png", x: 40, y: 45, width: 807, height: 1690, side: 65, top: 90, bottom: 420 },
    helpTop: { src: "help/help-main-panel.png", x: 15, y: 20, width: 1955, height: 370, side: 105, top: 100, bottom: 120 },
    helpBottom: { src: "help/help-main-panel.png", x: 15, y: 385, width: 1955, height: 395, side: 105, top: 55, bottom: 145 },
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
  const regions = { coins: "70 45 610 420", landscape: "700 40 740 450", lantern: "60 510 620 470", books: "810 540 600 430" };
  return <svg aria-hidden="true" className={styles.guideDecoration} viewBox={regions[kind]}>
    <image href="/info-pages/decorative/guide-decorations.png" width="1536" height="1024" />
  </svg>;
}
