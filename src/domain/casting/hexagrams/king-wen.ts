// 64 King Wen hexagrams shared by every casting method.
// lower = inner trigram (lines 1-3), upper = outer trigram (lines 4-6).
// The domain stores all lines bottom-to-top and buildHexagramResult sets bit i from line i+1,
// so bit 0 MUST be the bottom line of a trigram (yang=1, yin=0).
//
// Correct bottom-up bit encoding:
//   qian ☰ = 111(7)   dui  ☱ = 011(3)   li   ☲ = 101(5)   zhen ☳ = 001(1)
//   xun  ☴ = 110(6)   kan  ☵ = 010(2)   gen  ☶ = 100(4)   kun  ☷ = 000(0)
// Reversing those three-bit values silently swaps Dui/Xun and Zhen/Gen, producing wrong
// King Wen numbers for asymmetric hexagrams. Keep this convention covered by independent fixtures.

export type Trigram = "qian" | "dui" | "li" | "zhen" | "xun" | "kan" | "gen" | "kun";

export const TRIGRAM_BITS: Record<Trigram, number> = {
  qian: 0b111,
  dui: 0b011,
  li: 0b101,
  zhen: 0b001,
  xun: 0b110,
  kan: 0b010,
  gen: 0b100,
  kun: 0b000,
};

// Trigram numbering for Mei Hua (1..8): qian=1 dui=2 li=3 zhen=4 xun=5 kan=6 gen=7 kun=8.
export const TRIGRAM_NUMBER: Record<Trigram, number> = {
  qian: 1,
  dui: 2,
  li: 3,
  zhen: 4,
  xun: 5,
  kan: 6,
  gen: 7,
  kun: 8,
};

export const TRIGRAM_BY_NUMBER: Record<number, Trigram> = {
  1: "qian",
  2: "dui",
  3: "li",
  4: "zhen",
  5: "xun",
  6: "kan",
  7: "gen",
  8: "kun",
};

export type HexagramDef = {
  number: number;
  englishName: string;
  chineseName: string;
  lower: Trigram;
  upper: Trigram;
};

// King Wen sequence. The lower/upper pairs follow the standard eight-trigram composition.
export const KING_WEN_HEXAGRAMS: HexagramDef[] = [
  { number: 1, englishName: "The Creative", chineseName: "乾", lower: "qian", upper: "qian" },
  { number: 2, englishName: "The Receptive", chineseName: "坤", lower: "kun", upper: "kun" },
  { number: 3, englishName: "Difficulty at the Beginning", chineseName: "屯", lower: "zhen", upper: "kan" },
  { number: 4, englishName: "Youthful Folly", chineseName: "蒙", lower: "kan", upper: "gen" },
  { number: 5, englishName: "Waiting", chineseName: "需", lower: "qian", upper: "kan" },
  { number: 6, englishName: "Conflict", chineseName: "讼", lower: "kan", upper: "qian" },
  { number: 7, englishName: "The Army", chineseName: "师", lower: "kan", upper: "kun" },
  { number: 8, englishName: "Holding Together", chineseName: "比", lower: "kun", upper: "kan" },
  { number: 9, englishName: "Small Taming", chineseName: "小畜", lower: "qian", upper: "xun" },
  { number: 10, englishName: "Treading", chineseName: "履", lower: "dui", upper: "qian" },
  { number: 11, englishName: "Peace", chineseName: "泰", lower: "qian", upper: "kun" },
  { number: 12, englishName: "Standstill", chineseName: "否", lower: "kun", upper: "qian" },
  { number: 13, englishName: "Fellowship", chineseName: "同人", lower: "li", upper: "qian" },
  { number: 14, englishName: "Great Possession", chineseName: "大有", lower: "qian", upper: "li" },
  { number: 15, englishName: "Modesty", chineseName: "谦", lower: "gen", upper: "kun" },
  { number: 16, englishName: "Enthusiasm", chineseName: "豫", lower: "kun", upper: "zhen" },
  { number: 17, englishName: "Following", chineseName: "随", lower: "zhen", upper: "dui" },
  { number: 18, englishName: "Work on the Decayed", chineseName: "蛊", lower: "xun", upper: "gen" },
  { number: 19, englishName: "Approach", chineseName: "临", lower: "dui", upper: "kun" },
  { number: 20, englishName: "Contemplation", chineseName: "观", lower: "kun", upper: "xun" },
  { number: 21, englishName: "Biting Through", chineseName: "噬嗑", lower: "zhen", upper: "li" },
  { number: 22, englishName: "Grace", chineseName: "贲", lower: "li", upper: "gen" },
  { number: 23, englishName: "Splitting Apart", chineseName: "剥", lower: "kun", upper: "gen" },
  { number: 24, englishName: "Return", chineseName: "复", lower: "zhen", upper: "kun" },
  { number: 25, englishName: "Innocence", chineseName: "无妄", lower: "zhen", upper: "qian" },
  { number: 26, englishName: "Great Taming", chineseName: "大畜", lower: "qian", upper: "gen" },
  { number: 27, englishName: "Nourishment", chineseName: "颐", lower: "zhen", upper: "gen" },
  { number: 28, englishName: "Great Exceeding", chineseName: "大过", lower: "xun", upper: "dui" },
  { number: 29, englishName: "The Abysmal Water", chineseName: "坎", lower: "kan", upper: "kan" },
  { number: 30, englishName: "The Clinging Fire", chineseName: "离", lower: "li", upper: "li" },
  { number: 31, englishName: "Influence", chineseName: "咸", lower: "gen", upper: "dui" },
  { number: 32, englishName: "Duration", chineseName: "恒", lower: "xun", upper: "zhen" },
  { number: 33, englishName: "Retreat", chineseName: "遁", lower: "gen", upper: "qian" },
  { number: 34, englishName: "Great Power", chineseName: "大壮", lower: "qian", upper: "zhen" },
  { number: 35, englishName: "Progress", chineseName: "晋", lower: "kun", upper: "li" },
  { number: 36, englishName: "Darkening of the Light", chineseName: "明夷", lower: "li", upper: "kun" },
  { number: 37, englishName: "The Family", chineseName: "家人", lower: "li", upper: "xun" },
  { number: 38, englishName: "Opposition", chineseName: "睽", lower: "dui", upper: "li" },
  { number: 39, englishName: "Obstruction", chineseName: "蹇", lower: "gen", upper: "kan" },
  { number: 40, englishName: "Deliverance", chineseName: "解", lower: "kan", upper: "zhen" },
  { number: 41, englishName: "Decrease", chineseName: "损", lower: "dui", upper: "gen" },
  { number: 42, englishName: "Increase", chineseName: "益", lower: "zhen", upper: "xun" },
  { number: 43, englishName: "Breakthrough", chineseName: "夬", lower: "qian", upper: "dui" },
  { number: 44, englishName: "Coming to Meet", chineseName: "姤", lower: "xun", upper: "qian" },
  { number: 45, englishName: "Gathering Together", chineseName: "萃", lower: "kun", upper: "dui" },
  { number: 46, englishName: "Pushing Upward", chineseName: "升", lower: "xun", upper: "kun" },
  { number: 47, englishName: "Oppression", chineseName: "困", lower: "kan", upper: "dui" },
  { number: 48, englishName: "The Well", chineseName: "井", lower: "xun", upper: "kan" },
  { number: 49, englishName: "Revolution", chineseName: "革", lower: "li", upper: "dui" },
  { number: 50, englishName: "The Cauldron", chineseName: "鼎", lower: "xun", upper: "li" },
  { number: 51, englishName: "The Arousing Thunder", chineseName: "震", lower: "zhen", upper: "zhen" },
  { number: 52, englishName: "Keeping Still Mountain", chineseName: "艮", lower: "gen", upper: "gen" },
  { number: 53, englishName: "Development", chineseName: "渐", lower: "gen", upper: "xun" },
  { number: 54, englishName: "The Marrying Maiden", chineseName: "归妹", lower: "dui", upper: "zhen" },
  { number: 55, englishName: "Abundance", chineseName: "丰", lower: "li", upper: "zhen" },
  { number: 56, englishName: "The Wanderer", chineseName: "旅", lower: "gen", upper: "li" },
  { number: 57, englishName: "The Gentle Wind", chineseName: "巽", lower: "xun", upper: "xun" },
  { number: 58, englishName: "The Joyous Lake", chineseName: "兑", lower: "dui", upper: "dui" },
  { number: 59, englishName: "Dispersion", chineseName: "涣", lower: "kan", upper: "xun" },
  { number: 60, englishName: "Limitation", chineseName: "节", lower: "dui", upper: "kan" },
  { number: 61, englishName: "Inner Truth", chineseName: "中孚", lower: "dui", upper: "xun" },
  { number: 62, englishName: "Small Exceeding", chineseName: "小过", lower: "gen", upper: "zhen" },
  { number: 63, englishName: "After Completion", chineseName: "既济", lower: "li", upper: "kan" },
  { number: 64, englishName: "Before Completion", chineseName: "未济", lower: "kan", upper: "li" },
];

// Build a map from the 6-bit binary (bit i = line i+1, yang=1) to King Wen number and fail fast
// if the data ever ceases to be a complete one-to-one mapping.
function buildBinaryToKingWen(): Map<number, number> {
  const map = new Map<number, number>();
  for (const h of KING_WEN_HEXAGRAMS) {
    const lowerBits = TRIGRAM_BITS[h.lower];
    const upperBits = TRIGRAM_BITS[h.upper];
    const binary = (upperBits << 3) | lowerBits;
    if (map.has(binary)) throw new Error(`HEXAGRAM_MAPPING_DUPLICATE_BITS: ${binary}`);
    map.set(binary, h.number);
  }
  if (map.size !== 64) throw new Error(`HEXAGRAM_MAPPING_INCOMPLETE: ${map.size}`);
  return map;
}

export const BINARY_TO_KING_WEN: Map<number, number> = buildBinaryToKingWen();

export function hexagramByNumber(n: number): HexagramDef {
  const def = KING_WEN_HEXAGRAMS.find((h) => h.number === n);
  if (!def) throw new Error(`HEXAGRAM_MAPPING_MISSING: ${n}`);
  return def;
}
