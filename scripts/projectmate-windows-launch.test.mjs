import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, symlinkSync, writeFileSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { subprocessSpec } from './projectmate-kimi-local.mjs';

test('Windows node.exe path and project path with spaces are kept as individual argv values', () => {
  const command = 'C:\Program Files\nodejs\node.exe';
  const args = ['scripts/projectmate-cli.mjs', '--project', 'C:\Users\Theo Wilton\My Project'];
  const spec = subprocessSpec(command, args, {platform:'win32'});
  assert.equal(spec.command, command);
  assert.deepEqual(spec.args, args);
  assert.equal(spec.shell, false);
});

test('Windows pnpm branch uses an explicit cmd invocation with fixed arguments', () => {
  const spec = subprocessSpec('pnpm', ['dev:cli'], { platform:'win32', comspec:'C:\Windows\System32\cmd.exe' });
  assert.deepEqual(spec, {command:'C:\Windows\System32\cmd.exe', args:['/d','/s','/c','pnpm dev:cli'], shell:false});
  assert.throws(() => subprocessSpec('pnpm', ['a&evil'], {platform:'win32'}));
});

test('native executable invoked from a path containing spaces runs without shell parsing', () => {
  const dir = mkdtempSync(join(tmpdir(),'projectmate-win-path-test-'));
  try {
    const spaceFolder = join(dir,'Program Files','nodejs');
    mkdirSync(spaceFolder,{recursive:true});
    const exe = join(spaceFolder,'node');
    symlinkSync(process.execPath,exe);
    const project = join(dir,'My Project');
    mkdirSync(project);
    const spec = subprocessSpec(exe, ['-e', 'process.stdout.write(process.argv[1])',project]);
    const r = spawnSync(spec.command,spec.args,{encoding:'utf8',shell:spec.shell});
    assert.equal(r.status,0,r.stderr);
    assert.equal(r.stdout,project);
  } finally {rmSync(dir,{force:true,recursive:true});}
});
