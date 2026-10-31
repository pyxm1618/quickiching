import { afterEach, describe, expect, it, vi } from "vitest";
import { buildPublicReading } from "@/domain/public-reading/reading";
import { generateYarrowLine } from "@/domain/casting/yarrow/algorithm";
import { generateThreeCoinLine } from "@/domain/casting/three-coin/algorithm";
import { meiHuaFromUtc } from "@/domain/casting/mei-hua/algorithm";
import { completedPublicReadingPath, readCompletedPublicReading, publicReadingSaveInput, writeCompletedPublicReading } from "./completed-public-reading";

const calculation = meiHuaFromUtc(Date.UTC(2026, 9, 31), "UTC");
const reading = buildPublicReading({ id: "2d0a4f0d-37e8-42bf-9232-9d40518f1e4f", method: "mei-hua-yi-shu", lineValuesBottomUp: calculation.lineValuesBottomUp, evidence: { kind: "mei-hua-yi-shu", calculation } });
afterEach(() => vi.unstubAllGlobals());
describe("common completed reading handoff", () => {
  it("preserves method evidence and scopes recovery to the requested session", () => {
    const values = new Map<string, string>();
    vi.stubGlobal("window", { sessionStorage: { setItem: (key: string, value: string) => values.set(key, value), getItem: (key: string) => values.get(key) ?? null } });
    writeCompletedPublicReading(reading);
    expect(readCompletedPublicReading(reading.id)).toEqual(reading);
    expect(readCompletedPublicReading("another-session")).toBeNull();
    expect(completedPublicReadingPath(reading.id, true)).toBe(`/zh/readings/result?session=${reading.id}`);
  });
  it("provides the original method and bounded source inputs for saving", () => {
    expect(publicReadingSaveInput(reading)).toMatchObject({ method: "mei_hua_current_time", clientCastingId: reading.id, methodCalculation: { utcMillis: calculation.methodCalculation.utcMillis, ianaTimeZone: "UTC" } });
    expect(publicReadingSaveInput(reading).methodCalculation).not.toHaveProperty("movingLinePosition");
  });
  it("hands all three completed methods to the same canonical route with unchanged source evidence", () => {
    const values = new Map<string, string>();
    vi.stubGlobal("window", { sessionStorage: { setItem: (key: string, value: string) => values.set(key, value), getItem: (key: string) => values.get(key) ?? null } });
    const yarrow = Array.from({ length: 6 }, (_, index) => generateYarrowLine(index as 0, () => 1));
    const coins = Array.from({ length: 6 }, (_, index) => generateThreeCoinLine(index as 0, () => true));
    for (const completed of [
      reading,
      buildPublicReading({ id: reading.id, method: "three-coin", lineValuesBottomUp: coins.map(line => line.lineValue), evidence: { kind: "three-coin", steps: coins } }),
      buildPublicReading({ id: reading.id, method: "yarrow-stalks", lineValuesBottomUp: yarrow.map(line => line.lineValue), evidence: { kind: "yarrow-stalks", lines: yarrow } }),
    ]) {
      writeCompletedPublicReading(completed);
      expect(readCompletedPublicReading(completed.id)).toEqual(completed);
      expect(completedPublicReadingPath(completed.id)).toBe(`/readings/result?session=${completed.id}`);
      expect(publicReadingSaveInput(completed).algorithmVersion).toBe(completed.methodVersion);
    }
  });
  it("recovers read-only three-coin browser history without fabricating toss evidence", () => {
    const values = new Map<string, string>();
    vi.stubGlobal("window", {sessionStorage: {setItem: (key: string, value: string) => values.set(key,value), getItem: (key: string) => values.get(key) ?? null}});
    const historical = buildPublicReading({id: reading.id, method: "three-coin", lineValuesBottomUp: [7,7,7,7,7,7], evidence: {kind: "history", originalMethod: "three-coin"}});
    writeCompletedPublicReading(historical);
    expect(readCompletedPublicReading(historical.id)).toEqual(historical);
    expect(publicReadingSaveInput(historical).method).toBe("three_coin");
  });
  it("fails closed on corrupt storage and propagates blocked writes", () => {
    vi.stubGlobal("window", { sessionStorage: { getItem: () => "{broken", setItem: () => { throw new Error("blocked"); } } });
    expect(readCompletedPublicReading()).toBeNull();
    expect(() => writeCompletedPublicReading(reading)).toThrow("blocked");
  });

});

import { clearCompletedReadingForRestart } from './completed-public-reading';
describe('restart preserves other casting methods', () => {
  it.each([
    ['yarrow-stalks', 'quickiching:public-v1:yarrow-v2', '/methods/yarrow-stalks'],
    ['mei-hua-yi-shu', 'quickiching:public-v1:mei-hua-v2', '/methods/mei-hua-yi-shu'],
    ['three-coin', 'quickiching:public-v1:three-coin', '/methods/three-coin'],
  ] as const)('clears only %s and the common handoff', (method, key, href) => {
    const values = new Map([[key,'cast'],['unrelated','preserve'],['quickiching:public-v1:completed-reading','handoff']]);
    vi.stubGlobal('window', {sessionStorage: {removeItem:(item:string)=>values.delete(item)}, localStorage:{removeItem:vi.fn()}});
    expect(clearCompletedReadingForRestart(method, true)).toBe(`/zh${href}`);
    expect(values.has(key)).toBe(false);
    expect(values.has('quickiching:public-v1:completed-reading')).toBe(false);
    expect(values.get('unrelated')).toBe('preserve');
  });
});
