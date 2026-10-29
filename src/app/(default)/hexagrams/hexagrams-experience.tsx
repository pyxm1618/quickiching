"use client";

import React, { useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent, type WheelEvent } from "react";
import Link from "next/link";
import { UserNavControl } from "@/components/auth/user-nav-control";
import { TRIGRAM_BITS, type Trigram } from "@/domain/casting/hexagrams/king-wen";
import styles from "./hexagrams.module.css";

type HexagramItem = {
  number: number;
  englishName: string;
  slug: string;
  lower: Trigram;
  upper: Trigram;
  primaryKeyword: string;
};

type Props = { hexagrams: HexagramItem[]; authEnabled: boolean };
type CssVars = CSSProperties & Record<string, string | number>;

const GRID_CORNERS = {
  tl: { x: 14.71, y: 11.52 },
  tr: { x: 78.06, y: 13.28 },
  bl: { x: 15.63, y: 84.57 },
  br: { x: 85.29, y: 84.96 },
} as const;

const DRAG_STEP_PX = 58;
const WHEEL_THROTTLE_MS = 260;

function wrapIndex(index: number, length: number): number {
  return ((index % length) + length) % length;
}

function shortestOffset(index: number, selectedIndex: number, length: number): number {
  let delta = index - selectedIndex;
  const half = length / 2;
  if (delta > half) delta -= length;
  if (delta < -half) delta += length;
  return delta;
}

function linesFor(lower: Trigram, upper: Trigram): boolean[] {
  const lowerBits = TRIGRAM_BITS[lower];
  const upperBits = TRIGRAM_BITS[upper];
  return [
    Boolean(upperBits & 0b100),
    Boolean(upperBits & 0b010),
    Boolean(upperBits & 0b001),
    Boolean(lowerBits & 0b100),
    Boolean(lowerBits & 0b010),
    Boolean(lowerBits & 0b001),
  ];
}

function HexagramGlyph({ item, compact = false }: { item: HexagramItem; compact?: boolean }) {
  const lines = useMemo(() => linesFor(item.lower, item.upper), [item.lower, item.upper]);
  return (
    <span
      className={compact ? styles.glyphCompact : styles.glyph}
      role="img"
      aria-label={"Six-line figure for Hexagram " + item.number + ": " + item.englishName}
    >
      {lines.map((yang, index) => (
        <span key={index} className={styles.line} aria-hidden="true">
          {yang ? (
            <span className={styles.yang} />
          ) : (
            <>
              <span className={styles.yinHalf} />
              <span className={styles.yinGap} />
              <span className={styles.yinHalf} />
            </>
          )}
        </span>
      ))}
    </span>
  );
}

function gridPosition(row: number, column: number): { x: number; y: number } {
  const u = (column + 0.5) / 8;
  const v = (row + 0.5) / 8;
  const topX = GRID_CORNERS.tl.x + (GRID_CORNERS.tr.x - GRID_CORNERS.tl.x) * u;
  const bottomX = GRID_CORNERS.bl.x + (GRID_CORNERS.br.x - GRID_CORNERS.bl.x) * u;
  const topY = GRID_CORNERS.tl.y + (GRID_CORNERS.tr.y - GRID_CORNERS.tl.y) * u;
  const bottomY = GRID_CORNERS.bl.y + (GRID_CORNERS.br.y - GRID_CORNERS.bl.y) * u;
  return { x: topX + (bottomX - topX) * v, y: topY + (bottomY - topY) * v };
}

function wheelStyle(offset: number): CssVars {
  const distance = Math.abs(offset);
  const direction = offset === 0 ? 0 : Math.sign(offset);
  const x = Math.tanh(distance / 4.5) * 75 * direction;
  const y = -Math.pow(distance, 1.45) * 1.85;
  const z = -Math.pow(distance, 1.4) * 35;
  return {
    "--wheel-x": x + "%",
    "--wheel-y": y + "%",
    "--wheel-z": z + "px",
    "--wheel-rotate": offset * -9.5 + "deg",
    "--wheel-scale": Math.max(0.54, 1 - distance * 0.052),
    "--wheel-opacity": distance <= 2 ? 1 : Math.max(0.16, 1 - (distance - 2) * 0.115),
    zIndex: 120 - distance,
  };
}

export function HexagramsExperience({ hexagrams, authEnabled }: Props) {
  const [selectedHexagram, setSelectedHexagram] = useState<HexagramItem>(() => hexagrams[0]);
  const selectedIndex = Math.max(0, hexagrams.findIndex((item) => item.number === selectedHexagram.number));
  const dragRef = useRef<{ pointerId: number; startX: number; lastX: number; moved: boolean } | null>(null);
  const suppressClickUntilRef = useRef(0);
  const lastWheelAtRef = useRef(0);

  useEffect(() => {
    const body = document.body;
    const main = document.querySelector<HTMLElement>("body > main");
    const siteHeader = document.querySelector<HTMLElement>("body > header");
    const siteFooter = document.querySelector<HTMLElement>("body > footer");

    const previous = {
      bodyOverflow: body.style.overflow,
      bodyBackground: body.style.background,
      mainHeight: main?.style.height ?? "",
      mainMinHeight: main?.style.minHeight ?? "",
      mainOverflow: main?.style.overflow ?? "",
      headerDisplay: siteHeader?.style.display ?? "",
      footerDisplay: siteFooter?.style.display ?? "",
    };

    body.style.overflow = "hidden";
    body.style.background = "#100b07";
    if (main) {
      main.style.height = "100dvh";
      main.style.minHeight = "100dvh";
      main.style.overflow = "hidden";
    }
    if (siteHeader) siteHeader.style.display = "none";
    if (siteFooter) siteFooter.style.display = "none";

    return () => {
      body.style.overflow = previous.bodyOverflow;
      body.style.background = previous.bodyBackground;
      if (main) {
        main.style.height = previous.mainHeight;
        main.style.minHeight = previous.mainMinHeight;
        main.style.overflow = previous.mainOverflow;
      }
      if (siteHeader) siteHeader.style.display = previous.headerDisplay;
      if (siteFooter) siteFooter.style.display = previous.footerDisplay;
    };
  }, []);

  const selectByIndex = (index: number) => {
    const next = hexagrams[wrapIndex(index, hexagrams.length)];
    if (next) setSelectedHexagram(next);
  };

  const stepSelection = (delta: number) => selectByIndex(selectedIndex + delta);

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 && event.pointerType === "mouse") return;
    dragRef.current = { pointerId: event.pointerId, startX: event.clientX, lastX: event.clientX, moved: false };
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const fromStart = event.clientX - drag.startX;
    if (!drag.moved && Math.abs(fromStart) >= 6) {
      drag.moved = true;
      event.currentTarget.setPointerCapture(event.pointerId);
      event.currentTarget.dataset.dragging = "true";
    }
    if (!drag.moved) return;
    const dx = event.clientX - drag.lastX;
    if (Math.abs(dx) < DRAG_STEP_PX) return;
    const steps = Math.max(1, Math.floor(Math.abs(dx) / DRAG_STEP_PX));
    stepSelection(dx < 0 ? steps : -steps);
    drag.lastX = event.clientX;
  };

  const finishPointer = (event: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (drag.moved) suppressClickUntilRef.current = performance.now() + 320;
    dragRef.current = null;
    event.currentTarget.dataset.dragging = "false";
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };

  const handleWheel = (event: WheelEvent<HTMLDivElement>) => {
    const now = performance.now();
    if (now - lastWheelAtRef.current < WHEEL_THROTTLE_MS) return;
    const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
    if (Math.abs(delta) < 4) return;
    event.preventDefault();
    lastWheelAtRef.current = now;
    stepSelection(delta > 0 ? 1 : -1);
  };

  return (
    <article className={styles.scene} data-hexagrams-immersive-page aria-labelledby="hexagrams-title">
      <div className={styles.sceneShade} aria-hidden="true" />

      <div className={styles.chrome} aria-label="Page controls">
        <Link href="/zh/hexagrams" className={styles.languageControl} aria-label="Switch language">EN</Link>
        {authEnabled && <UserNavControl locale="en" />}
      </div>

      <header className={styles.titleBlock}>
        <h1 id="hexagrams-title">64 I Ching Hexagrams</h1>
        <p>Browse all 64 hexagrams and open any one to explore its meaning.</p>
      </header>

      <section className={styles.scrollStage} aria-label="All 64 hexagrams in King Wen order">
        <img src="/hexagrams/scroll-grid.png" alt="" className={styles.scrollImage} draggable={false} />
        <ol className={styles.scrollGrid}>
          {hexagrams.map((item, index) => {
            const position = gridPosition(Math.floor(index / 8), index % 8);
            const selected = item.number === selectedHexagram.number;
            const style = { "--cell-x": position.x + "%", "--cell-y": position.y + "%" } as CssVars;
            return (
              <li key={item.number} className={styles.scrollCellSlot} style={style}>
                <button
                  type="button"
                  className={styles.scrollCell + (selected ? " " + styles.scrollCellSelected : "")}
                  aria-pressed={selected}
                  aria-label={"Select Hexagram " + item.number + ": " + item.englishName}
                  onClick={() => setSelectedHexagram(item)}
                >
                  <span className={styles.scrollNumber}>{String(item.number).padStart(2, "0")}</span>
                  <HexagramGlyph item={item} compact />
                  <span className={styles.scrollName}>{item.englishName}</span>
                </button>
              </li>
            );
          })}
        </ol>
      </section>

      <section className={styles.wheelStage} aria-label="Rotating 64-hexagram wheel">
        <img src="/hexagrams/ritual-platform.png" alt="" className={styles.platform} draggable={false} />
        <div
          className={styles.wheelInteraction}
          role="group"
          aria-label="Drag or scroll horizontally to rotate through all 64 hexagrams"
          tabIndex={0}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={finishPointer}
          onPointerCancel={finishPointer}
          onWheel={handleWheel}
          onKeyDown={(event) => {
            if (event.key === "ArrowRight") {
              event.preventDefault();
              stepSelection(1);
            } else if (event.key === "ArrowLeft") {
              event.preventDefault();
              stepSelection(-1);
            }
          }}
        >
          <div className={styles.cardRing}>
            {hexagrams.map((item, index) => {
              const offset = shortestOffset(index, selectedIndex, hexagrams.length);
              const selected = offset === 0;
              const nearby = Math.abs(offset) <= 9;
              const className =
                styles.wheelCard +
                (selected ? " " + styles.wheelCardSelected : "") +
                (nearby ? "" : " " + styles.wheelCardFar);
              return (
                <Link
                  key={item.number}
                  href={"/hexagrams/" + item.slug}
                  data-seo-inbound-anchor={item.primaryKeyword}
                  className={className}
                  style={wheelStyle(offset)}
                  aria-current={selected ? "true" : undefined}
                  aria-label={(selected ? "Open Hexagram " : "Select Hexagram ") + item.number + ": " + item.englishName}
                  tabIndex={nearby ? 0 : -1}
                  onClick={(event) => {
                    if (performance.now() < suppressClickUntilRef.current) {
                      event.preventDefault();
                      return;
                    }
                    if (!selected) {
                      event.preventDefault();
                      setSelectedHexagram(item);
                    }
                  }}
                >
                  <img src="/hexagrams/card-frame.png" alt="" className={styles.cardFrame} draggable={false} />
                  <span className={styles.cardContent}>
                    <span className={styles.cardNumber}>{String(item.number).padStart(2, "0")}</span>
                    <HexagramGlyph item={item} />
                    <span className={styles.cardName}>{item.englishName}</span>
                  </span>
                  <span className={styles.srOnly}>{item.primaryKeyword}</span>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      <Link href="/" data-seo-home-link="/" tabIndex={-1} aria-hidden="true" className={styles.srOnly}>
        I Ching online tool
      </Link>
    </article>
  );
}
