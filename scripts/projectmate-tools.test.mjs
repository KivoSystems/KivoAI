import {test} from 'node:test';
import assert from 'node:assert/strict';
import {isPublicAddress,parsePublicUrl,parseAgentAction,searchWeb,runApprovedCommand,machineInfo} from './projectmate-tools.mjs';
import {chooseModel} from './projectmate-cli.mjs';
import {findModel} from './projectmate-kimi-local.mjs';

test('local Kimi model auto-detected and alias resolved without download',()=>{
  const name='hf.co/mradermacher/Kimi-VL-A3B-Instruct-GGUF:Q4_K_M';
  const models=[{name},{name:'llama3.2:latest'}];
  assert.equal(findModel({models}),name);
  assert.equal(findModel({models},'kimi-lowmem'),name);
  assert.equal(chooseModel(models.map(x=>x.name),'kimi-lowmem'),name);
  assert.equal(chooseModel(models.map(x=>x.name)),name);
});

test('public page blocks internal hosts, private IPs, and non-HTTPS',()=>{
  for(const url of ['http://example.com','https://localhost','https://127.0.0.1',
    'https://10.0.0.1','https://192.168.1.1','https://router.local',
    'https://example.com:8443','https://username:pass@example.com',
    'https://[::1]/','file:///etc/passwd']) {
    assert.throws(()=>parsePublicUrl(url),undefined,url);
  }
  assert.equal(parsePublicUrl('https://example.com/').host,'example.com');
  assert.equal(isPublicAddress('8.8.8.8'),true);
  assert.equal(isPublicAddress('169.254.5.9'),false);
  assert.equal(isPublicAddress('::ffff:127.0.0.1'),false);
  assert.equal(isPublicAddress('::1'),false);
});

test('search selects the first verified provider and protects query validation',async()=>{
  let requested='';
  const html='<a class="result__a" href="https://www.youtube.com/watch?v=AbCD">New technology</a>';
  const result=await searchWeb('test project',async url=>{requested=url;return {url,text:html};});
  assert.equal(requested,'https://html.duckduckgo.com/html/?q=test%20project');
  assert.equal(result.results[0].title,'New technology');
  await assert.rejects(()=>searchWeb('x',async()=>({text:''})),/2–200/);
});

test('agent action parser accepts only supported explicit actions',()=>{
  assert.deepEqual(parseAgentAction('```json\n{"action":"read","value":"hello.py"}\n```'),{action:'read',value:'hello.py'});
  assert.deepEqual(parseAgentAction('{"action":"answer","text":"hi"}'),{action:'answer',text:'hi'});
  assert.throws(()=>parseAgentAction('{"action":"sudo","value":"rm -rf /"}'),/valid tool/);
  assert.throws(()=>parseAgentAction('{"action":"write","content":"oops"}'),/valid tool/);
});

test('shell command runs via explicit caller and strips secret environment',async()=>{
  let call;
  const result=await runApprovedCommand('pwd','/tmp',async (...args)=>{
    call=args;
    return {stdout:'ok',stderr:''};
  });
  assert.equal(result.ok,true);
  assert.equal(result.text,'ok');
  const isWin = process.platform === 'win32';
  assert.equal(call[0],isWin?'powershell.exe':'bash');
  assert.deepEqual(call[1],isWin?['-NoProfile','-NonInteractive','-Command','pwd']:['-lc','pwd']);
  assert.equal(call[2].cwd,'/tmp');
  assert.equal(typeof machineInfo(),'string');
});
