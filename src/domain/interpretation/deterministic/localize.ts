import type { ContentLocale } from "@/i18n/config";
import type { Trigram } from "@/domain/casting/hexagrams/king-wen";
import type { ChangeRuleId } from "./change-rules";
import type { TiYongRelation, VerdictDirection } from "./ti-yong";

// Presentation layer for the deterministic engine. The engine itself returns
// identifiers only, so adding a language means adding entries here and never
// touching the classical rules.

type LocaleTable<K extends string> = Record<ContentLocale, Record<K, string>>;

export const CHANGE_RULE_TEXT: LocaleTable<ChangeRuleId> = {
  "zh-Hans": {
    no_moving: "六爻不变，占本卦卦辞",
    one_moving: "一爻变，占本卦变爻爻辞",
    two_moving: "二爻变，占本卦二变爻爻辞，以上爻为主",
    three_moving: "三爻变，占本卦及之卦卦辞，以本卦为主",
    four_moving: "四爻变，占之卦二不变爻爻辞，以下爻为主",
    five_moving: "五爻变，占之卦不变爻爻辞",
    six_moving_qian: "乾卦六爻皆变，占用九",
    six_moving_kun: "坤卦六爻皆变，占用六",
    six_moving_other: "六爻皆变，占之卦卦辞",
  },
  en: {
    no_moving: "No line moves: read the judgment of the primary hexagram",
    one_moving: "One line moves: read that line's text in the primary hexagram",
    two_moving: "Two lines move: read both, the upper line governing",
    three_moving: "Three lines move: read both judgments, the primary governing",
    four_moving: "Four lines move: read the two quiet lines of the relating hexagram, the lower governing",
    five_moving: "Five lines move: read the single quiet line of the relating hexagram",
    six_moving_qian: "All six lines of Qian move: read the Use of Nines",
    six_moving_kun: "All six lines of Kun move: read the Use of Sixes",
    six_moving_other: "All six lines move: read the judgment of the relating hexagram",
  },
};

export const TRIGRAM_QUALITY: LocaleTable<Trigram> = {
  "zh-Hans": {
    qian: "健", dui: "悦", li: "丽", zhen: "动",
    xun: "入", kan: "陷", gen: "止", kun: "顺",
  },
  en: {
    qian: "forceful", dui: "joyous", li: "clinging", zhen: "arousing",
    xun: "penetrating", kan: "perilous", gen: "still", kun: "yielding",
  },
};

export const TRIGRAM_IMAGE: LocaleTable<Trigram> = {
  "zh-Hans": {
    qian: "天", dui: "泽", li: "火", zhen: "雷",
    xun: "风", kan: "水", gen: "山", kun: "地",
  },
  en: {
    qian: "heaven", dui: "lake", li: "fire", zhen: "thunder",
    xun: "wind", kan: "water", gen: "mountain", kun: "earth",
  },
};

type PositionKey = "1" | "2" | "3" | "4" | "5" | "6";

export const POSITION_IMAGERY: LocaleTable<PositionKey> = {
  "zh-Hans": {
    "1": "事之始，位卑而基未固",
    "2": "内卦之中，臣位得中",
    "3": "内外之交，多凶而当慎",
    "4": "近君之位，多惧而当谨",
    "5": "外卦之中，君位得尊",
    "6": "事之终，亢而当退",
  },
  en: {
    "1": "the beginning of the matter: low position, foundation not yet firm",
    "2": "centre of the inner trigram: the minister's place, centred",
    "3": "the join of inner and outer: exposed, calling for caution",
    "4": "close to the ruler: anxious, calling for care",
    "5": "centre of the outer trigram: the ruler's place, honoured",
    "6": "the end of the matter: overreaching, calling for withdrawal",
  },
};

export const RELATION_TEXT: LocaleTable<TiYongRelation> = {
  "zh-Hans": {
    yong_generates_ti: "用生体",
    harmonious: "比和",
    ti_overcomes_yong: "体克用",
    ti_generates_yong: "体生用",
    yong_overcomes_ti: "用克体",
  },
  en: {
    yong_generates_ti: "the matter nourishes you",
    harmonious: "you and the matter are of one phase",
    ti_overcomes_yong: "you can master the matter",
    ti_generates_yong: "you keep spending into the matter",
    yong_overcomes_ti: "the matter presses on you",
  },
};

export const DIRECTION_TEXT: LocaleTable<VerdictDirection> = {
  "zh-Hans": {
    favorable: "所问之事的势来助你",
    flowing: "你与所问之事同频，阻力小",
    workable: "你有能力掌控这件事，但要出力",
    draining: "你在持续付出，消耗大于回报",
    obstructed: "事的势压过你，正面推进受阻",
  },
  en: {
    favorable: "the matter's momentum works in your favour",
    flowing: "you and the matter move at the same pace; little resistance",
    workable: "you can master this, but it will cost effort",
    draining: "you keep giving out more than comes back",
    obstructed: "the matter's momentum presses against you",
  },
};

export function describeChangeRule(ruleId: ChangeRuleId, locale: ContentLocale): string {
  return CHANGE_RULE_TEXT[locale][ruleId];
}

export function describeTrigram(
  trigram: Trigram,
  locale: ContentLocale,
): { image: string; quality: string } {
  return {
    image: TRIGRAM_IMAGE[locale][trigram],
    quality: TRIGRAM_QUALITY[locale][trigram],
  };
}

export function describePosition(position: number, locale: ContentLocale): string {
  const key = String(position) as PositionKey;
  const text = POSITION_IMAGERY[locale][key];
  if (!text) throw new Error(`LINE_POSITION_OUT_OF_RANGE: ${position}`);
  return text;
}

export function describeRelation(relation: TiYongRelation, locale: ContentLocale): string {
  return RELATION_TEXT[locale][relation];
}

export function describeDirection(direction: VerdictDirection, locale: ContentLocale): string {
  return DIRECTION_TEXT[locale][direction];
}
