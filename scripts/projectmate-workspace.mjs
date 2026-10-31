/** File operations for Kivo. Never follow symlinks or leave the selected workspace. */
import { lstatSync, realpathSync, readFileSync, readdirSync, mkdirSync, writeFileSync, renameSync, unlinkSync, existsSync } from 'node:fs';
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { randomUUID, createHash } from 'node:crypto';

export const MAX_FILE_BYTES = 96_000;
const IGNORED = new Set(['node_modules', '.git', 'dist', 'build', '.venv', '__pycache__', '.next']);
function statIfPresent(path) {
  try { return lstatSync(path); } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}
const checksum = data => createHash('sha256').update(data).digest('hex');

export class Workspace {
  constructor(root) {
    const actual = realpathSync(resolve(root));
    if (!lstatSync(actual).isDirectory()) throw new Error('Project path must be a directory.');
    this.root = actual;
    this.lastEdit = null;
    this.editStack = [];
  }

  path(input, { mayCreate = false, directory = false } = {}) {
    if (typeof input !== 'string' || !input.trim() || input.includes('\0')) throw new Error('Supply a file path.');
    if (isAbsolute(input)) throw new Error('Use paths relative to the project folder.');
    const target = resolve(this.root, input);
    const rel = relative(this.root, target);
    if (rel === '..' || rel.startsWith('..' + sep) || isAbsolute(rel)) {
      throw new Error('That path leaves the project folder.');
    }
    let walking = this.root;
    for (const component of rel.split(sep).filter(Boolean)) {
      walking = join(walking, component);
      const info = statIfPresent(walking);
      if (!info) {
        if (!mayCreate) throw new Error(`Not found: ${this.relative(walking)}`);
        continue;
      }
      if (info.isSymbolicLink()) throw new Error('Symlink paths are not allowed.');
      if (!info.isDirectory() && walking !== target) throw new Error('Parent path is not a directory.');
    }
    const stats = statIfPresent(target);
    if (stats) {
      if (directory && !stats.isDirectory()) throw new Error('Not a directory.');
      if (!directory && !stats.isFile()) throw new Error('Not a regular file.');
    } else if (!mayCreate) {
      throw new Error('Path does not exist.');
    }
    return target;
  }

  relative(path) { return relative(this.root, path) || '.'; }

  read(input) {
    const file = this.path(input);
    if (lstatSync(file).size > MAX_FILE_BYTES) throw new Error('File too large for local AI editing (96 KB limit).');
    const bytes = readFileSync(file);
    if (bytes.includes(0)) throw new Error('Binary file cannot be read as source text.');
    return bytes.toString('utf8');
  }

  files(at = '.', limit = 70) {
    const dir = this.path(at, {directory:true});
    const entries = readdirSync(dir, { withFileTypes: true })
      .filter(e => !IGNORED.has(e.name) && !e.name.startsWith('.'))
      .sort((a,b) => Number(b.isDirectory())-Number(a.isDirectory()) || a.name.localeCompare(b.name));
    return entries.slice(0, limit).map(e => `${e.isDirectory() ? '📁' : '  '} ${join(this.relative(dir), e.name).replace(/^\.\//,'')}${e.isDirectory() ? '/' : ''}`);
  }

  write(input, content, backupRoot) {
    if (typeof content !== 'string') throw new Error('AI did not return text.');
    if (Buffer.byteLength(content) > MAX_FILE_BYTES) throw new Error('Refusing to write a file larger than 96 KB.');
    const target = this.path(input, {mayCreate:true});
    const existed = !!statIfPresent(target);
    const before = existed ? this.read(input) : null;
    const oldMode = existed ? (lstatSync(target).mode & 0o777) : 0o600;
    if (before === content) return {unchanged: true, path: this.relative(target)};
    const backupDir = resolve(backupRoot);
    mkdirSync(backupDir, {recursive:true, mode:0o700});
    const backup = join(backupDir, randomUUID() + '.backup');
    if (existed) writeFileSync(backup, before, {mode:0o600});
    mkdirSync(dirname(target), {recursive:true});
    const temp = join(dirname(target), '.' + basename(target) + '.' + randomUUID() + '.tmp');
    try {
      writeFileSync(temp, content, {mode:oldMode});
      renameSync(temp, target);
    } finally { if (existsSync(temp)) unlinkSync(temp); }
    this.lastEdit = {target, backup, existed, oldMode, afterHash:checksum(content)};
    this.editStack.push(this.lastEdit);
    return {unchanged:false, path:this.relative(target)};
  }

  undo() {
    const prior = this.editStack.at(-1);
    if (!prior) throw new Error('Nothing to undo in this session.');
    // Check the path once again, in case the directory tree changed since the edit.
    this.path(this.relative(prior.target), {mayCreate:true});
    if (!statIfPresent(prior.target) || checksum(readFileSync(prior.target)) !== prior.afterHash) {
      throw new Error('The file changed since Kivo saved it. Refusing to overwrite newer work.');
    }
    if (prior.existed) {
      const temp = prior.target + '.' + randomUUID() + '.tmp';
      writeFileSync(temp, readFileSync(prior.backup), {mode:prior.oldMode});
      renameSync(temp, prior.target);
      unlinkSync(prior.backup);
    } else if (existsSync(prior.target)) {
      unlinkSync(prior.target);
    }
    this.editStack.pop();
    this.lastEdit = this.editStack.at(-1) || null;
    return this.relative(prior.target);
  }
}

export function diffPreview(before, after, maxLines = 50) {
  if (before === after) return 'No changes.';
  const oldLines = before === null ? [] : before.split('\n');
  const newLines = after.split('\n');
  let start = 0;
  while (start < oldLines.length && start < newLines.length && oldLines[start] === newLines[start]) start++;
  let endA = oldLines.length - 1;
  let endB = newLines.length - 1;
  while (endA >= start && endB >= start && oldLines[endA] === newLines[endB]) {endA--;endB--;}
  const changes = [
    `@@ line ${start + 1} | -${endA-start+1} +${endB-start+1} @@`,
    ...oldLines.slice(start,endA+1).map(x => '- ' + x),
    ...newLines.slice(start,endB+1).map(x => '+ ' + x),
  ];
  return changes.slice(0,maxLines).join('\n') + (changes.length > maxLines ? `\n… ${changes.length-maxLines} more lines not shown` : '');
}
