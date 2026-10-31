#!/usr/bin/env node
/**
 * Kivo // Kimi Local launcher.
 * Uses the real Kimi Code CLI source and locally hosted Moonshot Kimi weights.
 * Never authenticates to Moonshot, requests paid credits, or sends prompts to a cloud provider.
 * No third-party dependencies in this launcher.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const HOME = resolve(process.env.KIVO_HOME || process.env.PROJECTMATE_KIMI_HOME || join(homedir(), '.projectmate-kimi'));
const CONFIG = join(HOME, 'config.toml');
const DEFAULT_OLLAMA_URL = 'http://127.0.0.1:11434';

export function validateOllamaUrl(raw) {
  let url;
  try { url = new URL(raw); } catch { throw new Error('Invalid local Ollama URL'); }
  if (url.protocol !== 'http:' || !['127.0.0.1','[::1]','localhost'].includes(url.hostname) ||
      url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
    throw new Error('Ollama URL must be a local HTTP address, e.g. http://127.0.0.1:11435');
  }
  return url.origin;
}

const DEFAULT_MODEL = 'hf.co/mradermacher/Kimi-VL-A3B-Instruct-GGUF:Q4_K_M';
const CHAT_CONTEXT_DEFAULT = 1024;
const argv = process.argv.slice(2);

function hasFlag(name) { return argv.includes(name); }
function optValue(name) {
  const at = argv.indexOf(name);
  if (at < 0) return undefined;
  const value = argv[at + 1];
  if (!value || value.startsWith('--')) throw new Error(`Expected value after ${name}`);
  return value;
}

function quoted(value) { return JSON.stringify(value); }

export function renderConfig({ model, capabilities = [], context = 8192, ollamaUrl = DEFAULT_OLLAMA_URL }) {
  ollamaUrl=validateOllamaUrl(ollamaUrl);
  // This config contains only a loopback backend. No paid Kimi service, no OAuth, and no fallback.
  if (!model || typeof model !== 'string' || model.includes('\n') || model.includes('\r')) {
    throw new Error('Model name must be a single, nonempty line.');
  }
  if (!Number.isSafeInteger(context) || context < 2048 || context > 131072) {
    throw new Error('Context size must be an integer from 2048 to 131072.');
  }
  const allowed = ['image_in', 'tool_use'];
  const declared = [...new Set(capabilities)].filter(x => allowed.includes(x));
  return [
    '# Kivo // Kimi Local (generated; completely offline inference)',
    '# Independent of ~/.kimi-code: no Moonshot credits, Kimi login, or subscription.',
    'default_model = "projectmate/kimi-local"',
    'default_permission_mode = "manual"',
    'default_plan_mode = false',
    'telemetry = false',
    'disable_feedback_survey = true',
    'auto_session_title = false',
    '',
    '[providers.local_ollama]',
    'type = "openai"',
    `base_url = ${quoted(ollamaUrl+'/v1')}`,
    'api_key = "ollama" # Local API placeholder, NOT a paid service key',
    '',
    '[models."projectmate/kimi-local"]',
    'provider = "local_ollama"',
    `model = ${quoted(model)}`,
    `max_context_size = ${context}`,
    'display_name = "Kimi Local (Moonshot weights)"',
    `capabilities = [${declared.map(x => quoted(x)).join(', ')}]`,
    '',
    '[loop_control]',
    'max_attempts_per_step = 5',
    'reserved_context_size = 2048',
    '',
  ].join('\n');
}

export function findModel(tags, preferred = DEFAULT_MODEL) {
  const names = (tags?.models || []).flatMap(row => [row.name, row.model].filter(x => typeof x === 'string'));
  const exact = names.find(n => n.toLowerCase() === preferred.toLowerCase());
  if (preferred !== DEFAULT_MODEL && preferred.toLowerCase() !== 'kimi-lowmem') return exact;
  if (preferred.toLowerCase() === 'kimi-lowmem' && exact) return exact;
  return names.find(n => n.toLowerCase() === 'kimi-lowmem') ||
    names.find(n => /kimi.*q2_k/i.test(n)) ||
    exact || names.find(n => /kimi[-_/]?vl|kimi[-_/]?a3b/i.test(n));
}

async function getJson(pathname, payload, ollamaUrl = DEFAULT_OLLAMA_URL) {
  const result = await fetch(ollamaUrl + pathname, {
    method: payload === undefined ? 'GET' : 'POST',
    headers: payload === undefined ? undefined : {'content-type':'application/json'},
    body: payload === undefined ? undefined : JSON.stringify(payload),
    signal: AbortSignal.timeout(8000),
  });
  if (!result.ok) throw new Error(`Ollama responded ${result.status} on ${pathname}`);
  return result.json();
}

// Launch native executables without a shell, preserving Windows paths such as
// C:\Program Files\nodejs\node.exe and project directories containing spaces.
// Only the fixed pnpm dev command needs cmd.exe on Windows (pnpm is a .cmd shim).
export function subprocessSpec(command, args, { platform = process.platform, comspec = process.env.ComSpec || 'cmd.exe' } = {}) {
  if (platform === 'win32' && command === 'pnpm') {
    if (args.length !== 1 || args[0] !== 'dev:cli') throw new Error('Unsupported pnpm invocation');
    return { command: comspec, args: ['/d', '/s', '/c', 'pnpm dev:cli'], shell: false };
  }
  return { command, args, shell: false };
}

function spawn(command, args, options = {}) {
  const invocation = subprocessSpec(command, args);
  const result = spawnSync(invocation.command, invocation.args, {
    stdio: 'inherit',
    shell: false,
    cwd: ROOT,
    ...options,
  });
  if (result.error) throw new Error(`Could not launch ${command}: ${result.error.message}`);
  if (result.status !== 0) throw new Error(`${command} exited with code ${result.status}`);
}

async function main() {
  if (hasFlag('--help')) {
    console.log(`Kivo Kimi Local\n  node scripts/projectmate-kimi-local.mjs [--setup-only] [--ollama-url http://127.0.0.1:11435] [--model OLLAMA_ID] [--context 1024] [--context-max 8192] [--project PATH] [--timeout 0] [--speed turbo] [--coding-model MODEL] [--predict 96] [--agent] [--force]\n\nUses existing Ollama model; run 'ollama list' to find its name.\n`);
    return;
  }
  const ollamaUrl = validateOllamaUrl(optValue('--ollama-url') || process.env.PROJECTMATE_OLLAMA_URL || DEFAULT_OLLAMA_URL);
  let tags;
  try { tags = await getJson('/api/tags', undefined, ollamaUrl); }
  catch (e) {
    throw new Error(`Ollama isn't accessible at ${ollamaUrl}. Start Ollama first. (${e.message})`);
  }
  const selected = optValue('--model');
  const preferred = selected || DEFAULT_MODEL;
  const installedNames = (tags?.models || []).flatMap(row => [row.name, row.model].filter(x => typeof x === 'string'));
  const found = findModel(tags, preferred);
  if (!found) {
    throw new Error(`No matching local model for ${preferred}.\nInstalled Ollama models:\n  ${installedNames.join('\n  ') || '(none)'}\nUse --model EXACT_NAME from 'ollama list'. Existing local models do not need downloading again.`);
  }
  let show = {};
  try { show = await getJson('/api/show', { model: found }, ollamaUrl); }
  catch (e) { console.warn(`Warning: Ollama model capability lookup failed (${e.message}); running in text-only mode.`); }
  const ollamaCapabilities = Array.isArray(show.capabilities) ? show.capabilities : [];
  const capabilities = [];
  if (ollamaCapabilities.includes('vision')) capabilities.push('image_in');
  if (ollamaCapabilities.includes('tools')) capabilities.push('tool_use');
  if (!capabilities.includes('tool_use')) {
    console.warn('Note: This Kimi model does not advertise native tool calling. Kivo /edit, /new, /replace, and /undo still work with your approval; --agent automation may not.');
  }
  const context = Number(optValue('--context') || String(CHAT_CONTEXT_DEFAULT));
  if (!Number.isSafeInteger(context) || context < 512 || context > 32768) {
    throw new Error('Context must be an integer between 512 and 32768.');
  }
  if (!existsSync(CONFIG) || hasFlag('--force')) {
    mkdirSync(HOME, { recursive: true });
    writeFileSync(CONFIG, renderConfig({model: found, capabilities, context: Math.max(2048, context), ollamaUrl}), { encoding: 'utf8', mode: 0o600 });
    console.log(`Wrote isolated local-only config: ${CONFIG}`);
  } else {
    const existing = readFileSync(CONFIG, 'utf8');
    if (!existing.includes(`base_url = ${quoted(ollamaUrl+'/v1')}`) ||
        !existing.includes('default_model = "projectmate/kimi-local"')) {
      throw new Error(`Refusing to use unexpected config file ${CONFIG}. Examine it or pass --force to replace.`);
    }
    console.log(`Using existing config: ${CONFIG}`);
  }
  if (selected && selected !== found) console.log(`Resolved model alias ${selected} → ${found}`);
  console.log(`Kimi model: ${found}`);
  console.log(`Backend: Ollama at ${ollamaUrl} (no paid cloud service)`);
  if (hasFlag('--setup-only')) {
    console.log('Setup complete. The lightweight Kivo chat mode needs Node.js >=20; --agent requires Node.js >=24.15 and pnpm dependencies.');
    return;
  }
  const project = resolve(optValue('--project') || process.cwd());
  if (!existsSync(project)) throw new Error(`Project directory does not exist: ${project}`);
  const nodeMajor = Number(process.versions.node.split('.')[0]);
  const nodeMinor = Number(process.versions.node.split('.')[1]);
  if (hasFlag('--agent')) {
    if (nodeMajor < 24 || (nodeMajor === 24 && nodeMinor < 15)) {
      throw new Error('Original Kimi Code agent requires Node.js >=24.15.0.');
    }
    if (!existsSync(join(ROOT, 'node_modules'))) {
      throw new Error('Agent dependencies not installed; run pnpm install at the source root.');
    }
    console.log('Launching the original Kimi Code agent. Tool calling requires model support.');
    spawn('pnpm', ['dev:cli'], { env: { ...process.env, PROJECTMATE_LOCAL:'1', KIMI_CODE_HOME: HOME, KIMI_MODEL_NAME: '' } });
    return;
  }
  if (nodeMajor < 20) throw new Error('Kivo terminal mode requires Node.js >=20.');
  console.log('Launching Kivo terminal mode (no pnpm dependencies needed)...');
  const passed = ['scripts/projectmate-cli.mjs', '--ollama-url', ollamaUrl, '--model', found, '--context', String(context), '--project', project];
  for(const flag of ['--timeout','--predict','--speed','--coding-model','--context-max']) {const value=optValue(flag);if(value!==undefined)passed.push(flag,value);}
  spawn(process.execPath, passed);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(err => { console.error(`\nKivo Kimi Local: ${err.message}`); process.exitCode = 1; });
}
