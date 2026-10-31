// Installs/removes one temporary localhost-only Next page for the actual result component.
// The generated route is never part of the production patch; no auth/API implementation is replaced.
import {mkdir,readFile,writeFile,unlink,rmdir} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
const target=resolve('src/app/(default)/ritual-qa-local/page.tsx');
const source=`// Generated local QA route. Remove with: node scripts/ritual-qa-fixture.mjs remove
import {headers} from 'next/headers';
import {notFound} from 'next/navigation';
import {ThreeCoinResultClient} from '@/components/three-coin-result/three-coin-result-client';
import {generateThreeCoinLine} from '@/domain/casting/three-coin/algorithm';
import {loadHexagramInterpretation} from '@/domain/interpretation/v2/load-interpretation';
import '@/components/public-reading/ritual.css';
export const dynamic='force-dynamic';
export const metadata={robots:{index:false,follow:false}};
export default async function LocalResultFixture({searchParams}:{searchParams:Promise<{view?:string}>}){
 if(process.env.RITUAL_VISUAL_QA!=='1'||(await headers()).get('host')!=='127.0.0.1:3028')notFound();
 const saving=(await searchParams).view==='saving';
 const inputs=[[true,true,false],[true,false,false],[true,true,false],[true,true,false],[true,true,false],[true,false,false]];
 const lines=inputs.map((bits,index)=>{let draw=0;return generateThreeCoinLine(index as 0|1|2|3|4|5,()=>bits[draw++]).lineValue;});
 return <div className="ritual-result-scene" data-local-qa-fixture="saved-reading"><div className="ritual-room" aria-hidden="true"/>
  <ThreeCoinResultClient initialState={saving?undefined:{kind:'ready',lineValues:lines}} initialUser={{id:'local-visual-fixture',email:'fixture@example.invalid'}}
   initialCastingView={saving?undefined:{castingId:'ritual-qa-saved-cast',context:'',lineValuesBottomUp:lines,readingReport:null,owns:true}}
   initialInterpretationBundles={{primary:await loadHexagramInterpretation(4),relating:null}}/>
 </div>;
}
`;
const mode=process.argv[2];
let existing=null;try{existing=await readFile(target,'utf8');}catch(error){if(error.code!=='ENOENT')throw error;}
if(mode==='install'){
 if(existing!==null&&existing!==source)throw new Error('QA_ROUTE_ALREADY_EXISTS: preserving unknown file');
 await mkdir(dirname(target),{recursive:true});await writeFile(target,source);console.log('Installed temporary local QA route; build/start with RITUAL_VISUAL_QA=1.');
}else if(mode==='remove'){
 if(existing!==null){if(existing!==source)throw new Error('QA_ROUTE_MODIFIED: refusing to delete unknown content');await unlink(target);await rmdir(dirname(target));}
 console.log('Temporary local QA route absent.');
}else throw new Error('Choose install or remove');
