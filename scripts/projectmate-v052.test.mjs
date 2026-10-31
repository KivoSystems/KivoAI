import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateGeneratedCode, checkPythonSyntax } from './projectmate-code-guard.mjs';
import { PYGAME_PLATFORMER, bundledFallback } from './projectmate-templates.mjs';
import { routeTask } from './projectmate-router.mjs';
import { isMetaNarration, isLoopingReply, compactSafeHistory } from './projectmate-response-guard.mjs';
import { relevantLessons } from './projectmate-learning.mjs';
import { PROJECTMATE_VERSION } from './projectmate-cli.mjs';

test('version and fixed splash match',()=>assert.equal(PROJECTMATE_VERSION,'0.8.2'));
test('rejects exact non-code main.py from the incident',()=>{
  const src='The player scores a goal and the game continues.';
  assert.match(validateGeneratedCode(src,'main.py','can you write a game using pygame'),/prose/);
});
test('rejects Python snippets without playable Pygame mechanics',()=>{
  const req='can you write a game using pygame';
  assert.match(validateGeneratedCode('import pygame\nprint("ready")','main.py',req),/game loop/);
  assert.match(validateGeneratedCode('import pygame\nwhile True:\n    pass','main.py',req),/QUIT/);
  assert.match(validateGeneratedCode('import pygame\nwhile True:\n    for event in pygame.event.get():\n        if event.type == pygame.QUIT:\n            break','main.py',req),/display/);
});
test('syntax checking rejects invalid code without executing it',()=>{
  assert.match(validateGeneratedCode('def game(:\n    pass','main.py','python script'),/syntax/i);
  assert.equal(validateGeneratedCode('print("Hello")\n','hello.py','write a simple greeting'),null);
});
test('bundle is a playable, syntactically valid pygame game template',()=>{
  assert.equal(checkPythonSyntax(PYGAME_PLATFORMER),null);
  assert.equal(validateGeneratedCode(PYGAME_PLATFORMER,'main.py','can you write a game using pygame'),null);
  assert.ok(bundledFallback('main.py','make a pygame game'));
  assert.equal(bundledFallback('main.py','make a pygame racing game'),null);
  assert.equal(bundledFallback('foo.js','pygame game'),null);
});
test('rejects model-internal user-intent narration instead of displaying it',()=>{
  const text='The user is asking if the AI assistant has done something.';
  assert.equal(isMetaNarration(text),true);
  assert.equal(isLoopingReply('have you done it?',text,[]),true);
  assert.equal(isMetaNarration('I have not checked the program yet.'),false);
  assert.equal(compactSafeHistory([{role:'user',content:'hello'},{role:'assistant',content:'The user is confirming their identity.'}]).length,0);
});
test('learn Python frameworks through actual research instead of internal narration',()=>{
  const route=routeTask('can you learn how to use pygame completely?');
  assert.equal(route.action,'research');
  assert.match(route.value,/pygame official documentation/);
});
test('do not promote old auto-saved search snippets and browser failures into prompts',()=>{
  const records=[
    {kind:'web_reference',createdAt:new Date().toISOString(),text:'Query: pygame. Search result titles: Random things',title:'pygame',projectId:''},
    {kind:'web_reference',createdAt:new Date().toISOString(),text:'Topic: pygame. A required part of this site couldn’t load',title:'pygame',projectId:''},
    {kind:'correction',createdAt:new Date().toISOString(),text:'Pygame needs an event loop and QUIT handling',title:'pygame',projectId:''},
  ];
  assert.deepEqual(relevantLessons(records,'pygame'),[records[2]]);
});
