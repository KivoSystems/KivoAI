import {test} from 'node:test';
import assert from 'node:assert/strict';
import {routeTask,compactObservation} from './projectmate-router.mjs';
import {parseAgentAction} from './projectmate-tools.mjs';

test('automatic quick tools choose without an AI call',()=>{
  assert.deepEqual(routeTask('show me the project files'),{mode:'quick',action:'files',value:'.'});
  assert.equal(routeTask('search the web for Arduino guides').action,'search');
  assert.equal(routeTask('https://example.com').action,'web');
});
test('mixed tools request an agent, casual chat stays chat',()=>{
  assert.equal(routeTask('inspect my project and fix the bugs').mode,'code');
  assert.equal(routeTask('can you look online and edit my code').mode,'agent');
  assert.equal(routeTask('hey how are you').mode,'chat');
});
test('agent can select edit, new, machine and answer tools',()=>{
  assert.deepEqual(parseAgentAction('{"action":"edit","value":"main.py","task":"fix crash"}'),{action:'edit',value:'main.py',task:'fix crash'});
  assert.equal(parseAgentAction('{"action":"new","value":"test.py","task":"add tests"}').action,'new');
  assert.equal(parseAgentAction('{"action":"machine","value":"."}').action,'machine');
  assert.throws(()=>parseAgentAction('{"action":"edit","value":"main.py"}'));
});
test('tool output is trimmed before passing to a model',()=>{
  assert.ok(compactObservation({action:'read',value:'file.txt'},'x'.repeat(900)).length<750);
});
test('fast common tasks skip a slow planner generation',()=>{
  assert.deepEqual(routeTask('edit hello.py to print hello'),{mode:'quick',action:'edit',value:'hello.py',task:'print hello'});
  assert.deepEqual(routeTask('create hello.py to greet me'),{mode:'quick',action:'new',value:'hello.py',task:'greet me'});
  assert.deepEqual(routeTask('run git status'),{mode:'quick',action:'shell',value:'git status'});
  assert.deepEqual(routeTask('read README.md and explain it'),{mode:'quick',action:'read',value:'README.md'});
  assert.deepEqual(routeTask('inspect my project'),{mode:'agent',firstAction:{action:'files',value:'.'}});
});
