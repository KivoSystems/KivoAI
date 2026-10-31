import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync, mkdirSync, readFileSync, writeFileSync, symlinkSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Workspace, diffPreview} from './projectmate-workspace.mjs';
import {mascot, parseResponse, chooseModel} from './projectmate-cli.mjs';

function fixture(t) {
  const root=mkdtempSync(join(tmpdir(),'projectmate-unit-'));
  t.after(()=>rmSync(root,{recursive:true,force:true}));
  const workspace=join(root,'project');
  mkdirSync(workspace);
  return {root,workspace, files:new Workspace(workspace)};
}

test('Kivo geometric mascot is visible and unique',()=>{
  assert.match(mascot(),/◉  ◉/);
  assert.match(mascot(),/▿/);
});
test('JSON parser accepts code fences and rejects invalid model edits',()=>{
  const edited=parseResponse('```json\n{"summary":"Updated","content":"print(1)\\n"}\n```');
  assert.equal(edited.content,'print(1)\n');
  assert.throws(()=>parseResponse('just print(1)'),/usable file/);
});
test('Kimi-lowmem wins on constrained Asahi hardware',()=>{
  assert.equal(chooseModel(['hf.co/mradermacher/Kimi-VL-A3B-Instruct-GGUF:Q4_K_M','kimi-lowmem']), 'kimi-lowmem');
  assert.throws(()=>chooseModel(['qwen3:4b'],'kimi-lowmem'),/not installed/);
});
test('workspace reads, previews, edits and undoes file safely',t=>{
  const {root,files,workspace}=fixture(t);
  writeFileSync(join(workspace,'hello.py'),'print("hi")\n');
  assert.equal(files.read('hello.py'),'print("hi")\n');
  assert.match(diffPreview('old\n','new\n'),/- old/);
  const result=files.write('hello.py','print("hello")\n',join(root,'backups'));
  assert.equal(result.unchanged,false);
  assert.equal(files.read('hello.py'),'print("hello")\n');
  assert.equal(files.undo(),'hello.py');
  assert.equal(readFileSync(join(workspace,'hello.py'),'utf8'),'print("hi")\n');
});
test('new file can be created and then safely undone',t=>{
  const {root,files,workspace}=fixture(t);
  files.write('src/new.py','print("hey")\n',join(root,'backups'));
  assert.equal(files.read('src/new.py'),'print("hey")\n');
  assert.equal(files.undo(),'src/new.py');
  assert.throws(()=>files.read('src/new.py'),/Not found|does not exist/);
});
test('undo refuses to overwrite external changes',t=>{
  const {root,files,workspace}=fixture(t);
  writeFileSync(join(workspace,'file.txt'),'before');
  files.write('file.txt','after',join(root,'backups'));
  writeFileSync(join(workspace,'file.txt'),'external');
  assert.throws(()=>files.undo(),/changed since/);
  assert.equal(files.read('file.txt'),'external');
});
test('outside paths and symlink escapes are rejected',t=>{
  const {root,files,workspace}=fixture(t);
  writeFileSync(join(root,'outside.txt'),'secret');
  assert.throws(()=>files.read('../outside.txt'),/leaves the project/);
  assert.throws(()=>files.write('/tmp/evil.txt','oops',join(root,'backups')),/relative/);
  symlinkSync(join(root,'outside.txt'),join(workspace,'link.txt'));
  assert.throws(()=>files.read('link.txt'),/Symlink/);
  symlinkSync(join(root,'missing.txt'),join(workspace,'broken-link'));
  assert.throws(()=>files.write('broken-link','test',join(root,'backups')),/Symlink/);
});
test('workspace ignores dependency and git directories',t=>{
  const {files,workspace}=fixture(t);
  mkdirSync(join(workspace,'.git'));mkdirSync(join(workspace,'node_modules'));
  writeFileSync(join(workspace,'main.py'),'hello');
  assert.deepEqual(files.files(),['   main.py']);
});

test('unlimited model stream by default; short output options are respected',async()=>{
  const {callModel}=await import('./projectmate-cli.mjs');
  let request;
  const encoder=new TextEncoder();
  const result=await callModel({model:'test-kimi',messages:[{role:'user',content:'hi'}],context:1024,
    heartbeat:false,maxTokens:144,
    fetcher:async (url,opts)=>{
      request={url,opts};
      return {ok:true,body:(async function*(){yield encoder.encode('{"message":{"content":"hello"}}\n');})()};
    }});
  assert.equal(result,'hello');
  assert.equal(request.opts.signal,undefined);
  const body=JSON.parse(request.opts.body);
  assert.equal(body.options.num_predict,144);
  assert.equal(body.options.num_ctx,1024);
  assert.equal(body.stream,true);
});

test('native HTTP Ollama streaming has no implicit 180-second deadline',async(t)=>{
  const {createServer}=await import('node:http');
  const {callModel}=await import('./projectmate-cli.mjs');
  let requested;
  const server=createServer(async(req,res)=>{
    const chunks=[];for await(const c of req)chunks.push(c);
    requested=JSON.parse(Buffer.concat(chunks).toString('utf8'));
    res.writeHead(200,{'content-type':'application/x-ndjson'});
    setTimeout(()=>{res.write(JSON.stringify({message:{content:'progress '}})+'\n');res.end(JSON.stringify({message:{content:'done'}})+'\n');},120);
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(()=>server.close());
  const url='http://127.0.0.1:'+server.address().port;
  const output=await callModel({model:'local',messages:[{role:'user',content:'hello'}],context:1024,heartbeat:false,ollamaUrl:url,maxTokens:200});
  assert.equal(output,'progress done');
  assert.equal(requested.options.num_predict,200);
  assert.equal(requested.stream,true);
});

test('speed presets keep chat short while supporting longer explanations', async()=>{
  const {speedBudget}=await import('./projectmate-cli.mjs');
  assert.equal(speedBudget('turbo'),96);
  assert.equal(speedBudget('balanced'),256);
  assert.equal(speedBudget('quality'),512);
  assert.equal(speedBudget('turbo',192),192);
  assert.throws(()=>speedBudget('madeup'),/Speed must/);
});

test('streaming forwards generated chunks and reports Ollama timing metrics', async()=>{
  const {callModel}=await import('./projectmate-cli.mjs');
  const encoder=new TextEncoder();
  const tokens=[];
  let stats;
  const result=await callModel({model:'test',messages:[{role:'user',content:'hi'}],context:512,
    heartbeat:false,maxTokens:24,onToken:tok=>tokens.push(tok),onStats:metrics=>{stats=metrics;},
    fetcher:async()=>({ok:true,body:(async function*(){
      yield encoder.encode(JSON.stringify({message:{content:'Hel'}})+'\n');
      yield encoder.encode(JSON.stringify({message:{content:'lo'}})+'\n');
      yield encoder.encode(JSON.stringify({done:true,eval_count:2,eval_duration:100_000_000,prompt_eval_count:8,load_duration:500_000_000})+'\n');
    })()}),
  });
  assert.equal(result,'Hello');
  assert.deepEqual(tokens,['Hel','lo']);
  assert.equal(stats.generatedTokens,2);
  assert.equal(stats.tokensPerSecond,20);
  assert.equal(stats.promptTokens,8);
  assert.equal(stats.loadMs,500);
});
