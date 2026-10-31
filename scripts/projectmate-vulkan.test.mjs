import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateOllamaUrl as launcherUrl, renderConfig } from './projectmate-kimi-local.mjs';
import { validateOllamaUrl as cliUrl, listModels } from './projectmate-cli.mjs';

for (const validate of [launcherUrl, cliUrl]) {
  test('Vulkan loopback Ollama endpoint is accepted', () => {
    assert.equal(validate('http://127.0.0.1:11435'), 'http://127.0.0.1:11435');
    assert.throws(()=>validate('https://api.moonshot.ai'), /local HTTP/);
    assert.throws(()=>validate('http://192.168.1.22:11435'), /local HTTP/);
    assert.throws(()=>validate('http://127.0.0.1:11435/other'), /local HTTP/);
  });
}
test('isolated Kimi configuration points at Vulkan port',()=>{
 const value=renderConfig({model:'kimi-lowmem',context:2048,ollamaUrl:'http://127.0.0.1:11435'});
 assert.match(value, /base_url = "http:\/\/127\.0\.0\.1:11435\/v1"/);
 assert.doesNotMatch(value, /api\.moonshot/);
});
test('model listing respects selected Ollama port',async()=>{
 let seen;
 const models=await listModels(async url => {seen=url;return {ok:true,json:async()=>({models:[{name:'kimi:test'}]})};},'http://127.0.0.1:11435');
 assert.equal(seen,'http://127.0.0.1:11435/api/tags');
 assert.deepEqual(models,['kimi:test']);
});
