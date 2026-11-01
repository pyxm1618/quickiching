// Browser-only test fixture. Provider/status responses below are simulated, never production data.
import React from 'react';
import { createRoot } from 'react-dom/client';
import { ThreeCoinResultClient } from '../../src/components/three-coin-result/three-coin-result-client';
import { generateYarrowLine } from '../../src/domain/casting/yarrow/algorithm';
import { meiHuaFromUtc } from '../../src/domain/casting/mei-hua/algorithm';

const query = new URLSearchParams(location.search);
const method = (query.get('method') ?? 'three_coin') as 'three_coin' | 'yarrow_stalk' | 'mei_hua_current_time';
const yarrowLines = Array.from({length:6},(_,index)=>generateYarrowLine(index as 0|1|2|3|4|5,()=>2));
const meiHua = meiHuaFromUtc(Date.UTC(2026,9,31,12,0,0),'UTC');
const lineValues = method === 'yarrow_stalk'
  ? yarrowLines.map(line=>line.lineValue)
  : method === 'mei_hua_current_time'
    ? [...meiHua.lineValuesBottomUp]
    : [7,7,7,7,7,7];
const methodCalculation = method === 'yarrow_stalk'
  ? {kind:'yarrow-stalks',version:'yarrow-zhu-xi-digital-v2',changes:yarrowLines.flatMap(line=>line.changes)}
  : method === 'mei_hua_current_time'
    ? meiHua.methodCalculation
    : {kind:'three-coin',version:'three-coin-v1'};
const zh = query.get('locale') === 'zh';
const question = zh ? '我现在是否适合换一份工作？' : 'Should I change to a new job?';
const viewModel = zh ? {
  schemaVersion: 'ai-deep-reading-view-v1' as const,
  coreLead: '先核实新岗位的实际条件，再决定是否行动。',
  coreDetail: '这次卦象不能证明新岗位一定存在，也不能替你确定离职决定。',
  whyItems: ['当前结构更强调有依据地推进，而不是只凭一时冲动。'],
  changeItems: ['没有动爻时，不应把局势解释成已经必然转向另一份工作。'],
  actionSignals: ['岗位职责、条件和你的核心优先级能够明确对应。'],
  observeSignals: ['岗位职责、实际条件或对方承诺仍然没有被确认。'],
  nextSteps: ['先核实具体岗位的职责和条件，再决定下一步。'],
  disclaimer: '本解读用于反思参考，不构成确定预测。',
} : {
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
  locale={zh ? 'zh-Hans' : 'en'}
  pageMode={query.get('page') === 'deep' ? 'deep' : 'free'}
  initialUser={{id:'browser-fixture-owner',email:'fixture@example.com'}}
  initialCredits={1}
  initialState={{kind:'ready',lineValues,question}}
  initialCastingView={{
    castingId:'browser-fixture-cast',
    method,
    algorithmVersion:method==='three_coin'
      ? 'three-coin-v1'
      : method==='yarrow_stalk'
        ? 'yarrow-zhu-xi-digital-v2'
        : 'mei-hua-gregorian-current-time-v2',
    context:question,
    lineValuesBottomUp:lineValues,
    methodCalculation,
    owns:true,
  }}
/>);
