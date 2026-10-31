import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,existsSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Workspace} from './projectmate-workspace.mjs';
import {projectMap,selectCodeContext,validateCodePlan,codePlanPrompt} from './projectmate-coder.mjs';
import {canConsiderMemory,memoryDecision,loadMemory,saveMemory,recordMemory,removeMemory,memoryForPrompt,sensitiveMemory} from './projectmate-aut-memory.mjs';
import {validateGeneratedCode} from './projectmate-code-guard.mjs';
import {routeTask} from './projectmate-router.mjs';
import {PROJECTMATE_VERSION} from './projectmate-cli.mjs';

const workspace=()=>{
  const dir=mkdtempSync(join(tmpdir(),'projectmate-v060-'));
  mkdirSync(join(dir,'src'));mkdirSync(join(dir,'node_modules'));
  writeFileSync(join(dir,'src','main.py'),'def main():\n    print("hi")\nmain()\n');
  writeFileSync(join(dir,'src','utils.js'),'export const add = (a,b) => a+b;\n');
  writeFileSync(join(dir,'node_modules','ignore.js'),'bad');
  return {dir,ws:new Workspace(dir)};
};

test('version and natural coding request route',()=>{
  assert.equal(PROJECTMATE_VERSION,'0.7.0');
  assert.equal(routeTask('rewrite the source code in my project').mode,'code');
  assert.equal(routeTask('inspect my project').mode,'agent');
  assert.equal(routeTask('search the web for Unity docs').action,'search');
});
test('project mapper ignores dependencies and gives bounded real paths',()=>{
 const {dir,ws}=workspace();try{
   const files=projectMap(ws);
   assert.deepEqual(files.map(x=>x.path).sort(),['src/main.py','src/utils.js']);
   assert.match(selectCodeContext(ws,files,'fix main.py'),/def main/);
   assert.match(codePlanPrompt({task:'fix source code',files,context:''}),/src\/main.py/);
 }finally{rmSync(dir,{recursive:true,force:true});}
});
test('coding plan can edit nested real code and safely create a new file',()=>{
 const {dir,ws}=workspace();try{
  const files=projectMap(ws);
  const plan=validateCodePlan(JSON.stringify({summary:'Repair main and add tests',changes:[
   {path:'src/main.py',task:'Make main print hello',action:'edit'},
   {path:'tests/test_main.py',task:'Add a test for the main program',action:'new'}]}),ws,files);
  assert.equal(plan.changes.length,2);
  assert.equal(plan.changes[0].action,'edit');assert.equal(plan.changes[1].action,'new');
 }finally{rmSync(dir,{recursive:true,force:true});}
});
test('coding plan rejects missing edits, traversal, unrecognised types and too many changes',()=>{
 const {dir,ws}=workspace();try{
  const files=projectMap(ws);
  const plan=changes=>validateCodePlan({summary:'bad',changes},ws,files);
  assert.throws(()=>plan([{path:'../outside.py',task:'Rewrite this file',action:'new'}]),/unsafe|leaves/);
  assert.throws(()=>plan([{path:'src/invented.py',task:'Rewrite this file',action:'edit'}]),/missing/);
  assert.throws(()=>plan([{path:'src/main.exe',task:'Rewrite binary file',action:'new'}]),/invalid/);
  assert.throws(()=>plan([{path:'src/main.py',task:'Change main function'},{path:'src/main.py',task:'Change main again'}]),/duplicate/);
  assert.throws(()=>plan(Array.from({length:4},(_,i)=>({path:`file${i}.py`,task:'Create some code'}))),/1-3/);
 }finally{rmSync(dir,{recursive:true,force:true});}
});
test('several source writes can be undone in reverse with original contents restored',()=>{
 const {dir,ws}=workspace();try{
  const backups=join(dir,'backups');
  ws.write('src/main.py','print("new")\n',backups);
  ws.write('src/new.py','print("brand new")\n',backups);
  assert.equal(ws.undo(),'src/new.py');
  assert.equal(existsSync(join(dir,'src','new.py')),false);
  assert.equal(ws.undo(),'src/main.py');
  assert.match(readFileSync(join(dir,'src','main.py'),'utf8'),/print\("hi"\)/);
 }finally{rmSync(dir,{recursive:true,force:true});}
});
test('code guard detects invalid Python, JavaScript and JSON but accepts valid code',()=>{
  assert.match(validateGeneratedCode('def bad(:','hi.py','write a game'),/syntax|Invalid/);
  assert.match(validateGeneratedCode('function (oops {','hi.js','write a function'),/JavaScript syntax/);
  assert.match(validateGeneratedCode('{garbage}','settings.json','generate config'),/JSON syntax/);
  assert.equal(validateGeneratedCode('export const answer = 42;\n','hi.js','code'),null);
});
test('memory candidates reject sensitive data, hallucinations and casual questions',()=>{
 assert.equal(canConsiderMemory('hello there'),false);
 assert.equal(canConsiderMemory('I prefer cyan interfaces and dark backgrounds'),true);
 assert.equal(sensitiveMemory('My password is hunter2'),true);
 assert.equal(memoryDecision('{"remember":true,"kind":"preference","fact":"User prefers cyan interfaces and dark backgrounds"}', 'I prefer cyan interfaces and dark backgrounds')?.kind,'preference');
 assert.equal(memoryDecision('{"remember":true,"kind":"project","fact":"My home address is hidden"}', 'My project is about computers'),null);
 assert.equal(memoryDecision('{"remember":true,"kind":"project","fact":"The user loves nuclear reactors and cooking"}', 'My project is about computers'),null);
});
test('memory is reviewable, forgettable, persisted and relevance-filtered',()=>{
 const home=mkdtempSync(join(tmpdir(),'projectmate-memory-'));try{
   const rec=recordMemory(home,{kind:'preference',fact:'I prefer dark cyan coding interfaces'});
   assert.equal(loadMemory(home).length,1);
   assert.equal(recordMemory(home,{kind:'preference',fact:'I prefer dark cyan coding interfaces'}).id,rec.id);
   assert.match(memoryForPrompt(loadMemory(home),'can we make a cyan interface'),/dark cyan/);
   assert.equal(memoryForPrompt(loadMemory(home),'what is a potato'), '');
   assert.equal(removeMemory(home,rec.id),true);
   assert.equal(loadMemory(home).length,0);
 }finally{rmSync(home,{recursive:true,force:true});}
});
test('read-only project verification does not require running generated code',()=>{
  const {dir,ws}=workspace();try{
    const map=projectMap(ws);
    for(const f of map){
      if(f.path.endsWith('.py'))assert.equal(validateGeneratedCode(ws.read(f.path),f.path,'review module'),null);
    }
  }finally{rmSync(dir,{recursive:true,force:true});}
});
