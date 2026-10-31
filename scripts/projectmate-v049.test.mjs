import {test} from 'node:test';
import assert from 'node:assert/strict';
import { routeTask, isAllowedAgentAction } from './projectmate-router.mjs';
import { researchRequest, researchWeb, normalizeResearchTopic, researchExcerpt } from './projectmate-research.mjs';
import { addLesson, relevantLessons, loadLessons } from './projectmate-learning.mjs';
import { mkdtempSync,rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const task='can you learn from pypame forums online?';
test('exact typo-riddled Pygame request performs public research without using the planner',()=>{
  const routed=routeTask(task);
  assert.equal(routed.mode,'quick');
  assert.equal(routed.action,'research');
  assert.match(routed.value,/pygame forums/i);
  assert.doesNotMatch(routed.value,/file\.py|pypame|keywords/i);
  assert.equal(normalizeResearchTopic('pypame'), 'pygame');
});
test('web research cannot turn into invented project file reads or edits',()=>{
  for(const action of ['files','read','edit','new','shell','machine','write'])
    assert.equal(isAllowedAgentAction(task,{action,value:'file.py'}),false,action);
  assert.equal(isAllowedAgentAction(task,{action:'search',value:'pygame forums'}),true);
  assert.equal(routeTask('can you learn from your mistakes').mode,'chat');
  assert.equal(routeTask('research pygame forums online and edit my code').mode,'agent');
});
test('real public pages become excerpts, preserving source URLs and source status',async()=>{
  const calls=[];
  const research=await researchWeb('pygame forums discussion help','pygame forums',{
    search:async()=>({results:[
      {title:'Pygame forum tips',url:'https://example.org/pygame-forum'},
      {title:'Pygame event loop discussion',url:'https://example.org/pygame-event'},
      {title:'Unrelated finance',url:'https://example.org/finance'}]}),
    fetchPage:async url=>{calls.push(url);return {url,text:'Overview\nUseful Pygame discussion about frame rate and event loop in which users share examples and compare code, and why pygame.event.get must be called each frame.'};},
  });
  assert.equal(calls.length,2);
  assert.equal(research.verifiedPages.length,2);
  assert.match(research.text,/UNVERIFIED|unverified/);
  assert.doesNotMatch(research.text,/Unrelated finance/);
  const home=mkdtempSync(join(tmpdir(),'pm-research-'));
  try {
    for(const page of research.verifiedPages) addLesson(home,{kind:'web_reference',title:page.title,sourceUrl:page.url,text:`Topic: pygame forums. Public page excerpt (unverified): ${page.excerpt}`});
    const records=relevantLessons(loadLessons(home),'pygame event loop');
    assert.ok(records.some(r=>r.sourceUrl.includes('/pygame-')));
  } finally {rmSync(home,{recursive:true,force:true});}
});
test('site blocks or search failures do not falsely claim anything was learned',async()=>{
  const searchUnavailable=await researchWeb('pygame forums','pygame forums',{search:async()=>({fallback:true,results:[],text:'Automated search unavailable; https://www.bing.com/search?q=pygame'})});
  assert.equal(searchUnavailable.verifiedPages.length,0);
  assert.equal(searchUnavailable.fallback,true);
  const blocked=await researchWeb('pygame forums','pygame forums',{
    search:async()=>({results:[{title:'Pygame forum help',url:'https://example.org/pygame-forum'}]}),
    fetchPage:async()=>{throw new Error('HTTP 403');},
  });
  assert.equal(blocked.verifiedPages.length,0);
  assert.match(blocked.text,/Nothing learned or saved/);
  const irrelevant=await researchWeb('pygame forums','pygame forums',{
    search:async()=>({results:[{title:'Keyword tools',url:'https://keyword.example.org/'}]}),
    fetchPage:async()=>{throw new Error('Should not read irrelevant sites');},
  });
  assert.equal(irrelevant.verifiedPages.length,0);
  assert.match(irrelevant.text,/no results matching/i);
});
test('research excerpt selects a relevant paragraph over boilerplate',()=>{
  const text='All projects homepage nav footer and legal notices about signup and advertisements appearing above content.\nPygame developers discuss moving a sprite using delta time inside a complete game loop and handling events in every frame.';
  assert.match(researchExcerpt(text,'pygame forums'),/Pygame developers/i);
});
