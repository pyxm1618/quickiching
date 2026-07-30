import { ALGORITHM_VERSIONS, type LineValue } from "../types";

// §8.3 Yarrow Stalk v1. 49 stalks, three changes per line.
// Each change: split pile, take 1 from right, count both sides by 4 (remainder 1..4),
// set aside remainders + the 1. Repeating 3x yields a remaining pile of 24/28/32/36.
// value = remaining / 4 => 6,7,8,9. (6 old yin, 7 young yang, 8 young yin, 9 old yang)
//
// NOTE: Theoretical probabilities (1/16, 5/16, 7/16, 3/16) and exact golden-standard
// step samples require domain-advisor approval (PRD §21 G-03, D0 Blocked). The algorithm
// below is the canonical procedure; tests assert conservation invariants and the
// empirical distribution against the documented targets within tolerance.

export type YarrowChange = {
  lineIndex: 0 | 1 | 2 | 3 | 4 | 5;
  changeIndex: 0 | 1 | 2;
  startingStalks: number;
  leftGroup: number;
  rightGroup: number;
  removedFromRight: 1;
  leftRemainder: 1 | 2 | 3 | 4;
  rightRemainder: 1 | 2 | 3 | 4;
  endingStalks: number;
  algorithmVersion: string;
};

export type YarrowLineResult = {
  lineIndex: 0 | 1 | 2 | 3 | 4 | 5;
  lineValue: LineValue;
  changes: YarrowChange[];
  algorithmVersion: string;
};

// Returns 1..4 remainder for a count divided into groups of 4 (a count of exactly 0 mod 4 => 4).
function remainderOf(count: number): 1 | 2 | 3 | 4 {
  const r = count % 4;
  return (r === 0 ? 4 : r) as 1 | 2 | 3 | 4;
}

// Production random integer in [1, max-1] inclusive (a non-empty left heap).
export type RandomInt = (maxExclusive: number) => number;

export function generateYarrowChange(
  lineIndex: 0 | 1 | 2 | 3 | 4 | 5,
  changeIndex: 0 | 1 | 2,
  startingStalks: number,
  randomInt: RandomInt,
): YarrowChange {
  const leftGroup = randomInt(startingStalks);
  if (leftGroup < 1 || leftGroup >= startingStalks) throw new Error("YARROW_INVALID_SPLIT");
  const rightGroup = startingStalks - leftGroup;
  const leftRemainder = remainderOf(leftGroup);
  const rightRemainder = remainderOf(rightGroup - 1);
  const removedFromRight = 1 as const;
  const endingStalks = startingStalks - leftRemainder - rightRemainder - removedFromRight;
  return {
    lineIndex, changeIndex, startingStalks, leftGroup, rightGroup, removedFromRight,
    leftRemainder, rightRemainder, endingStalks, algorithmVersion: ALGORITHM_VERSIONS.yarrow_stalk,
  };
}

export function generateYarrowLine(
  lineIndex: 0 | 1 | 2 | 3 | 4 | 5,
  randomInt: RandomInt,
): YarrowLineResult {
  let stalks = 49;
  const changes: YarrowChange[] = [];

  for (let changeIndex = 0 as 0 | 1 | 2; changeIndex < 3; changeIndex = (changeIndex + 1) as 0 | 1 | 2) {
    // First change operates on 49 (observer 1 set aside separately). Subsequent on the remaining pile.
    const change = generateYarrowChange(lineIndex, changeIndex, stalks, randomInt);
    changes.push(change);
    stalks = change.endingStalks;
  }

  const value = (stalks / 4) as LineValue;
  if (![6, 7, 8, 9].includes(value)) {
    throw new Error(`YARROW_INVALID_VALUE: ${value} from ${stalks}`);
  }

  return {
    lineIndex,
    lineValue: value,
    changes,
    algorithmVersion: ALGORITHM_VERSIONS.yarrow_stalk,
  };
}

// Node:crypto-based integer in [1, maxExclusive-1]; uses rejection to avoid modulo bias.
export function cryptoRandomInt(maxExclusive: number): number {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { randomInt: cryptoRandomIntFn } = require("node:crypto");
  return cryptoRandomIntFn(1, maxExclusive); // [1, maxExclusive-1]
}
