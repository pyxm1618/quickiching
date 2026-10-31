"use client";

import Link from "next/link";
import React from "react";
import { Lightbulb, ListChecks, UserRound } from "lucide-react";
import { HexagramLines } from "@/components/hex/hexagram-lines";
import type { UiDictionary } from "@/i18n/dictionaries/types";
import type { PublicStaticReading } from "@/domain/public-reading/static-reading";
import type { PublicReading } from "@/domain/public-reading/types";
import styles from "./free-reading-ritual-view.module.css";

const A = {
  hero: ["/free-reading/runtime/hero-desktop.webp", "/free-reading/runtime/hero-mobile.jpg", "image/webp"],
  overall: ["/free-reading/runtime/overall-desktop.avif", "/free-reading/runtime/overall-mobile.avif", "image/avif"],
  primary: ["/free-reading/runtime/primary-desktop.avif", "/free-reading/runtime/primary-mobile.avif", "image/avif"],
  relating: ["/free-reading/runtime/relating-desktop.avif", "/free-reading/runtime/relating-mobile.avif", "image/avif"],
  changing: ["/free-reading/runtime/changing-desktop.avif", "/free-reading/runtime/changing-mobile.avif", "image/avif"],
  transition: ["/free-reading/runtime/transition-desktop.avif", "/free-reading/runtime/transition-mobile.avif", "image/avif"],
  bottom: ["/free-reading/runtime/bottom-desktop.avif", "/free-reading/runtime/bottom-mobile.avif", "image/avif"],
} as const;

function relatingLines(reading: PublicReading): number[] {
  return reading.lineValuesBottomUp.map((v) => v === 6 ? 7 : v === 9 ? 8 : v);
}

function Art({
  asset, class¶»§q«^