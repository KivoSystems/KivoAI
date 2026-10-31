import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULT_BRAIN,PLANNER_RULES,EDIT_RULES,validateDraft} from './projectmate-brain.mjs';
import {routeTask} from './projectmate-router.mjs';
import {buildChatMessages} from './projectmate-chat-context.mjs';
test('brain has explicit instructions but no hidden/model transfer claim',()=>{
  assert.match(DEFAULT_BRAIN,/CURRENT request/);
  assert.match(PLANNER_RULES,/actual user request/);
  assert.match(EDIT_RULES,/COMPLETE resulting file/);
});
test('natural-language web search uses the user topic, not placeholder',()=>{
  const r=routeTask('can you search the web for cool tech releases this month');
  assert.equal(r.mode,'quick');assert.equal(r.action,'search');
  assert.equal(r.value,'cool tech releases this month');
});
test('a pygame platformer request routes to a safe proposed file',()=>{
  assert.deepEqual(routeTask('can you make a .py that works like a little platformer game using pygame?'),{
    mode:'quick',action:'new',value:'platformer.py',task:'can you make a .py that works like a little platformer game using pygame?',
  });
});
test('draft validator rejects repeated-comment loops and placeholders',()=>{
  assert.match(validateDraft(Array(12).fill('# Define the dimensions of the game window').join('\n'),'platformer.py'),/repeated/);
  assert.match(validateDraft('TODO: implement the game','platformer.py'),/unfinished/);
  assert.equal(validateDraft('import pygame\npygame.init()\nprint("ready")','platformer.py'),null);
});
test('brain can be inserted into chat without unrelated project profile',()=>{
  const msg=buildChatMessages({prompt:'hello',profile:'Raspberry Pi',brain:'Be helpful.'});
  assert.match(msg[0].content,/Be helpful/);assert.doesNotMatch(msg[0].content,/Raspberry Pi/);
});
