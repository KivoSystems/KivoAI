import {test} from 'node:test';
import assert from 'node:assert/strict';
import {routeTask,youtubeSearchQuery,allowedAgentActions,isAllowedAgentAction} from './projectmate-router.mjs';
import {searchWeb,searchFallback,extractRssResults,keepRelevantSearchResults} from './projectmate-tools.mjs';
import {identityResponse,isFalseSelfDescription,fallbackFriendlyReply} from './projectmate-identity.mjs';
import {compactSafeHistory} from './projectmate-response-guard.mjs';

test('exact user wording: search yt is direct search, not autonomous edit',()=>{
  const route=routeTask('can you search yt for new tech');
  assert.equal(route.mode,'quick');
  assert.equal(route.action,'search');
  assert.match(route.value,/site:youtube.com\/watch/);
  assert.match(route.value,/new tech/);
  assert.doesNotMatch(youtubeSearchQuery('can you search yt for new tech'),/search yt/);
  assert.equal(routeTask('can you search youtube for tech content').action,'search');
});
test('agent cannot edit, write, new, or run shell for a search-only request',()=>{
  const task='can you search yt for new tech';
  for(const action of ['edit','new','write','shell']) assert.equal(isAllowedAgentAction(task,{action}),false);
  assert.equal(isAllowedAgentAction(task,{action:'search'}),true);
  assert.deepEqual([...allowedAgentActions(task)].sort(),['answer','search','web']);
});
test('explicit file edits are permitted to be proposed but not automatic',()=>{
  const task='Inspect my project and fix errors in code';
  assert.equal(isAllowedAgentAction(task,{action:'edit'}),true);
  assert.equal(isAllowedAgentAction(task,{action:'new'}),true);
  assert.equal(isAllowedAgentAction('run git status',{action:'shell'}),true);
  assert.equal(isAllowedAgentAction('Explain the latest tech',{action:'shell'}),false);
});
test('DDG 202 challenge falls back to Bing RSS, returns grounded video result',async()=>{
  const calls=[];
  const result=await searchWeb('site:youtube.com/watch new tech 2026',async url=>{
    calls.push(url);
    if(url.includes('duckduckgo')) throw new Error('Website responded HTTP 202');
    const rss=`<?xml version="1.0"?><rss><channel>
      <item><title>New tech &amp; cool gadgets</title><link>https://www.youtube.com/watch?v=TeSt123</link></item>
      <item><title>Wrong nonvideo</title><link>https://example.org/other</link></item>
      </channel></rss>`;
    return {url,text:rss};
  });
  assert.equal(calls.length,2);
  assert.equal(result.results.length,1);
  assert.equal(result.results[0].title,'New tech & cool gadgets');
  assert.match(result.text,/youtube.com\/watch/);
});
test('both search providers failing gives an honest browser-search link, not fabricated results',async()=>{
  const result=await searchWeb('site:youtube.com/watch new tech 2026',async()=>{throw new Error('Website responded HTTP 202');});
  assert.equal(result.results.length,0);
  assert.equal(result.fallback,true);
  assert.match(result.text,/Automated search couldn't retrieve verified results/);
  assert.match(result.text,/https:\/\/www.youtube.com\/results\?search_query=/);
  assert.match(result.text,/No videos or articles have been checked/);
  assert.equal(searchFallback('computer repairs').results.length,0);
});
test('RSS parser rejects unsafe URLs and extracts encoded links',()=>{
  const rss='<item><title><![CDATA[ &lt;Good&gt; ]]></title><link>https://example.org/a?x=1&amp;y=2</link></item>'+
  '<item><title>Local</title><link>https://192.168.1.1/</link></item>';
  const results=extractRssResults(rss);
  assert.equal(results.length,1);
  assert.equal(results[0].url,'https://example.org/a?x=1&y=2');
  assert.equal(keepRelevantSearchResults('site:youtube.com/watch video',results).length,0);
});
test('identity should stay truthful without relying on small model',()=>{
  assert.match(identityResponse('wait so what do you think you are?'),/AI assistant/);
  assert.match(identityResponse('you are human'),/not a human/);
  assert.equal(identityResponse('can you help with my Unity code'),null);
  assert.equal(isFalseSelfDescription('I am a bot and I am not a bot.'),true);
  assert.equal(isFalseSelfDescription('I am not a bot, but I am kind.'),true);
  assert.equal(isFalseSelfDescription('I am ProjectMate, a local AI assistant.'),false);
  assert.equal(fallbackFriendlyReply('you seem kind'),'Thanks! I try to be helpful and kind.');
});
test('contradictory identity statements excluded from old history',()=>{
  const messages=[{role:'user',content:'you seem kind'},
    {role:'assistant',content:'I am not a bot, but I am kind.'},
    {role:'user',content:'How are you?'},{role:'assistant',content:'Doing great!'}];
  const clean=compactSafeHistory(messages);
  assert.equal(clean.some(m=>m.content==='I am not a bot, but I am kind.'),false);
  assert.equal(clean.at(-1).content,'Doing great!');
});
