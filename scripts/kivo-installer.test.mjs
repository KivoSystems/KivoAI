import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const installer = readFileSync(join(ROOT,'installer.bat'), 'utf8');
const docs = readFileSync(join(ROOT,'INSTALLATION.md'), 'utf8');
const gitignore = readFileSync(join(ROOT,'.gitignore'), 'utf8');

test('installer ships beside the functioning Kivo launcher', () => {
  assert.ok(existsSync(join(ROOT, 'kivo.cmd')));
  assert.match(installer,/if exist "%~dp0kivo\.cmd" goto projectFound/);
});
test('checks required Windows dependencies and Node major version', () => {
  assert.match(installer,/node -p "process\.versions\.node\.split\('\.'\)\[0\]"/);
  assert.match(installer,/OpenJS\.NodeJS\.LTS/);
  assert.match(installer,/Ollama\.Ollama/);
  assert.match(installer,/if %NODE_MAJOR% GEQ 22/);
});
test('only reaches locally hosted Ollama, uses direct CLI pulls', () => {
  assert.match(installer,/http:\/\/127\.0\.0\.1:11434\/api\/tags/);
  assert.match(installer,/ollama pull "%CHAT_MODEL%"/);
  assert.match(installer,/ollama pull "%CODING_MODEL%"/);
  assert.doesNotMatch(installer,/Invoke-Expression|iex\s*\(|curl\s+[^\r\n]*\|/i);
});
test('asks before installing packages and large models', () => {
  assert.match(installer,/choice \/C YN \/N \/M "Install this package/);
  assert.match(installer,/Download the Kimi Q2 chat model now/);
  assert.match(installer,/Download Qwen2\.5-Coder 7B/);
  assert.match(installer,/--accept-package-agreements --accept-source-agreements/);
});
test('does not overwrite existing coding model preferences or memories', () => {
  assert.match(installer,/if exist "%MEMORY_HOME%\\coding-model\.txt"/);
  assert.match(installer,/set "MEMORY_HOME=%KIVO_HOME%"/);
  assert.match(installer,/set "MEMORY_HOME=%PROJECTMATE_KIMI_HOME%"/);
  assert.doesNotMatch(installer,/(?:rd|rmdir|del)\s+\/?[sqf].*projectmate-kimi/i);
});
test('includes optional Python tooling and clear docs', () => {
  assert.match(installer,/Python\.Python\.3\.13/);
  assert.match(installer,/pip install --user pygame/);
  assert.match(docs,/Close Command Prompt/);
  assert.match(docs,/No paid API key/i);
  assert.match(gitignore,/\.env/);
  assert.match(gitignore,/memory\.json/);
});
