// Browser-only test fixture. Provider/status responses below are simulated, never production data.
import React from 'react';
import { createRoot } from 'react-dom/client';
import { ThreeCoinResultClient } from '../../src/components/three-coin-result/three-coin-result-client';

const query = new URLSearchParams(location.search);
const method = query.get('method') ?? 'three_coin';
const question = 'Should I change to a new job?';
const viewModel = {
  schemaVersion: 'ai-deep-reading-view-v1' as const,
  coreLead: 'Consider the change conditionally, after checking the actual role and your priorities.',
  coreDetail: 'This cast does not establish that a new job is available or that leaving now is wise.',
  whyItems: ['The stable Creative pattern emphasizes deliberate initiative and consistency.'],
  changeItems: ['With no changing lines, there is no promised transition to a different role.'],
  actionSignals: ['The possible role fits your stated priorities and its terms are confirmed.'],
  observeSignals: ['The role, responsibilities, or practical terms remain unconfirmed.'],
  nextSteps: ['Verify the responsibilities and terms of the specific role before choosing.'],
  disclaimer: 'Reflective interpretation only, not a certain prediction.',
};
const context = {
  question,
  legacyReadOnly: false,
};

let posted = false;
(window as any).__requests = [];
window.fetch = async (url, init) => {
  (window as any).__requests.push({url:String(url),method:init?.method ?? 'GET',body:init?.body});
  if (init?.method === 'POST') {
    posted = true;
    return Response.json({status:'queued',creditReservationCreated:true});
  }
  return Response.json(
    posted
      ? (query.has('invalid')
          ? {status:'completed',availableCredits:0}
          : {status:'completed',viewModel,context,availableCredits:0})
      : {status:'not_started',context,availableCredits:1},
  );
};

createRoot(document.getElementById('root')!).render(<ThreeCoinResultClient
  pageMode={query.get('page') === 'deep' ? 'deep' : 'free'}
  initialUser={{id:'browser-fixture-owner',email:'fixture@example.com'}}
  initialCredits={1}
  initialState={{kind:'ready',lineValues:[7,7,7,7,7,7],question}}
  initialCastingView={{
    castingId:'browser-fixture-cast',
    method:method as any,
    algorithmVersion:method==='three_coin'
      ? 'three-coin-v1'
      : method==='yarrow_stalk'
        ? 'yarrow-zhu-xi-digital-v2'
        : 'mei-hua-gregorian-current-time-v2',
    context:question,
    lineValuesBottomUp:[7,7,7,7,7,7],
    owns:true,
  }}
/>);
