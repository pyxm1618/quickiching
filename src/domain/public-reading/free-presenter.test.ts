import {describe,it,expect} from 'vitest';
import {buildPublicReading} from './reading';
import {buildStaticReading} from './static-reading';
import {loadHexagramInterpretation} from '@/domain/interpretation/v2/load-interpretation';
describe('concise cast-centered reading',()=>{
 it.each([[7,7,7,7,7,7],[9,7,7,7,7,7]])('explains the overall and transition from existing knowledge for %j',async (...lines)=>{
  const reading=buildPublicReading({method:'three-coin',lineValuesBottomUp:lines,evidence:{kind:'history',originalMethod:'three-coin'}});
  const primary=await loadHexagramInterpretation(reading.primaryHexagram);
  const relating=reading.relatingHexagram ? await loadHexagramInterpretation(reading.relatingHexagram):null;
  const model=buildStaticReading(reading,{primary,relating});
  expect(model.primary.shortMeaning.length).toBeLessThan(350);
  expect(model.overallReading).toContain(model.primary.shortMeaning);
  expect(model.overallReading.length).toBeLessThan(650);
  expect(model.transition).toContain(reading.changingLines.length ? primary.hexagram.transitionTheme:primary.hexagram.stabilityTheme);
  if(relating) expect(model.transition).toContain(relating.hexagram.coreTheme);
 });
});
