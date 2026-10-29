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
    q^