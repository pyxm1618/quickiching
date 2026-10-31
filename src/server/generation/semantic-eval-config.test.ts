import {afterEach,describe,expect,it} from 'vitest';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {loadSemanticEvalEnv} from '../../../scripts/run-semantic-eval';
const directories:string[]=[];
afterEach(()=>{for(const directory of directories.splice(0))rmSync(directory,{recursive:true,force:true});});
function envFile(key='test-provider-key'){
 const directory=mkdtempSync(join(tmpdir(),'qic-semantic-config-'));directories.push(directory);
 const path=join(directory,'.env');
 writeFileSync(path,[`AI_GATEWAY_API_KEY=${key}`,'AI_ADAPTER_MODE=ai-sdk','AI_GATEWAY_BASE_URL=https://ai-gateway.vercel.sh/v1','AI_SDK_GATEWAY_BASE_URL=https://ai-gateway.vercel.sh/v3/ai','AI_MODEL_DEEP_READING=deepseek/configured-generation','AI_MODEL_OUTPUT_REVIEW=deepseek/configured-review','AI_MAX_OUTPUT_TOKENS=16000','AI_MAX_REVIEW_OUTPUT_TOKENS=8000'].join('\n'));
 return path;
}
describe('real semantic evaluation uses supplied environment without provider substitution',()=>{
 it('preserves endpoint, both models and token limits verbatim',()=>{
  const env=loadSemanticEvalEnv(envFile(),{});
  expect(env.AI_SDK_GATEWAY_BASE_URL).toBe('https://ai-gateway.vercel.sh/v3/ai');
  expect(env.AI_GATEWAY_BASE_URL).toBe('https://ai-gateway.vercel.sh/v1');
  expect(env.AI_MODEL_DEEP_READING).toBe('deepseek/configured-generation');
  expect(env.AI_MODEL_OUTPUT_REVIEW).toBe('deepseek/configured-review');
  expect(env.AI_MAX_OUTPUT_TOKENS).toBe('16000');expect(env.AI_MAX_REVIEW_OUTPUT_TOKENS).toBe('8000');
 });
 it('rejects a sensitive-value placeholder before an outbound provider call',()=>{
  expect(()=>loadSemanticEvalEnv(envFile('[SENSITIVE]'),{})).toThrow('SEMANTIC_EVAL_SECRET_UNAVAILABLE: AI_GATEWAY_API_KEY');
 });
 it('allows an explicitly supplied process EVAL_KEY without changing the provider',()=>{
  const env=loadSemanticEvalEnv(envFile('[SENSITIVE]'),{EVAL_KEY:'explicit-test-key'});
  expect(env.AI_GATEWAY_API_KEY).toBe('explicit-test-key');
  expect(env.AI_MODEL_OUTPUT_REVIEW).toBe('deepseek/configured-review');
 });
});
