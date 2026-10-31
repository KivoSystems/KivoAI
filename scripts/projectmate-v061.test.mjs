import { test } from 'node:test';
import assert from 'node:assert/strict';
import {chooseContextWindow, estimateTokens, fitMessagesToContext, validateContextExpansion,
  parseTaskToolPlan, suggestedTools} from './projectmate-adaptive.mjs';
import {parseAgentAction} from './projectmate-tools.mjs';
import {callModel,PROJECTMATE_VERSION} from './projectmate-cli.mjs';

const chat=content=>[{role:'system',content:'You are ProjectMate.'},{role:'user',content}];
test('v0.6.1 exposes adaptive context',()=>assert.equal(PROJECTMATE_VERSION,'0.7.0'));
test('short chat stays small, large coding context expands inside cap',()=>{
  const short=chooseContextWindow({messages:chat('Hello!'),base:1024,cap:8192,outputTokens:64});
  assert.equal(short.size,1024);
  const huge=chooseContextWindow({messages:chat('fix this project '.repeat(600)),base:1024,cap:8192,outputTokens:1000,task:'refactor my source code'});
  assert.ok(huge.size>1024);
  assert.ok(huge.size<=8192);
  const capped=chooseContextWindow({messages:chat('y'.repeat(25000)),base:1024,cap:4096,outputTokens:3000});
  assert.equal(capped.size,4096);
  assert.equal(capped.limited,true);
});
test('fixed mode stays fixed and validates cap',()=>{
  const fixed=chooseContextWindow({messages:chat('x'.repeat(10000)),base:1024,cap:8192,outputTokens:500,mode:'fixed'});
  assert.equal(fixed.size,1024);
  assert.equal(fixed.limited,true);
  assert.throws(()=>chooseContextWindow({base:8192,cap:1024}),/cap/);
});
test('fit removes older turns but keeps system and current user request',()=>{
  const messages=[{role:'system',content:'SYSTEM'}, {role:'user',content:'old '.repeat(1000)},
    {role:'assistant',content:'answer '.repeat(1000)}, {role:'user',content:'current request'}];
  const fitted=fitMessagesToContext(messages,1024,96);
  assert.ok(fitted.trimmed>=1);
  assert.equal(fitted.messages.at(-1).content,'current request');
  assert.equal(fitted.messages[0].content,'SYSTEM');
  assert.ok(estimateTokens(fitted.messages)<estimateTokens(messages));
});
test('AI context request must be valid, one-step and within user cap',()=>{
  const parsed=parseAgentAction('{"action":"expand_context","tokens":4096}');
  assert.deepEqual(parsed,{action:'expand_context',tokens:4096});
  assert.equal(validateContextExpansion(1024,parsed.tokens,8192),4096);
  assert.equal(validateContextExpansion(4096,4096,8192),null);
  assert.equal(validateContextExpansion(1024,16384,8192),null);
  assert.equal(validateContextExpansion(1024,3000,8192),null);
  assert.throws(()=>parseAgentAction('{"action":"expand_context","tokens":"huge"}'),/valid/);
});
test('model suggested tools are bounded by user request permissions',()=>{
  const plan=parseTaskToolPlan('{"goal":"research","tools":["edit","shell","search","web","search","unknown"],"context":4096}',
    'search the internet for Python docs');
  assert.deepEqual(plan.tools,['search','web']);
  assert.equal(plan.context,4096);
  assert.ok(!suggestedTools('search web for pygame').includes('shell'));
  assert.deepEqual(parseTaskToolPlan('{"tools":["edit","read"]}','just say hello').tools,['read']);
});
test('Ollama receives selected num_ctx, not a prompt disguised as model weights',async()=>{
  let request;
  const fetcher=async(_url, opts)=>{
    request=JSON.parse(opts.body);
    return {ok:true,body:(async function*(){yield Buffer.from(JSON.stringify({message:{content:'done'}})+'\n'+JSON.stringify({done:true,eval_count:1,eval_duration:1e9})+'\n');})()};
  };
  const result=await callModel({model:'kimi-test',messages:chat('hello'),context:4096,maxTokens:80,fetcher,heartbeat:false});
  assert.equal(result,'done');assert.equal(request.options.num_ctx,4096);assert.equal(request.options.num_predict,80);
  assert.equal(request.stream,true);
});
