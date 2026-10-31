import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {spawn} from 'node:child_process';
import {mkdtempSync, mkdirSync, writeFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const CLI=join(dirname(fileURLToPath(import.meta.url)),'projectmate-cli.mjs');

test('CLI uses smart/coder models and retrieves saved preference without asking model',async t=>{
  const root=mkdtempSync(join(tmpdir(),'kivo-082-e2e-'));
  const home=join(root,'data');
  const project=join(root,'project');
  mkdirSync(home);mkdirSync(project);
  t.after(()=>rmSync(root,{force:true,recursive:true}));
  writeFileSync(join(home,'smart-settings.json'),JSON.stringify({enabled:true,model:'qwen3.5:4b'}));
  writeFileSync(join(home,'coding-model.txt'),'qwen2.5-coder:7b');
  writeFileSync(join(home,'context-settings.json'),JSON.stringify({mode:'auto',base:2048,cap:8192}));
  const requests=[];
  const server=createServer(async (req,res)=>{
    if(req.url==='/api/tags'){
      res.writeHead(200,{'content-type':'application/json'});
      res.end(JSON.stringify({models:['kimi-q2','qwen3.5:4b','qwen2.5-coder:7b'].map(name=>({name}))}));return;
    }
    if(req.url==='/api/chat'){
      let data='';for await(const chunk of req)data+=chunk;
      const json=JSON.parse(data);requests.push(json);
      const answer=json.model==='qwen2.5-coder:7b'
        ? '```python\ndef is_prime(n):\n    return n > 1 and all(n % d != 0 for d in range(2, int(n ** 0.5) + 1))\n```\nTest with 0, 1, 2, 9 and 17.'
        : 'A Pygame program can freeze if events are not processed each frame. Call pygame.event.get() and handle QUIT.';
      res.writeHead(200,{'content-type':'application/x-ndjson'});
      res.end(JSON.stringify({message:{content:answer}})+'\n'+JSON.stringify({done:true,eval_count:26,eval_duration:1e9})+'\n');return;
    }
    res.writeHead(404);res.end();
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(()=>server.close());
  const proc=spawn(process.execPath,[CLI,'--project',project,'--model','kimi-q2','--speed','turbo'],{
    env:{...process.env,KIVO_HOME:home,PROJECTMATE_OLLAMA_URL:`http://127.0.0.1:${server.address().port}`,NO_COLOR:'1'},
    stdio:['pipe','pipe','pipe']});
  t.after(()=>proc.kill('SIGKILL'));
  let stdout='',stderr='';
  let prompts=0;
  const waiters=[];
  proc.stdout.on('data',chunk=>{
    stdout+=chunk.toString();
    prompts=(stdout.match(/❯ /g)||[]).length;
    for(let i=waiters.length-1;i>=0;i--)if(prompts>=waiters[i].expected){waiters[i].resolve();waiters.splice(i,1);}
  });
  proc.stderr.on('data',chunk=>{stderr+=chunk.toString();});
  const waitFor=expected=>new Promise((resolve,reject)=>{
    if(prompts>=expected)return resolve();
    const timeout=setTimeout(()=>reject(new Error(`Kivo prompt ${expected} did not arrive. output=${stdout.slice(-1200)} error=${stderr.slice(-300)}`)),10000);
    waiters.push({expected,resolve:()=>{clearTimeout(timeout);resolve();}});
  });
  const commands=[
    '/memory remember i prefer complete working source code rather than small snippets',
    'do i prefer small snippets or complete source code?',
    'Explain why my Python program might freeze when using pygame, and show me how to fix it.',
    'Write a Python function that checks whether a number is prime, then explain how you would test it.',
  ];
  for(let i=0;i<commands.length;i++){
    await waitFor(i+1);
    proc.stdin.write(commands[i]+'\n');
  }
  await waitFor(commands.length+1);
  proc.stdin.write('/exit\n');
  await new Promise(resolve=>proc.once('exit',resolve));
  assert.match(stdout,/Saved preference memory locally/i);
  assert.match(stdout,/Based on your saved preferences:/);
  assert.match(stdout,/complete working source code rather than small snippets/i);
  assert.match(stdout,/pygame\.event\.get\(\)/);
  assert.match(stdout,/def is_prime\(n\)/);
  assert.doesNotMatch(stdout,/AUTO AGENT|Planner could not/);
  assert.equal(requests.length,2,'memory recall must not consume a model request');
  assert.equal(requests[0].model,'qwen3.5:4b');
  assert.equal(requests[1].model,'qwen2.5-coder:7b');
  assert.ok(requests.every(req=>req.options.num_ctx>=2048));
});
