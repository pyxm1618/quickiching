"use client";

import Link from "next/link";
import React, { useEffect, useMemo, useState } from "react";
import { HexagramLines } from "@/components/hex/hexagram-lines";
import { EN_UI_DICTIONARY } from "@/i18n/dictionaries/en";
import type { UiDictionary } from "@/i18n/dictionaries/types";
import { loadHexagramInterpretation } from "@/domain/interpretation/v2/load-interpretation";
import type { HexagramInterpretationBundle } from "@/domain/interpretation/v2/types";
import type { LocalizedReadingContent } from "@/content/mei-hua-yi-shu/types";
import { buildStaticReading } from "@/domain/public-reading/static-reading";
import { saveHistoryRecord } from "@/domain/public-reading/history";
import { readingFingerprint } from "@/domain/public-reading/reading";
import type { PublicReading } from "@/domain/public-reading/types";
import { writeCompletedPublicReading } from "@/lib/completed-public-reading";
import { FreeReadingRitualView } from "./free-reading-ritual-view";

function relatingLines(reading: PublicReading): number[] {
  return reading.lineValuesBottomUp.map((value) => value === 6 ? 7 : value === 9 ? 8 : value);
}

function formatCopy(template: string, values: Record<string, string | number>): string {
  return Object.entries(values).reduce((result, [key, value]) => result.replaceAll(`{${key}}`, String(value)), template);
}

const METHOD_NAMES_ZH: Record<string, string> = {
  "three-coin": "三枚铜钱",
  "yarrow": "蓍草起卦",
  "yarrow-stalks": "蓍草起卦",
  ���q�^