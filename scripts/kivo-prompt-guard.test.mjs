import { test } from 'node:test';
import assert from 'node:assert/strict';
import { identityResponse } from './projectmate-identity.mjs';
import { buildChatMessages } from './projectmate-chat-context.mjs';
import { estimateTokens, fitMessagesToContext } from './projectmate-adaptive.mjs';
import { isPromptLeakReply, isLoopingReply, repeatedTextLoop } from './projectmate-response-guard.mjs';
import { callModel, RepetitiveModelOutputError, KIVO_VERSION } from './projectmate-cli.mjs';

const failedReply=`Sure, I can tell you about me. I am Kivo, a friendly, practical AI coding companion.\n\n1. Read the user's CURRENT request first. Do not jump into unrelated stored projects, past topics, or examples.\n2. For factual/current claims, seek reliable evidence through available tools. Never say you searched, edited, or executed unless the tool actually succeeded.\n3. Prefer actions over vague promises: if they request a file, propose a complete file.\n4. For a multi-step task, use a simple plan: objective -> relevant tool -> observation -> next action -> verify.\n5. For a multi-step task, use a simple plan: objective -> relevant tool -> observation -> next action -> verify.\n6. For a multi-step task, use a simple plan: objective -> relevant tool -> observation -> next action -> verify.`;

test('v0.8.1 includes the prompt guard patch',()=>assert.equal(KIVO_VERSION,'0.8.2'));
test('actual leaked and enumerated system instructions are rejected as invalid replies',()=>{
  assert.equal(isPromptLeakReply(failedReply),true);
  assert.equal(repeatedTextLoop(failedReply),true);
  assert.equal(isLoopingReply('tell me about yourself',failedReply),true);
  assert.equal(isPromptLeakReply('I am Kivo, a local AI assistant. I help with programming and I can look at files with your permission.'),false);
});
test('small context chat can fit concise system text without dropping current user request',()=>{
  const normal=buildChatMessages({prompt:'Please explain debugging.',brain:('For a multi-step task, use a simple plan. ').repeat(30)});
  assert.ok(estimateTokens(normal)>estimateTokens(buildChatMessages({prompt:'Please explain debugging.',compact:true})));
  const compact=buildChatMessages({prompt:'Please explain debugging.',compact:true});
  assert.equal(fitMessagesToContext(compact,1024,512).overflow,false);
  assert.equal(compact.at(-1).content,'Please explain debugging.');
  assert.doesNotMatch(compact[0].content,/For a multi-step task/);
});
test('Kivo introduction requests use deterministic truthful identity instead of a tiny-model completion',()=>{
  for (const prompt of ['can you tell me everything about you','tell me about yourself','what can you do?']) {
    const answer=identityResponse(prompt);
    assert.match(answer,/Kivo/);
    assert.match(answer,/Ollama/);
    assert.match(answer,/model/i);
  }
});
test('stream aborts copied system prompt before it can be accepted',async()=>{
  const encoder=new TextEncoder();
  const body=(async function*(){
    for(const chunk of failedReply.split(/(?<=\n)/)) yield encoder.encode(JSON.stringify({message:{content:chunk}})+'\n');
  })();
  await assert.rejects(callModel({model:'test',messages:[{role:'system',content:'test'}, {role:'user',content:'describe yourself'}],context:1024,
    heartbeat:false,guardRepetition:true,fetcher:async()=>({ok:true,body})}),RepetitiveModelOutputError);
});
