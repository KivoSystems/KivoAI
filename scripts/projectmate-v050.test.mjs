import { test } from 'node:test';
import assert from 'node:assert/strict';
import { repeatedTextLoop, isLoopingReply, compactSafeHistory } from './projectmate-response-guard.mjs';
import { callModel, RepetitiveModelOutputError } from './projectmate-cli.mjs';
import { buildChatMessages } from './projectmate-chat-context.mjs';
import { fallbackFriendlyReply } from './projectmate-identity.mjs';

const phrase='Do not lie about what you know. ';

test('detects exactly the long repeated Kimi output reported by the user', () => {
  const broken=phrase.repeat(28);
  assert.equal(repeatedTextLoop(broken), true);
  assert.equal(repeatedTextLoop('about. '+broken), true);
  assert.equal(isLoopingReply('Do you lie about what you know?',broken,[]),true);
});
test('does not reject ordinary chat, long prose or three common two-word phrases',()=>{
  assert.equal(repeatedTextLoop('I try to be accurate. I sometimes make mistakes, and I will explain what I know and what I do not know.'),false);
  assert.equal(repeatedTextLoop('First, review the file. Next, run the tests. Finally, check the results.'),false);
  assert.equal(repeatedTextLoop('yes yes yes'),false);
});
test('poisoned assistant history is not fed back to the model',()=>{
  const prior=[
    {role:'user',content:'Do you lie?'},{role:'assistant',content:phrase.repeat(24)},
    {role:'user',content:'What do you know?'},{role:'assistant',content:'about. '+phrase.repeat(20)},
    {role:'user',content:'Can you help?'},{role:'assistant',content:'Yes, tell me about your project.'},
  ];
  assert.deepEqual(compactSafeHistory(prior),prior.slice(4));
  const chat=buildChatMessages({prompt:'How are you?',history:prior});
  assert.equal(chat.some(m=>String(m.content).includes(phrase.repeat(3))),false);
});
test('guard aborts streaming generation before the reply reaches its token limit',async()=>{
  const encoder=new TextEncoder();
  let emitted=0;
  const body=(async function*(){
    for(let i=0;i<50;i++) {
      emitted++;
      yield encoder.encode(JSON.stringify({message:{content:phrase}})+'\n');
    }
  })();
  await assert.rejects(callModel({model:'local',messages:[],context:1024,heartbeat:false,
    guardRepetition:true,fetcher:async()=>({ok:true,body})}),RepetitiveModelOutputError);
  assert.ok(emitted<20,'should stop excessive output early');
});

test('fallback is truthful and relevant when repeated chat is rejected',()=>{
  assert.match(fallbackFriendlyReply('Do you lie about what you know?'),/mistakes|inaccurate/);
  assert.match(fallbackFriendlyReply('are you okay?'),/repetition bug/);
});
