export const EN_GLOBAL_EXACT_SOURCE_SHA256 = "3924004150cc6190481a02257dd9e90731134cef417189c1b1e4a87e96da9a73";

export type EnGlobalExactRow = {
  number: number;
  commonEnglishName: string;
  primaryKeyword: string;
  globalExactVolume: number;
  usVolume: number;
  usKd: number;
  secondaryCore: string;
  secondaryGlobal: number;
  otherCoreVariant: string;
  otherCoreGlobal: number;
  meaningGlobal: number;
  loveGlobal: number;
  unchangingGlobal: number;
  relationshipGlobal: number;
  recommendedModules: readonly string[];
  titleTarget: string;
  h1Target: string;
  specialKeywords: readonly string[];
};

type ResearchTuple = readonly [
  number: number,
  commonEnglishName: string,
  globalExactVolume: number,
  usVolume: number,
  usKd: number,
  secondaryCore: string,
  secondaryGlobal: number,
  otherCoreVariant: string,
  otherCoreGlobal: number,
  meaningGlobal: number,
  loveGlobal: number,
  unchangingGlobal: number,
  relationshipGlobal: number,
];

const RESEARCH_TUPLES = [
  [1, "The Creative", 1470, 320, 7, "i ching hexagram 1", 250, "iching hexagram 1", 80, 70, 290, 190, 30],
  [2, "The Receptive", 1510, 390, 2, "i ching hexagram 2", 190, "iching hexagram 2", 110, 90, 370, 150, 0],
  [3, "Difficulty at the Beginning", 1430, 390, 8, "i ching hexagram 3", 170, "iching hexagram 3", 80, 60, 350, 150, 10],
  [4, "Youthful Folly", 1160, 320, 2, "i ching hexagram 4", 140, "iching hexagram 4", 40, 60, 350, 160, 0],
  [5, "Waiting", 1290, 320, 5, "i ching hexagram 5", 130, "iching hexagram 5", 70, 140, 310, 110, 0],
  [6, "Conflict", 950, 260, 4, "i ching hexagram 6", 130, "iching hexagram 6", 0, 0, 240, 130, 0],
  [7, "The Army", 910, 320, 5, "iching hexagram 7", 290, "i ching hexagram 7", 110, 90, 390, 90, 0],
  [8, "Holding Together", 1210, 320, 9, "i ching hexagram 8", 140, "iching hexagram 8", 20, 100, 310, 190, 0],
  [9, "The Taming Power of the Small", 950, 320, 7, "iching hexagram 9", 350, "i ching hexagram 9", 80, 140, 470, 200, 0],
  [10, "Treading", 1230, 320, 8, "i ching hexagram 10", 130, "iching hexagram 10", 80, 70, 340, 210, 0],
  [11, "Peace", 1250, 390, 12, "iching hexagram 11", 200, "i ching hexagram 11", 180, 40, 300, 130, 0],
  [12, "Standstill", 1210, 320, 8, "i ching hexagram 12", 140, "iching hexagram 12", 20, 0, 270, 70, 0],
  [13, "Fellowship with Men", 1300, 390, 2, "i ching hexagram 13", 120, "iching hexagram 13", 60, 110, 300, 160, 10],
  [14, "Possession in Great Measure", 1800, 390, 2, "iching hexagram 14", 390, "i ching hexagram 14", 110, 60, 330, 190, 0],
  [15, "Modesty", 970, 390, 2, "i ching hexagram 15", 120, "iching hexagram 15", 40, 40, 400, 180, 0],
  [16, "Enthusiasm", 1580, 390, 2, "i ching hexagram 16", 130, "iching hexagram 16", 0, 100, 280, 220, 0],
  [17, "Following", 1300, 390, 8, "i ching hexagram 17", 120, "iching hexagram 17", 0, 70, 400, 220, 0],
  [18, "Work on What Has Been Spoiled", 1270, 320, 7, "i ching hexagram 18", 140, "iching hexagram 18", 40, 80, 310, 120, 10],
  [19, "Approach", 1370, 390, 5, "i ching hexagram 19", 120, "iching hexagram 19", 0, 80, 300, 160, 10],
  [20, "Contemplation", 1130, 320, 8, "i ching hexagram 20", 120, "iching hexagram 20", 80, 80, 340, 60, 0],
  [21, "Biting Through", 1220, 320, 0, "i ching hexagram 21", 90, "iching hexagram 21", 0, 90, 300, 150, 0],
  [22, "Grace", 1560, 390, 1, "i ching hexagram 22", 120, "iching hexagram 22", 20, 70, 390, 140, 0],
  [23, "Splitting Apart", 1420, 390, 7, "i ching hexagram 23", 130, "iching hexagram 23", 20, 70, 300, 120, 0],
  [24, "Return", 1520, 390, 12, "i ching hexagram 24", 150, "iching hexagram 24", 20, 110, 320, 160, 0],
  [25, "Innocence (The Unexpected)", 1340, 320, 4, "i ching hexagram 25", 60, "iching hexagram 25", 0, 70, 320, 190, 0],
  [26, "The Taming Power of the Great", 1740, 390, 3, "i ching hexagram 26", 70, "iching hexagram 26", 0, 60, 330, 140, 20],
  [27, "Nourishment", 1260, 320, 12, "i ching hexagram 27", 130, "iching hexagram 27", 0, 80, 310, 130, 0],
  [28, "Preponderance of the Great", 1160, 390, 1, "i ching hexagram 28", 50, "iching hexagram 28", 0, 120, 330, 80, 0],
  [29, "The Abysmal (Water)", 1190, 320, 8, "iching hexagram 29", 210, "i ching hexagram 29", 100, 70, 320, 80, 0],
  [30, "The Clinging (Fire)", 1700, 390, 2, "i ching hexagram 30", 100, "iching hexagram 30", 60, 60, 350, 190, 0],
  [31, "Influence", 1420, 390, 6, "i ching hexagram 31", 90, "iching hexagram 31", 0, 120, 250, 170, 0],
  [32, "Duration", 1380, 320, 8, "i ching hexagram 32", 130, "iching hexagram 32", 20, 80, 330, 160, 0],
  [33, "Retreat", 1210, 320, 6, "i ching hexagram 33", 50, "iching hexagram 33", 0, 20, 280, 130, 0],
  [34, "The Power of the Great", 1250, 390, 12, "i ching hexagram 34", 120, "iching hexagram 34", 40, 50, 300, 110, 0],
  [35, "Progress", 1100, 390, 6, "i ching hexagram 35", 110, "iching hexagram 35", 0, 50, 420, 200, 10],
  [36, "Darkening of the Light", 1350, 390, 2, "i ching hexagram 36", 130, "iching hexagram 36", 40, 80, 400, 100, 10],
  [37, "The Family", 1200, 390, 14, "i ching hexagram 37", 80, "iching hexagram 37", 20, 80, 400, 130, 30],
  [38, "Opposition", 1560, 390, 2, "i ching hexagram 38", 90, "iching hexagram 38", 20, 50, 300, 80, 0],
  [39, "Obstruction", 1270, 320, 12, "i ching hexagram 39", 50, "iching hexagram 39", 0, 0, 270, 120, 0],
  [40, "Deliverance", 1690, 390, 6, "iching hexagram 40", 300, "i ching hexagram 40", 120, 130, 290, 120, 0],
  [41, "Decrease", 1340, 320, 0, "i ching hexagram 41", 120, "iching hexagram 41", 0, 60, 360, 140, 20],
  [42, "Increase", 1690, 480, 9, "i ching hexagram 42", 140, "iching hexagram 42", 10, 80, 350, 200, 30],
  [43, "Break-through (Resoluteness)", 1380, 390, 14, "i ching hexagram 43", 140, "iching hexagram 43", 0, 80, 310, 130, 0],
  [44, "Coming to Meet", 1200, 390, 10, "i ching hexagram 44", 120, "iching hexagram 44", 30, 160, 330, 150, 10],
  [45, "Gathering Together", 1600, 390, 11, "i ching hexagram 45", 110, "iching hexagram 45", 0, 70, 320, 160, 0],
  [46, "Pushing Upward", 1220, 320, 12, "iching hexagram 46", 340, "i ching hexagram 46", 50, 20, 320, 100, 0],
  [47, "Oppression (Exhaustion)", 1160, 320, 10, "i ching hexagram 47", 100, "iching hexagram 47", 0, 60, 400, 90, 0],
  [48, "The Well", 1170, 320, 10, "i ching hexagram 48", 130, "iching hexagram 48", 0, 90, 330, 120, 0],
  [49, "Revolution (Molting)", 1640, 390, 7, "i ching hexagram 49", 110, "iching hexagram 49", 0, 60, 330, 130, 20],
  [50, "The Cauldron", 1670, 390, 9, "i ching hexagram 50", 170, "iching hexagram 50", 80, 80, 400, 220, 10],
  [51, "The Arousing (Shock)", 1200, 320, 2, "i ching hexagram 51", 120, "iching hexagram 51", 40, 90, 360, 190, 0],
  [52, "Keeping Still (Mountain)", 1100, 320, 7, "i ching hexagram 52", 70, "iching hexagram 52", 0, 20, 310, 150, 0],
  [53, "Development (Gradual Progress)", 1070, 390, 7, "i ching hexagram 53", 120, "iching hexagram 53", 0, 30, 350, 100, 0],
  [54, "The Marrying Maiden", 950, 320, 8, "iching hexagram 54", 200, "i ching hexagram 54", 110, 100, 300, 140, 20],
  [55, "Abundance", 950, 320, 2, "i ching hexagram 55", 130, "iching hexagram 55", 0, 60, 440, 160, 0],
  [56, "The Wanderer", 1100, 320, 9, "i ching hexagram 56", 160, "iching hexagram 56", 20, 80, 290, 180, 20],
  [57, "The Gentle (Wind)", 1280, 320, 14, "i ching hexagram 57", 100, "iching hexagram 57", 0, 130, 310, 100, 10],
  [58, "The Joyous (Lake)", 1250, 320, 3, "i ching hexagram 58", 100, "iching hexagram 58", 0, 20, 420, 170, 0],
  [59, "Dispersion (Dissolution)", 1350, 480, 10, "i ching hexagram 59", 110, "iching hexagram 59", 0, 90, 500, 150, 10],
  [60, "Limitation", 1150, 320, 8, "i ching hexagram 60", 150, "iching hexagram 60", 40, 50, 300, 170, 0],
  [61, "Inner Truth", 1370, 390, 12, "i ching hexagram 61", 180, "iching hexagram 61", 20, 90, 330, 130, 10],
  [62, "Preponderance of the Small", 1090, 320, 10, "i ching hexagram 62", 110, "iching hexagram 62", 0, 50, 330, 140, 10],
  [63, "After Completion", 1280, 390, 12, "i ching hexagram 63", 140, "iching hexagram 63", 60, 120, 420, 220, 10],
  [64, "Before Completion", 1810, 480, 8, "i ching hexagram 64", 200, "iching hexagram 64", 120, 100, 350, 180, 10],
] as const satisfies readonly ResearchTuple[];

const RELATIONSHIP_SPECIFIC = new Set([1, 26, 37, 41, 42, 49, 54, 56]);

function specialKeywords(number: number): readonly string[] {
  if (number === 23) return ["i ching hexagram 23 meaning splitting apart bo"];
  if (number === 54) return ["hexagram 54 in romance reading"];
  return [];
}

export const EN_GLOBAL_EXACT_ROWS = RESEARCH_TUPLES.map((tuple): EnGlobalExactRow => {
  const [
    number,
    commonEnglishName,
    globalExactVolume,
    usVolume,
    usKd,
    secondaryCore,
    secondaryGlobal,
    otherCoreVariant,
    otherCoreGlobal,
    meaningGlobal,
    loveGlobal,
    unchangingGlobal,
    relationshipGlobal,
  ] = tuple;
  const recommendedModules = ["meaning", "love", "unchanging", "six-lines"];
  if (RELATIONSHIP_SPECIFIC.has(number)) recommendedModules.push("relationship");
  if (number === 23) recommendedModules.push("splitting-apart-bo");
  if (number === 54) recommendedModules.push("romance-reading");

  return {
    number,
    commonEnglishName,
    primaryKeyword: `hexagram ${number}`,
    globalExactVolume,
    usVolume,
    usKd,
    secondaryCore,
    secondaryGlobal,
    otherCoreVariant,
    otherCoreGlobal,
    meaningGlobal,
    loveGlobal,
    unchangingGlobal,
    relationshipGlobal,
    recommendedModules,
    titleTarget: `I Ching Hexagram ${number}: ${commonEnglishName} — Meaning, Love & Unchanging`,
    h1Target: `Hexagram ${number} — ${commonEnglishName}`,
    specialKeywords: specialKeywords(number),
  };
});

const BY_NUMBER = new Map(EN_GLOBAL_EXACT_ROWS.map((row) => [row.number, row]));

export function englishGlobalExactRow(number: number): EnGlobalExactRow {
  const row = BY_NUMBER.get(number);
  if (!row) throw new Error(`EN_GLOBAL_EXACT_ROW_MISSING: number=${number}`);
  return row;
}
