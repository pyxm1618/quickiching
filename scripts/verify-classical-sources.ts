import { createHash } from "node:crypto";
import { CLASSICAL_HEXAGRAMS } from "../src/domain/public-reading/classical";
import { KING_WEN_HEXAGRAMS, TRIGRAM_BITS } from "../src/domain/casting/hexagrams/king-wen";

type SourceLine = { label: string; text: string };
type SourceSnapshot = {
  number: number;
  path: string;
  revision: number;
  judgment: string;
  image: string;
  lines: SourceLine[];
  useLine?: SourceLine;
};

function expectedLineLabel(number: number, position: number): string {
  const hexagram = KING_WEN_HEXAGRAMS[number - 1];
  if (!hexagram) throw new Error(`HEXAGRAM_MISSING: ${number}`);
  const binary = (TRIGRAM_BITS[hexagram.upper] << 3) | TRIGRAM_BITS[hexagram.lower];
  const isYang = (binary & (1 << (position - 1))) !== 0;
  const prefix = position === 1 ? "初" : position === 6 ? "上" : "";
  const suffix = position === 1 || position === 6 ? "" : ["", "", "二", "三", "四", "五"][position];
  return `${prefix}${isYang ? "九" : "六"}${suffix}`;
}

function decodeHtml(value: string): string {
  return value
    .replace(/&nbsp;|&#160;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function htmlToText(html: string): string {
  return decodeHtml(html)
    .replace(/<\/(?:li|p|dt|dd|tr|h[1-6])>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n[ \t]+/g, "\n");
}

function normalizeClassicalText(value: string): string {
  return value.trim().replace(/[ \t]+/g, " ").replace(/\s*([，。；：？！])\s*/g, "$1");
}

function extractLine(plainText: string, label: string, number: number, revision: number): SourceLine {
  const match = plainText.match(new RegExp(`(?:^|\\n)[ \\t]*${label}(?:：|，)([^\\n]+)`));
  if (!match) throw new Error(`CLASSICAL_LINE_NOT_FOUND: ${number}:${label}@${revision}`);
  return { label, text: normalizeClassicalText(match[1]!) };
}

function extractSnapshot(entry: (typeof CLASSICAL_HEXAGRAMS)[number], plainText: string): SourceSnapshot {
  const revision = entry.source.textSourceRevision;
  const sourceUrl = new URL(entry.source.textSourceUrl);
  const path = sourceUrl.searchParams.get("title")?.replace(/^周易\//, "") ?? "";
  const judgmentStart = plainText.indexOf("易经：");
  const judgmentEnd = plainText.indexOf("彖曰：");
  if (judgmentStart < 0) throw new Error(`CLASSICAL_JUDGMENT_NOT_FOUND: ${entry.number}@${revision}`);
  const judgmentSection = plainText.slice(judgmentStart, judgmentEnd < 0 ? undefined : judgmentEnd);
  const judgmentSectionLines = judgmentSection
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && line !== "易经：");
  const lineLabels = Array.from({ length: 6 }, (_, index) => expectedLineLabel(entry.number, index + 1));
  if (entry.number === 1) lineLabels.push("用九");
  if (entry.number === 2) lineLabels.push("用六");
  const firstLineIndex = judgmentSectionLines.findIndex((line) =>
    lineLabels.some((label) => line.startsWith(`${label}：`) || line.startsWith(`${label}，`)),
  );
  const judgmentLines = judgmentSectionLines.slice(0, firstLineIndex < 0 ? judgmentSectionLines.length : firstLineIndex);
  if (judgmentLines.length === 0) throw new Error(`CLASSICAL_JUDGMENT_NOT_FOUND: ${entry.number}@${revision}`);

  const imageSection = plainText.slice(plainText.indexOf("象曰："));
  const imageMatch = imageSection.match(/象曰：\s*([^\n]+)/);
  if (!imageMatch) throw new Error(`CLASSICAL_IMAGE_NOT_FOUND: ${entry.number}@${revision}`);

  const lines = Array.from({ length: 6 }, (_, index) => extractLine(plainText, expectedLineLabel(entry.number, index + 1), entry.number, revision));
  const useLabel = entry.number === 1 ? "用九" : entry.number === 2 ? "用六" : undefined;
  const useLine = useLabel ? extractLine(plainText, useLabel, entry.number, revision) : undefined;

  return {
    number: entry.number,
    path,
    revision,
    judgment: normalizeClassicalText(judgmentLines.join("")),
    image: normalizeClassicalText(imageMatch[1]),
    lines,
    ...(useLine ? { useLine } : {}),
  };
}

async function fetchSnapshot(): Promise<SourceSnapshot[]> {
  const snapshots: SourceSnapshot[] = [];
  for (const entry of CLASSICAL_HEXAGRAMS) {
    const revision = entry.source.textSourceRevision;
    const sourceUrl = new URL(entry.source.textSourceUrl);
    let response: Response | undefined;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      response = await fetch(sourceUrl, { headers: { "User-Agent": "QuickIChing classical provenance verifier/1.0" } });
      if (response.ok) break;
      if (response.status !== 429 && response.status < 500) {
        throw new Error(`WIKISOURCE_HTTP_${response.status}: ${entry.number}@${revision}`);
      }
      const retryAfter = Number(response.headers.get("retry-after"));
      const delayMs = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 3000 * (attempt + 1);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
    if (!response?.ok) throw new Error(`WIKISOURCE_HTTP_RETRIES_EXHAUSTED: ${entry.number}@${revision}`);
    const html = await response.text();
    if (!new RegExp(`wgRevisionId["']?\\s*:\\s*${revision}`).test(html)) {
      throw new Error(`WIKISOURCE_REVISION_MISMATCH: ${entry.number}@${revision}`);
    }
    snapshots.push(extractSnapshot(entry, htmlToText(html)));
  }
  return snapshots;
}

function snapshotDigest(snapshots: readonly SourceSnapshot[]): string {
  return createHash("sha256").update(JSON.stringify(snapshots)).digest("hex");
}

function assertLocalMatchesRemote(snapshots: readonly SourceSnapshot[]): void {
  if (CLASSICAL_HEXAGRAMS.length !== 64 || snapshots.length !== 64) throw new Error("CLASSICAL_HEXAGRAM_COUNT_MISMATCH");
  let lineCount = 0;
  let useLineCount = 0;
  for (const snapshot of snapshots) {
    const local = CLASSICAL_HEXAGRAMS.find((entry) => entry.number === snapshot.number);
    if (!local) throw new Error(`LOCAL_HEXAGRAM_MISSING: ${snapshot.number}`);
    if (local.source.textSourceRevision !== snapshot.revision) throw new Error(`LOCAL_REVISION_MISMATCH: ${snapshot.number}`);
    if (local.judgment !== snapshot.judgment) throw new Error(`LOCAL_JUDGMENT_MISMATCH: ${snapshot.number}`);
    if (local.image !== snapshot.image) throw new Error(`LOCAL_IMAGE_MISMATCH: ${snapshot.number}`);
    const lines = (local as typeof local & { lines: readonly SourceLine[] }).lines;
    if (lines.length !== 6) throw new Error(`LOCAL_LINE_COUNT_MISMATCH: ${snapshot.number}`);
    for (let index = 0; index < snapshot.lines.length; index += 1) {
      if (lines[index]?.label !== snapshot.lines[index]?.label || lines[index]?.text !== snapshot.lines[index]?.text) {
        throw new Error(`LOCAL_LINE_MISMATCH: ${snapshot.number}:${index + 1}`);
      }
    }
    lineCount += lines.length;
    const localUseLine = (local as typeof local & { useLine?: SourceLine }).useLine;
    if (Boolean(localUseLine) !== Boolean(snapshot.useLine)) throw new Error(`LOCAL_USE_LINE_MISMATCH: ${snapshot.number}`);
    if (localUseLine && snapshot.useLine && (localUseLine.label !== snapshot.useLine.label || localUseLine.text !== snapshot.useLine.text)) {
      throw new Error(`LOCAL_USE_LINE_TEXT_MISMATCH: ${snapshot.number}`);
    }
    if (snapshot.useLine) useLineCount += 1;
  }
  if (lineCount !== 384 || useLineCount !== 2) throw new Error(`CLASSICAL_LINE_TOTAL_MISMATCH: ${lineCount}/${useLineCount}`);
}

const snapshots = await fetchSnapshot();
if (process.argv.includes("--dump-json")) {
  process.stdout.write(`${JSON.stringify(snapshots, null, 2)}\n`);
} else {
  assertLocalMatchesRemote(snapshots);
  process.stdout.write(`Fixed Wikisource source verification passed: 64/64 judgments, 64/64 images, 384/384 ordinary lines, 2/2 use lines; snapshot sha256=${snapshotDigest(snapshots)}\n`);
}
