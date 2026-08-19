import { classicalHexagramByNumber } from "./classical";
import { buildPublicReading } from "./reading";
import { normalizePublicQuestion } from "./question";
import { PUBLIC_METHOD_VERSIONS, PUBLIC_READING_METHODS, type PublicReading, type PublicReadingMethod, type PublicLineTuple } from "./types";

export const HISTORY_SCHEMA_VERSION = 1 as const;
export const HISTORY_STORAGE_KEY = "quickiching:public-history:v1";
export const HISTORY_MAX_RECORDS = 50;

export type PublicHistoryRecord = {
  schemaVersion: typeof HISTORY_SCHEMA_VERSION;
  id: string;
  title: string;
  question?: string;
  createdAt: string;
  updatedAt: string;
  method: PublicReadingMethod;
  methodVersion: string;
  lineValuesBottomUp: PublicLineTuple;
  primaryHexagram: number;
  changingLines: readonly number[];
  relatingHexagram: number | null;
};

function storage(): Storage {
  if (typeof window === "undefined" || !window.localStorage) throw new Error("HISTORY_STORAGE_UNAVAILABLE");
  return window.localStorage;
}

function isLineTuple(value: unknown): value is PublicLineTuple {
  return Array.isArray(value)
    && value.length === 6
    && value.every((line) => line === 6 || line === 7 || line === 8 || line === 9);
}

function isHistoryRecord(value: unknown): value is PublicHistoryRecord {
  if (!value || typeof value !== "object") return false;
  const record = value as Partial<PublicHistoryRecord>;
  const method = record.method;
  const primaryHexagram = record.primaryHexagram;
  const relatingHexagram = record.relatingHexagram;
  let questionValid = true;
  try {
    normalizePublicQuestion(record.question);
  } catch {
    questionValid = false;
  }
  const changingLines = record.changingLines;
  const changingLinesValid = Array.isArray(changingLines)
    && changingLines.every((line) => Number.isInteger(line) && line >= 1 && line <= 6)
    && new Set(changingLines).size === changingLines.length
    && changingLines.every((line, index) => index === 0 || line > changingLines[index - 1]!);
  return record.schemaVersion === HISTORY_SCHEMA_VERSION
    && typeof record.id === "string"
    && record.id.trim().length > 0
    && typeof record.title === "string"
    && record.title.trim().length > 0
    && typeof record.createdAt === "string"
    && typeof record.updatedAt === "string"
    && typeof method === "string"
    && PUBLIC_READING_METHODS.includes(method as PublicReadingMethod)
    && method in PUBLIC_METHOD_VERSIONS
    && record.methodVersion === PUBLIC_METHOD_VERSIONS[method as PublicReadingMethod]
    && typeof record.methodVersion === "string"
    && isLineTuple(record.lineValuesBottomUp)
    && typeof primaryHexagram === "number" && Number.isInteger(primaryHexagram) && primaryHexagram >= 1 && primaryHexagram <= 64
    && changingLinesValid
    && (relatingHexagram === null || (typeof relatingHexagram === "number" && Number.isInteger(relatingHexagram) && relatingHexagram >= 1 && relatingHexagram <= 64))
    && questionValid;
}

function writeRecords(records: readonly PublicHistoryRecord[]): void {
  try {
    storage().setItem(HISTORY_STORAGE_KEY, JSON.stringify(records.slice(0, HISTORY_MAX_RECORDS)));
  } catch {
    throw new Error("HISTORY_STORAGE_QUOTA");
  }
}

export function readHistoryRecords(): PublicHistoryRecord[] {
  let raw: string | null;
  try {
    raw = storage().getItem(HISTORY_STORAGE_KEY);
  } catch (error: unknown) {
    if (error instanceof Error && error.message === "HISTORY_STORAGE_UNAVAILABLE") throw error;
    throw new Error("HISTORY_STORAGE_UNAVAILABLE");
  }
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isHistoryRecord).slice(0, HISTORY_MAX_RECORDS);
  } catch {
    return [];
  }
}

function defaultTitle(reading: PublicReading): string {
  const hexagram = classicalHexagramByNumber(reading.primaryHexagram);
  return `${hexagram.chineseName} · ${hexagram.englishName}`;
}

export function historyRecordFromReading(reading: PublicReading, title = defaultTitle(reading)): PublicHistoryRecord {
  const now = new Date().toISOString();
  return {
    schemaVersion: HISTORY_SCHEMA_VERSION,
    id: reading.id,
    title: title.trim() || defaultTitle(reading),
    ...(reading.question ? { question: reading.question } : {}),
    createdAt: reading.createdAt,
    updatedAt: now,
    method: reading.method,
    methodVersion: reading.methodVersion,
    lineValuesBottomUp: reading.lineValuesBottomUp,
    primaryHexagram: reading.primaryHexagram,
    changingLines: reading.changingLines,
    relatingHexagram: reading.relatingHexagram,
  };
}

export function saveHistoryRecord(reading: PublicReading, title?: string): PublicHistoryRecord {
  const currentRecords = readHistoryRecords();
  const existing = currentRecords.find((record) => record.id === reading.id);
  const record = historyRecordFromReading(reading, title ?? existing?.title);
  const records = currentRecords.filter((candidate) => candidate.id !== record.id);
  writeRecords([record, ...records]);
  return record;
}

export function renameHistoryRecord(id: string, title: string): PublicHistoryRecord[] {
  const normalized = title.trim();
  if (!normalized) throw new Error("HISTORY_TITLE_REQUIRED");
  const records = readHistoryRecords();
  const updated = records.map((record) => record.id === id ? { ...record, title: normalized, updatedAt: new Date().toISOString() } : record);
  writeRecords(updated);
  return updated;
}

export function deleteHistoryRecord(id: string): PublicHistoryRecord[] {
  const updated = readHistoryRecords().filter((record) => record.id !== id);
  writeRecords(updated);
  return updated;
}

export function publicReadingFromHistory(record: PublicHistoryRecord): PublicReading {
  const reading = buildPublicReading({
    id: record.id,
    createdAt: record.createdAt,
    method: record.method,
    methodVersion: record.methodVersion,
    question: normalizePublicQuestion(record.question),
    lineValuesBottomUp: record.lineValuesBottomUp,
    evidence: { kind: "history", originalMethod: record.method },
  });
  if (reading.primaryHexagram !== record.primaryHexagram
    || JSON.stringify(reading.changingLines) !== JSON.stringify(record.changingLines)
    || reading.relatingHexagram !== record.relatingHexagram) {
    throw new Error("HISTORY_RECORD_FACTS_MISMATCH");
  }
  return reading;
}
