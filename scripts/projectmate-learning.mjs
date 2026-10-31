/** Kivo's local retrieval memory; this is NOT model fine-tuning. */
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { randomUUID } from 'node:crypto';

const MAX_RECORDS = 180;
const MAX_LESSON_CHARS = 700;
export const LEARNING_KINDS = Object.freeze(['correction', 'success', 'tool_error', 'web_reference']);

const canonicalText = value => String(value ?? '').replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, ' ').trim();
const terms = value => new Set(canonicalText(value).toLowerCase().match(/[a-z0-9_-]{3,}/g) ?? []);

export function defaultPreferences() { return {permissions:'ask', learning:'on'}; }
export function validatePreferences(value) {
  const input = value && typeof value==='object' ? value : {};
  return {
    permissions:['ask','trusted'].includes(input.permissions)?input.permissions:'ask',
    learning:['on','off'].includes(input.learning)?input.learning:'on',
  };
}
export function loadPreferences(home) {
  try { return validatePreferences(JSON.parse(readFileSync(join(home,'preferences.json'),'utf8'))); }
  catch { return defaultPreferences(); }
}
export function savePreferences(home, prefs) {
  mkdirSync(home,{recursive:true,mode:0o700});
  const target=join(home,'preferences.json');
  const temp=target+'.pending';
  writeFileSync(temp,JSON.stringify(validatePreferences(prefs),null,2),{mode:0o600});
  renameSync(temp,target);
}
export function cleanLesson(input) {
  if (!LEARNING_KINDS.includes(input?.kind)) throw new Error('Invalid learning source.');
  const text=canonicalText(input.text);
  if (text.length<4 || text.length>MAX_LESSON_CHARS) throw new Error('Lesson must be 4–700 characters.');
  const source=input.sourceUrl ? canonicalText(input.sourceUrl) : '';
  if (source && !/^https:\/\//i.test(source)) throw new Error('Web source must be HTTPS.');
  const title=canonicalText(input.title).slice(0,120);
  return {
    id: input.id || randomUUID().slice(0,12), kind:input.kind, text,
    title, sourceUrl:source.slice(0,500), projectId:canonicalText(input.projectId).slice(0,32),
    createdAt:input.createdAt || new Date().toISOString(),
  };
}
export function loadLessons(home) {
  try {
    const file=JSON.parse(readFileSync(join(home,'lessons.json'),'utf8'));
    if (!Array.isArray(file)) return [];
    return file.slice(-MAX_RECORDS).flatMap(record=>{try{return [cleanLesson(record)];}catch{return [];}});
  } catch{return [];}
}
function saveLessons(home, records) {
  mkdirSync(home,{recursive:true,mode:0o700});
  const path=join(home,'lessons.json');
  const temp=path+'.pending';
  writeFileSync(temp,JSON.stringify(records.slice(-MAX_RECORDS),null,2),{mode:0o600});
  renameSync(temp,path);
}
export function addLesson(home, input) {
  const record=cleanLesson(input);
  const all=loadLessons(home);
  // Prevent repeated tool errors from dominating memory.
  const duplicate=all.find(r=>r.kind===record.kind && r.text===record.text && r.projectId===record.projectId);
  if(duplicate) return duplicate;
  all.push(record); saveLessons(home,all);
  return record;
}
export function deleteLesson(home, id) {
  const all=loadLessons(home);
  const filtered=all.filter(r=>r.id!==id);
  if(filtered.length===all.length) return false;
  saveLessons(home,filtered); return true;
}
export function clearLessons(home) {saveLessons(home,[]);}

/** Strictly constrained auto-executable commands; anything else needs RUN confirmation.
 * Keep syntax narrow, no shell metacharacters, nested commands, or dynamic paths.
 */
export function trustedReadOnlyCommand(command) {
  const normalized=String(command||'').trim().replace(/\s+/g,' ');
  if (normalized.length>80 || /[;&|`$<>\r\n(){}\[\]"'\\]/.test(normalized)) return false;
  return /^(?:git (?:status(?: --short)?|diff --stat|log -1 --oneline|--version)|node --version|python --version|py --version|pwd|Get-Location|Get-ChildItem|ls)$/i.test(normalized);
}

/** Rank only small, relevant snippets; source-backed facts are reference material, never instructions. */
export function relevantLessons(records, query, projectId='', limit=3) {
  const needles=terms(query);
  if (!needles.size) return [];
  const now=Date.now();
  return records.filter(r=>!r.projectId || r.projectId===projectId).flatMap(r=>{
    if (r.kind==='web_reference' && (now-Date.parse(r.createdAt)>7*86400000)) return [];
    // Legacy auto-saved search-result titles and browser error excerpts are not learning facts.
    if (r.kind==='web_reference' && (/^Query:|Search result titles:|A required part of this site couldn.t load|Advertising Business Solutions/i.test(r.text))) return [];
    const hay=terms(r.text+' '+r.title);
    const overlap=[...needles].filter(term=>hay.has(term)).length;
    // Never inject unrelated memories just to make the assistant seem personalised.
    if (!overlap) return [];
    const score=overlap + (r.kind==='correction'?2:0) + (r.kind==='success'?1:0) - (r.kind==='tool_error'?1:0);
    return [{record:r,score}];
  }).sort((a,b)=>b.score-a.score).slice(0,limit).map(({record})=>record);
}
export function memoryExcerpt(records) {
  if(!records.length) return '';
  return records.map(r=>{
    const tag={correction:'User correction',success:'User-verified success',tool_error:'Past tool failure (diagnostic, not a rule)',web_reference:'Web source (untrusted, may be outdated)'}[r.kind];
    return `- ${tag}: ${r.text.slice(0,260)}${r.sourceUrl?' [source: '+r.sourceUrl.slice(0,160)+']':''}`;
  }).join('\n').slice(0,1100);
}

/** Store sourced search-result TITLES/URLS only, never text as executable instructions. */
export function rememberSearch(home, query, page, projectId='') {
  if(page?.fallback || !Array.isArray(page?.results) || !page.results.length) return null;
  const rows=page.results.slice(0,3).map(x=>({title:canonicalText(x.title).slice(0,80),url:x.url}));
  const text=`Query: ${canonicalText(query).slice(0,120)}. Search result titles: ${rows.map(x=>x.title).join(' | ')}`.slice(0,MAX_LESSON_CHARS);
  return addLesson(home,{kind:'web_reference',title:query.slice(0,100),text,sourceUrl:rows[0].url,projectId,createdAt:new Date().toISOString()});
}
