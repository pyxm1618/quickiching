import styles from "./info-pages.module.css";

// Nine slices render the untouched source. Only the quiet middle grows with text;
// the roller caps, corners and mountain foot retain their original proportions.
export function PaperArtwork({ kind = "main" }: { kind?: "main" | "secondary" | "legal" | "toc" | "helpTop" | "helpBottom"; }) {
  const sources = {
    main: { src: "guide/guide-main-scroll.png", sliceDir: "guide/slices-main", x: 0, y: 145, width: 2172, height: 405, side: 175, top: 85, bottom: 125 },
    secondary: { src: "guide/guide-secondary-scroll.png", sliceDir: "guide/slices-secondary", x: 0, y: 229, width: 2172, height: 285, side: 130, top: 50, bottom: 110 },
    legal: { src: "legal/legal-main-paper.png", sliceDir: null, x: 8, y: 10, width: 1668, height: 915, side: 65, top: 65, bottom: 250 },
    toc: { src: "legal/legal-toc-panel.png", sliceDir: null, x: 40, y: 45, width: 807, height: 1690, side: 65, top: 90, bottom: 420 },
    helpTop: { src: "help/help-main-panel.png", sliceDir: null, x: 15, y: 20, width: 1955, height: 370, side: 105, top: 100, bottom: 120 },
    helpBottom: { src: "help/help-main-panel.png", sliceDir: null, x: 15, y: 385, width: 1955, height: 395, side: 105, top: 55, bottom: 145 },
  };
  const s = sources[kind];
  const widths = [s.side, s.width - 2 * s.side, s.side];
  const heights = [s.top, s.height - s.top - s.bottom, s.bottom];
  return <div className={styles.artwork} data-paper-artwork={kind} aria-hidden="true">
    {heights.flatMap((height, row) => widths.map((width, col) => {
      if (s.sliceDir) {
        return (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={`${row}-${col}`}
            src={`/info-pages/${s.sliceDir}/${row}-${col}.webp`}
            width={width}
            height={height}
            alt=""
            loading="lazy"
            decoding="async"
            fetchPriority="low"
          />
        );
      }
      const x = s.x + widths.slice(0, col).reduce((sum, n) => sum + n, 0);
      const y = s.y + heights.slice(0, row).reduce((sum, n) => sum + n, 0);
      const original = <image href={`/info-pages/${s.src}`} width={kind === "legal" ? 1683 : kind === "toc" ? 887 : kind.startsWith("help") ? 1983 : 2172} height={kind === "legal" ? 935 : kind === "toc" ? 1774 : kind.startsWith("help") ? 793 : 724} />;
      return <svg key={`${row}-${col}`} viewBox={`${x} ${y} ${width} ${height}`} preserveAspectRatio="none">{original}</svg>;
    }))}
  </div>;
}

export function GuideDecoration({ kind }: { kind: "coins" | "landscape" | "lantern" | "books"; }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/info-pages/decorative/${kind}.webp`}
      alt=""
      aria-hidden="true"
      className={styles.guideDecoration}
      loading="lazy"
      decoding="async"
      fetchPriority="low"
      width={170}
      height={145}
    />
  );
}
