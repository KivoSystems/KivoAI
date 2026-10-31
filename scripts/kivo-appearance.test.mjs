import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { THEMES, SHAPES, loadAppearance, saveAppearance, colorize, renderMascot, rawMascot } from './kivo-appearance.mjs';
import { KIVO_VERSION, mascot } from './projectmate-cli.mjs';
import { identityResponse } from './projectmate-identity.mjs';
import { buildChatMessages } from './projectmate-chat-context.mjs';

test('v0.7.0 is Kivo and replies use the Kivo identity',()=>{
  assert.equal(KIVO_VERSION,'0.7.0');
  assert.match(identityResponse('who are you?'),/Kivo/);
  assert.doesNotMatch(identityResponse('who are you?'),/ProjectMate/);
  assert.match(buildChatMessages({prompt:'hi'})[0].content,/You are Kivo/);
});
test('avatar is a new, non-cyan geometric mascot with multiple shapes',()=>{
  assert.equal(Object.keys(SHAPES).length,3);
  assert.match(mascot(),/◇/);
  assert.match(renderMascot('orbit'),/◌/);
  assert.match(renderMascot('bloom'),/◆/);
  assert.notEqual(rawMascot('prism'),rawMascot('orbit'));
});
test('colour themes have distinct violet, coral, and garden palettes',()=>{
  assert.equal(THEMES.prism.brand,'#AB89FF');
  assert.notEqual(THEMES.prism.brand,THEMES.sunset.brand);
  assert.notEqual(THEMES.sunset.brand,THEMES.garden.brand);
  const ansi=colorize('hello','prism','accent',true);
  assert.match(ansi,/\x1b\[38;2;255;159;135m/);
  assert.equal(colorize('hello','prism','accent',false),'hello');
  assert.equal(colorize('hello','mono','accent',true),'hello');
});
test('selected theme and shape survive restart in a local settings file',t=>{
  const home=mkdtempSync(join(tmpdir(),'kivo-appearance-'));
  t.after(()=>rmSync(home,{recursive:true,force:true}));
  assert.deepEqual(loadAppearance(home),{theme:'prism',shape:'prism'});
  const chosen=saveAppearance(home,{theme:'sunset',shape:'orbit'});
  assert.deepEqual(chosen,{theme:'sunset',shape:'orbit'});
  assert.deepEqual(loadAppearance(home),chosen);
  assert.match(readFileSync(join(home,'appearance.json'),'utf8'),/sunset/);
  writeFileSync(join(home,'appearance.json'),'{ "theme": "bogus", "shape": "broken" }');
  assert.deepEqual(loadAppearance(home),{theme:'prism',shape:'prism'});
});
