import {test} from 'node:test';
import assert from 'node:assert/strict';
import {findSmartModel, needsThought, selectChatModel, safeAgentFallback} from './kivo-smart.mjs';
import {callModel, KIVO_VERSION} from './projectmate-cli.mjs';

test('v0.8.0 is the installed version',()=>assert.equal(KIVO_VERSION,'0.8.2'));
test('prefer a locally installed mid-size reasoning model without downloads',()=>{
  const fast='hf.co/mradermacher/Kimi-VL-A3B-Instruct-GGUF:Q2_K';
  assert.equal(findSmartModel([fast, 'qwen2.5-coder:7b','qwen3.5:4b'],fast),'qwen3.5:4b');
  assert.equal(findSmartModel([fast,'qwen3.5:9b','qwen3.5:4b'],fast),'qwen3.5:9b');
  assert.equal(findSmartModel([fast],fast),fast);
});
test('simple greetings use Kimi, harder questions use the smart model',()=>{
  const models={fastModel:'kimi-q2',smartModel:'qwen3.5:4b'};
  assert.equal(selectChatModel({...models,task:'hello!'}).model,'kimi-q2');
  assert.equal(selectChatModel({...models,task:'why did pygame crash and how do i fix it?'}).model,'qwen3.5:4b');
  assert.equal(selectChatModel({...models,task:'can you explain what happened?'}).smart,true);
  assert.equal(selectChatModel({...models,task:'why did it crash?',enabled:false}).model,'kimi-q2');
  assert.equal(needsThought('thanks'),false);
});
test('invalid agent planning falls back only to safe read-only tools',()=>{
  const allowed = new Set(['files','read','search','answer','edit','shell']);
  assert.deepEqual(safeAgentFallback('inspect my project',allowed),{action:'files',value:'.'});
  assert.equal(safeAgentFallback('inspect my project',allowed,new Set(['files'])),null);
  assert.equal(safeAgentFallback('edit main.py and run tests',allowed),null);
  assert.deepEqual(safeAgentFallback('search the web for Python docs',allowed).action,'search');
  assert.equal(safeAgentFallback('remove all files',allowed),null);
});
test('Qwen thinking can be explicitly disabled for reliable short JSON responses',async()=>{
  let body;
  const fetcher=async (_url,req)=>{
    body=JSON.parse(req.body);
    return {ok:true, body:(async function*(){yield Buffer.from(JSON.stringify({message:{content:'{"action":"files","value":"."}'}})+'\n'+JSON.stringify({done:true})+'\n');})()};
  };
  const reply=await callModel({model:'qwen3.5:4b',messages:[{role:'user',content:'list files'}],context:4096,think:false,maxTokens:200,fetcher,heartbeat:false});
  assert.match(reply,/"files"/);
  assert.equal(body.think,false);
  assert.equal(body.options.num_ctx,4096);
});

test('installer offers the smart model but never automatically downloads it',async()=>{
  const {readFileSync}=await import('node:fs');
  const {join,dirname}=await import('node:path');
  const {fileURLToPath}=await import('node:url');
  const root=join(dirname(fileURLToPath(import.meta.url)),'..');
  const installer=readFileSync(join(root,'installer.bat'),'utf8');
  assert.match(installer,/set "SMART_MODEL=qwen3\.5:4b"/);
  assert.match(installer,/choice \/C YN \/N \/M "Download Qwen3\.5 4B smart model\?/);
  assert.match(installer,/ollama pull "%SMART_MODEL%"/);
  assert.match(installer,/:smartModel/);
});
