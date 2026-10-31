import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {routeTask,isExplanatoryRequest,isStandaloneCodeRequest} from './projectmate-router.mjs';
import {recordMemory,loadMemory,isMemoryRecallRequest,memoryRecallAnswer,memoryForPrompt} from './projectmate-aut-memory.mjs';
import {buildChatMessages} from './projectmate-chat-context.mjs';
import {chooseContextWindow,fitMessagesToContext} from './projectmate-adaptive.mjs';
import {isLoopingReply} from './projectmate-response-guard.mjs';
import {selectChatModel} from './kivo-smart.mjs';
import {KIVO_VERSION} from './projectmate-cli.mjs';

test('v0.8.2 is the new build',()=>assert.equal(KIVO_VERSION,'0.8.2'));
test('Pygame explanations and standalone functions use CHAT, not tool planner',()=>{
  const requests=[
    'Explain why my Python program might freeze when using pygame, and show me how to fix it.',
    'Write a Python function that checks whether a number is prime, then explain how you would test it.',
    'How do I fix a Python infinite loop?',
    'Can you explain how pygame.event.get works?',
  ];
  for(const q of requests)assert.equal(routeTask(q).mode,'chat',q);
  assert.equal(isStandaloneCodeRequest(requests[1]),true);
  assert.equal(isExplanatoryRequest(requests[0]),true);
  assert.equal(routeTask('modify main.py to add a quit handler').action,'edit');
  assert.equal(routeTask('rewrite the source code in my project').mode,'code');
  assert.equal(routeTask('what did you learn?').action,'learned');
  assert.equal(routeTask('search the web for pygame').action,'search');
});
test('long-term preference saved, retrieved directly, and injected into compact prompt',t=>{
  const home=mkdtempSync(join(tmpdir(),'kivo-082-memory-'));
  t.after(()=>rmSync(home,{recursive:true,force:true}));
  recordMemory(home,{kind:'preference',fact:'The user prefers complete working source code rather than small snippets'});
  const saved=loadMemory(home);
  const question='do i prefer small snippets or complete source code?';
  assert.equal(isMemoryRecallRequest(question),true);
  assert.match(memoryRecallAnswer(saved,question),/prefers complete working source code/i);
  const notes=memoryForPrompt(saved,'Write a Python function for prime numbers');
  assert.match(notes,/complete working source code/);
  const msgs=buildChatMessages({prompt:'Write a Python function for prime numbers',compact:true,lessons:notes});
  assert.match(msgs[0].content,/complete working source code/);
  assert.equal(fitMessagesToContext(msgs,2048,700).overflow,false);
});
test('when auto context is enabled, the reasoning question can reserve enough space',()=>{
  const messages=buildChatMessages({prompt:'Explain why my Python program might freeze when using pygame, and show me how to fix it.',compact:true});
  const choice=chooseContextWindow({messages,base:1024,cap:8192,outputTokens:448,task:messages.at(-1).content,mode:'auto'});
  assert.ok(choice.size>=1024);
  assert.equal(fitMessagesToContext(messages,choice.size,448).overflow,false);
  const fixed=chooseContextWindow({messages,base:1024,cap:8192,outputTokens:448,mode:'fixed'});
  assert.equal(fixed.size,1024,'a higher cap alone must not override fixed mode');
});
test('routing still sends complex chat to reasoning model while simpler chat is fast',()=>{
  assert.equal(selectChatModel({task:'hello',fastModel:'kimi-q2',smartModel:'qwen3.5:4b'}).model,'kimi-q2');
  assert.equal(selectChatModel({task:'Explain why my Python program might freeze when using pygame, and show me how to fix it.',fastModel:'kimi-q2',smartModel:'qwen3.5:4b'}).model,'qwen3.5:4b');
});
test('meta email-shaped hallucinations are rejected before being saved',()=>{
  const bad='To: You prefer small snippets or complete source code\nFrom: Kivo\nAsking for preference in coding language\n\nTo: You prefer small snippets or complete source code\nFrom: Kivo';
  assert.equal(isLoopingReply('what coding languages do i prefer?',bad),true);
});
