// Browser-only test fixture. Provider/status responses below are simulated, never production data.
import React from 'react';
import { createRoot } from 'react-dom/client';
import { ThreeCoinResultClient } from '../../src/components/three-coin-result/three-coin-result-client';
const query = new URLSearchParams(location.search);
const method = query.get('method') ?? query.get('session')?.replace('browser-fixture-','') ?? 'three_coin';
const question = 'Should I change to a new job?';
const report = {
 schemaVersion:'deep-reading-v3', readingVariant:'still_hexagram',
 directAnswer:'Consider the change conditionally, after checking the actual role and your priorities. This cast does not establish that a new job is available or that leaving now is wise.',
 whyThisReading:'The stable Creative pattern emphasizes deliberate initiative and consistency. With no changing lines, there is no relating hexagram or promised transition to a different role.',
 whatMattersMost:['Check whether the possible role fits your stated priorities before deciding.'],
 whatToDoNext:['If you have a specific role in mind, verify its responsibilities and terms before choosing.'],
 uncertaintyAndBoundaries:'Your question does not state your current employer, work history, financial situation, or whether you have an offer. These circumstances remain unknown and must be checked directly.',
 interpretiveBasisReferences:[{evidenceId:'primary.judgment'}],disclaimer:'Reflective interpretation only, not a certain prediction.',
};
let posted=false;
(window as any).__requests=[];
window.fetch = async (url, init) => {
 (window as any).__requests.push({url:String(url),method:init?.method ?? 'GET',body:init?.body});
 if (init?.method === 'POST') { posted=true; return Response.json({status:'queued',creditReservationCreated:true}); }
 return Response.json(posted ? {status:'completed',output:query.has('invalid') ? {schemaVersion:'unknown'} : report,availableCredits:0} : {status:'not_started',availableCredits:1});
};
createRoot(document.getElementById('root')!).render(<ThreeCoinResultClient
 pageMode={query.get('page') === 'deep' || location.pathname.endsWith('/deep') ? 'deep' : 'free'}
 initialUser={{id:'browser-fixture-owner',email:'fixture@example.com'}} initialCredits={1}
 initialState={{kind:'ready',lineValues:[7,7,7,7,7,7],question}}
 initialCastingView={{castingId:`browser-fixture-${method}`,method:method as any,algorithmVersion:method==='three_coin'?'three-coin-v1':method==='yarrow_stalk'?'yarrow-zhu-xi-digital-v2':'mei-hua-gregorian-current-time-v2',context:question,lineValuesBottomUp:[7,7,7,7,7,7],readingReport:null,owns:true}}
/>);
