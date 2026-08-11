import type { HexagramInterpretationBundle } from "./types";

type CatalogModule = { INTERPRETATIONS: Record<number, HexagramInterpretationBundle> };
type CatalogLoader = () => Promise<CatalogModule>;

const CATALOG_LOADERS: readonly CatalogLoader[] = [
  () => import("./catalog/01-04"),
  () => import("./catalog/05-08"),
  () => import("./catalog/09-12"),
  () => import("./catalog/13-16"),
  () => import("./catalog/17-20"),
  () => import("./catalog/21-24"),
  () => import("./catalog/25-28"),
  () => import("./catalog/29-32"),
  () => import("./catalog/33-36"),
  () => import("./catalog/37-40"),
  () => import("./catalog/41-44"),
  () => import("./catalog/45-48"),
  () => import("./catalog/49-52"),
  () => import("./catalog/53-56"),
  () => import("./catalog/57-60"),
  () => import("./catalog/61-64"),
] as const;

function assertBundleIntegrity(
  number: number,
  bundle: HexagramInterpretationBundle | undefined,
): HexagramInterpretationBundle {
  if (!bundle || bundle.hexagram.number !== number) {
    throw new Error(`HEXAGRAM_INTERPRETATION_MISSING: number=${number}`);
  }
  if (bundle.lines.length !== 6) {
    throw new Error(`LINE_INTERPRETATION_COUNT_INVALID: hexagramNumber=${number} count=${bundle.lines.length}`);
  }
  for (let index = 0; index < bundle.lines.length; index += 1) {
    const position = index + 1;
    const line = bundle.lines[index];
    if (line.hexagramNumber !== number || line.position !== position) {
      throw new Error(`LINE_INTERPRETATION_MISSING: hexagramNumber=${number} position=${position}`);
    }
  }
  return bundle;
}

export async function loadHexagramInterpretation(number: number): Promise<HexagramInterpretationBundle> {
  if (!Number.isInteger(number) || number < 1 || number > 64) {
    throw new Error(`HEXAGRAM_INTERPRETATION_MISSING: number=${number}`);
  }
  const loader = CATALOG_LOADERS[Math.floor((number - 1) / 4)];
  if (!loader) throw new Error(`HEXAGRAM_INTERPRETATION_MISSING: number=${number}`);
  const catalog = await loader();
  return assertBundleIntegrity(number, catalog.INTERPRETATIONS[number]);
}
