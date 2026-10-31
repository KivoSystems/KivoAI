import { test } from 'node:test';
import assert from 'node:assert/strict';
import { routeTask, isProceedFollowup } from './projectmate-router.mjs';
import { extractSearchResults, searchWeb } from './projectmate-tools.mjs';
import { isLoopingReply, compactSafeHistory } from './projectmate-response-guard.mjs';
import { buildChatMessages } from './projectmate-chat-context.mjs';

test('user exact YouTube question invokes public search automatically', () => {
  const route=routeTask('i wanted you to check youtube for any cool tech thats released');
  assert.equal(route.mode,'quick');
  assert.equal(route.action,'search');
  assert.match(route.value,/site:youtube\.com\/watch/i);
  assert.match(route.value,/cool tech thats released/i);
});
test('follow-up request can re-use the last search intent without model planning', () => {
  const previous=routeTask('i wanted you to check youtube for any cool tech thats released');
  assert.equal(isProceedFollowup('can you do that for me right now?'),true);
  assert.deepEqual(routeTask('can you do that for me right now?',{lastAction:previous}),previous);
  assert.equal(routeTask('can you do that for me right now?').mode,'chat');
});
test('casual conversation is chat but web searches work', () => {
  assert.equal(routeTask('hello').mode,'chat');
  assert.equal(routeTask('gurl').mode,'chat');
  assert.equal(routeTask('latest tech releases this week').action,'search');
  assert.equal(routeTask('look up Python documentation').action,'search');
});
test('DuckDuckGo structured result extraction preserves safe public video links', async () => {
  const html=`<div class="result"><a class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fwww.youtube.com%2Fwatch%3Fv%3DAbC">New tech video &amp; demo</a></div>
  <div class="result"><a href="https://example.com/gadget" class="result__a">Gadget announcement</a></div>`;
  const results=extractSearchResults(html);
  assert.equal(results.length,2);
  assert.equal(results[0].title,'New tech video & demo');
  assert.equal(results[0].url,'https://www.youtube.com/watch?v=AbC');
  assert.equal(results[1].url,'https://example.com/gadget');
  const search=await searchWeb('test query',async(_url,options)=>{
    assert.equal(options.rawHtml,true);
    return {url:'https://html.duckduckgo.com/html/?q=test',text:html};
  });
  assert.match(search.text,/youtube.com\/watch/);
});
test('malicious local and non-HTTPS search result links are never presented',()=>{
  const html=`<a class="result__a" href="http://127.0.0.1/secret">bad</a>
    <a class="result__a" href="https://192.168.0.1/admin">internal</a>
    <a class="result__a" href="https://example.org/video">good</a>`;
  const results=extractSearchResults(html);
  assert.equal(results.length,1);
  assert.equal(results[0].url,'https://example.org/video');
});
test('loop guard catches exact user mirrors and repeated short replies',()=>{
  const history=[{role:'assistant',content:'You are.'}];
  assert.equal(isLoopingReply('im not being sassy','You are.',history),true);
  assert.equal(isLoopingReply('why you being sassy','Why you being sassy?',[]),true);
  assert.equal(isLoopingReply('hello','Hello! How can I help?',history),false);
  assert.equal(isLoopingReply('why','You are.',history),true);
});
test('broken old assistant turns are excluded from new model context without deleting logs',()=>{
  const stored=[
    {role:'user',content:'why'}, {role:'assistant',content:'You are.'},
    {role:'user',content:'do what'}, {role:'assistant',content:'You are.'},
    {role:'user',content:'How are you doing?'}, {role:'assistant',content:'Doing well, thanks!'},
  ];
  const snapshot=JSON.stringify(stored);
  const cleaned=compactSafeHistory(stored);
  assert.equal(JSON.stringify(stored),snapshot);
  assert.equal(cleaned.some(m=>m.content==='You are.'),false);
  assert.equal(cleaned.at(-1).content,'Doing well, thanks!');
  const messages=buildChatMessages({prompt:'What can you help me build today?',history:stored});
  assert.equal(messages.some(m=>m.content==='You are.'),false);
});
