import type { ContentLocale } from "@/i18n/config";
import type { Trigram } from "@/domain/casting/hexagrams/king-wen";
import type { ChangeRuleId } from "@/domain/interpretation/deterministic/change-rules";
import type { TiYongRelation, VerdictDirection } from "@/domain/interpretation/deterministic/ti-yong";
import {
  CHANGE_RULE_TEXT,
  DIRECTION_TEXT,
  RELATION_TEXT,
  TRIGRAM_IMAGE,
  describeChangeRule,
  describeDirection,
  describePosition,
  describeRelation,
  describeTrigram,
} from "@/domain/interpretation/deterministic/localize";

/**
 * The persisted report stores identifiers as plain strings, so a row written by
 * an older or newer engine can carry a value this build has no wording for.
 * These guards check against the localisation tables themselves — the exact
 * thing that would have to be missing — and the callers show the raw identifier
 * rather than inventing a description for it.
 */
function isChangeRuleId(value: string): value is ChangeRuleId {
  return Object.prototype.hasOwnProperty.call(CHANGE_RULE_TEXT.en, value);
}

function isRelation(value: string): value is TiYongRelation {
  return Object.prototype.hasOwnProperty.call(RELATION_TEXT.en, value);
}

function isTrigram(value: string): value is Trigram {
  return Object.prototype.hasOwnProperty.call(TRIGRAM_IMAGE.en, value);
}

function isDirection(value: string): value is VerdictDirection {
  return Object.prototype.hasOwnProperty.call(DIRECTION_TEXT.en, value);
}

export type LocalizedFact = {
  /** The identifier as stored, always shown so the rule behind the wording stays visible. */
  id: string;
  /** Localised wording, or null when this build has none for that identifier. */
  text: string | null;
};

export function changeRuleFact(ruleId: string, locale: ContentLocale): LocalizedFact {
  return { id: ruleId, text: isChangeRuleId(ruleId) ? describeChangeRule(ruleId, locale) : null };
}

export function directionFact(direction: string | null, locale: ContentLocale): LocalizedFact | null {
  if (direction === null) return null;
  return { id: direction, text: isDirection(direction) ? describeDirection(direction, locale) : null };
}

export type TiYongFact = {
  ti: LocalizedFact & { quality: string | null };
  yong: LocalizedFact & { quality: string | null };
  relation: LocalizedFact;
};

export function tiYongFact(
  tiYong: { tiTrigram: string; yongTrigram: string; relation: string } | null,
  locale: ContentLocale,
): TiYongFact | null {
  if (!tiYong) return null;

  const describe = (raw: string) => {
    if (!isTrigram(raw)) return { id: raw, text: null, quality: null };
    const { image, quality } = describeTrigram(raw, locale);
    return { id: raw, text: image, quality };
  };

  return {
    ti: describe(tiYong.tiTrigram),
    yong: describe(tiYong.yongTrigram),
    relation: { id: tiYong.relation, text: isRelation(tiYong.relation) ? describeRelation(tiYong.relation, locale) : null },
  };
}

export function linePositionFacts(
  positions: readonly number[],
  locale: ContentLocale,
): { position: number; text: string | null }[] {
  return positions.map((position) => {
    try {
      return { position, text: describePosition(position, locale) };
    } catch {
      return { position, text: null };
    }
  });
}
