/** Fail-closed verification before AI-generated files are offered for saving.
 * No generated code is executed: Python's ast.parse only checks grammar.
 */
import { spawnSync } from 'node:child_process';
import { extname } from 'node:path';
import { validateDraft } from './projectmate-brain.mjs';

export function isPygameGameTask(task) {
  const s=String(task || '');
  return /\b(?:pygame|platformer)\b/i.test(s) && /\b(?:game|platformer|playable|level)\b/i.test(s);
}

export function checkPythonSyntax(source, runner = spawnSync) {
  // Prefer py launcher on Windows; on Linux python3 is normally available.
  const commands=process.platform==='win32'?[['py',['-3']],['python',[]],['python3',[]]]:
    [['python3',[]],['python',[]]];
  for (const [binary, prefix] of commands) {
    const result=runner(binary,[...prefix,'-c',
      'import ast,sys; ast.parse(sys.stdin.read(), filename="generated.py")'],
      {input:source,encoding:'utf8',timeout:6000,windowsHide:true,maxBuffer:64*1024});
    if (result.error?.code === 'ENOENT') continue;
    // Windows Store alias can return a "Python was not found" message.
    if (result.status !== 0 && /Python was not found|install python from the microsoft store/i.test(result.stderr||result.stdout||'')) continue;
    if (result.error) return `Python syntax verification failed: ${result.error.message}`;
    if (result.status!==0) {
      const lines=String(result.stderr||result.stdout||'').split(/\r?\n/).map(x=>x.trim());
      return 'Invalid Python syntax: '+(lines.find(x=>/SyntaxError:|IndentationError:|TabError:/.test(x)) || lines.filter(Boolean).at(-1) || 'Python parser rejected the file');
    }
    return null;
  }
  return 'Python 3 was not found, so Kivo cannot verify this .py file. Install Python 3 and try again.';
}

export function validateGeneratedCode(content, filename='', task='', options={}) {
  const original=validateDraft(content,filename);
  if (original) return original;
  const suffix=extname(String(filename)).toLowerCase();
  if(suffix==='.json') {try{JSON.parse(String(content));return null;}catch{return 'Invalid JSON syntax.';}}
  if(['.js','.mjs','.cjs'].includes(suffix)) {
    const result=spawnSync(process.execPath,['--input-type=module','--check','-'],{input:String(content),encoding:'utf8',timeout:6000,windowsHide:true,maxBuffer:64*1024});
    if(result.error||result.status!==0) return 'Invalid JavaScript syntax: '+String(result.stderr||result.error?.message||'parser failed').slice(0,180);
    return null;
  }
  if(suffix!=='.py') return null;
  const src=String(content).trim();
  // Obvious conversational prose should never be saved as executable Python.
  if (/^(?:the (?:player|game|user|task)|i (?:can|will|have)|sure[,!]|here(?:'s| is)|you (?:can|should))\b/i.test(src)
      && !/^(?:import|from|def|class|#|if|for|while|try|with|@|print\s*\()/m.test(src))
    return 'The model returned English prose instead of Python source code.';
  if (!/^(?:\s*(?:import\s+|from\s+\w+\s+import\s+|def\s+|class\s+|#|if\s+|for\s+|while\s+|try:|with\s+|@|print\s*\(|[A-Za-z_]\w*\s*=))/m.test(src))
    return 'The model did not produce recognizable Python source code.';
  if (isPygameGameTask(task)) {
    if (!/\b(?:import\s+pygame|from\s+pygame\s+import)\b/.test(src)) return 'Pygame game is missing a pygame import.';
    if (!/^\s*while\b/m.test(src)) return 'Pygame game has no running game loop.';
    if (!/pygame\.event\.(?:get|poll|wait)\s*\(/.test(src) || !/pygame\.QUIT\b/.test(src))
      return 'Pygame game needs event handling and a QUIT handler.';
    if (!/pygame\.display\.(?:flip|update)\s*\(/.test(src)) return 'Pygame game never updates its display.';
  }
  return (options.syntaxChecker || checkPythonSyntax)(src);
}
