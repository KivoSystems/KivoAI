import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderConfig, findModel } from './projectmate-kimi-local.mjs';

test('generates standalone loopback-only config with no paid provider', () => {
  const value = renderConfig({ model: 'hf.co/owner/Kimi-VL-A3B-Instruct-GGUF:Q4_K_M', capabilities:['vision','tool_use', 'tool_use'], context:8192 });
  assert.match(value, /base_url = "http:\/\/127\.0\.0\.1:11434\/v1"/);
  assert.match(value, /default_permission_mode = "manual"/);
  assert.match(value, /capabilities = \["tool_use"\]/);
  assert.doesNotMatch(value, /https:\/\/api\.moonshot/);
  assert.doesNotMatch(value, /oauth\s*=/);
  assert.match(value, /telemetry = false/);
});

test('does not allow TOML injection from a model identifier', () => {
  assert.throws(() => renderConfig({model:'evil\n[providers.paid]', context:8192}));
});

test('prefers exact installed model and never silently selects an unrelated model', () => {
  assert.equal(findModel({models:[{name:'qwen3:8b'}, {name:'hf.co/mradermacher/Kimi-VL-A3B-Instruct-GGUF:Q4_K_M'}]}), 'hf.co/mradermacher/Kimi-VL-A3B-Instruct-GGUF:Q4_K_M');
  assert.equal(findModel({models:[{name:'qwen3:8b'}]}, 'kimi-custom'), undefined);
});
