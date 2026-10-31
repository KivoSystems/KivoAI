/** Optional capabilities for Kivo Lite. Zero dependencies, explicit per-action approval. */
import { lookup } from 'node:dns/promises';
import { request as httpsRequest } from 'node:https';
import { isIP } from 'node:net';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { arch, cpus, freemem, hostname, loadavg, platform, release, totalmem, uptime } from 'node:os';

const execFileAsync = promisify(execFile);
const MAX_PAGE_BYTES = 160_000;
const PRIVATE_NAMES = /(?:^|\.)(?:localhost|local|lan|internal|home|test|invalid)$/i;

export function isPublicAddress(address) {
  if (isIP(address) === 4) {
    const parts = address.split('.').map(Number);
    const [a, b, c] = parts;
    return !(a === 0 || a === 10 || a === 127 || a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && (b === 168 || (b === 0 && c === 0) || (b === 0 && c === 2))) ||
      (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) ||
      (a === 203 && b === 0 && c === 113));
  }
  if (isIP(address) === 6) {
    const value = address.toLowerCase();
    if (value === '::1' || value === '::' || value.startsWith('fc') || value.startsWith('fd') ||
        /^fe[89ab]/.test(value) || value.startsWith('ff') || value.startsWith('2001:db8:')) return false;
    if (value.startsWith('::ffff:')) return isPublicAddress(value.slice(7));
    // Only permit routable global IPv6, not link-local, documentation or private space.
    return value.startsWith('2') || value.startsWith('3');
  }
  return false;
}

export function parsePublicUrl(input) {
  let url;
  try { url = new URL(input); } catch { throw new Error('Provide a complete URL starting with https://'); }
  if (url.protocol !== 'https:') throw new Error('Only HTTPS webpages are supported.');
  if (url.username || url.password) throw new Error('URLs containing credentials are not allowed.');
  if (url.port && url.port !== '443') throw new Error('Only HTTPS port 443 is allowed.');
  if (!url.hostname || PRIVATE_NAMES.test(url.hostname) || url.hostname.endsWith('.onion')) {
    throw new Error('Local/private network sites are blocked in /web. Use /shell for your own devices, with approval.');
  }
  const numericHost = url.hostname.startsWith('[') && url.hostname.endsWith(']')
    ? url.hostname.slice(1,-1) : url.hostname;
  if (isIP(numericHost) && !isPublicAddress(numericHost)) {
    throw new Error('Private IP addresses are blocked in /web.');
  }
  return url;
}

function textFromHtml(html) {
  return html
    .replace(/<!--[^]*?-->/g, ' ')
    .replace(/<(script|style|svg|noscript|head|footer|nav)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, ' ')
    .replace(/<(br|p|div|li|h[1-6]|article|section|tr)\b[^>]*>/gi, '\n')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Math.min(Number(n), 0x10ffff)))
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n[\s\n]*\n[\s\n]*\n/g, '\n\n')
    .trim();
}

/** Read public HTTPS pages, pinning requests to validated DNS addresses. No arbitrary LAN requests. */
export async function fetchPublicPage(input, { maxRedirects = 3, rawHtml = false } = {}) {
  let url = parsePublicUrl(input);
  for (let redirects = 0; redirects <= maxRedirects; redirects++) {
    // Resolve each hostname first; pin the HTTPS request to the validated address.
    const numericHost = url.hostname.replace(/^\[|\]$/g,'');
    const addresses = isIP(numericHost)
      ? [{ address: numericHost, family: isIP(numericHost) }]
      : await lookup(url.hostname, { all: true });
    if (!addresses.length || addresses.some(({address}) => !isPublicAddress(address))) {
      throw new Error('DNS points to a non-public network address. Refusing the request.');
    }
    const chosen = addresses[0];
    const response = await new Promise((resolve, reject) => {
      const req = httpsRequest(url, {
        timeout: 12000,
        headers: {'user-agent':'Kivo/0.3 (personal research assistant)', 'accept':'text/html,text/plain;q=0.9', 'accept-encoding':'identity'},
        lookup: (_hostname, opts, callback) => opts.all
          ? callback(null, [chosen]) : callback(null, chosen.address, chosen.family),
      }, res => {
        const chunks = [];
        let bytes = 0;
        if ([301, 302, 303, 307, 308].includes(res.statusCode)) {
          res.resume();
          resolve({redirect:res.headers.location});
          return;
        }
        if (res.statusCode !== 200) { res.resume(); reject(new Error(`Website responded HTTP ${res.statusCode}`)); return; }
        const type = res.headers['content-type'] || '';
        if (!/text\/html|text\/plain|application\/xhtml\+xml|application\/rss\+xml|application\/xml|text\/xml/i.test(type)) {
          res.resume(); reject(new Error('Only text and HTML webpages can be read.')); return;
        }
        res.on('data', chunk => {
          bytes += chunk.length;
          if (bytes > MAX_PAGE_BYTES) {
            req.destroy(new Error('Page exceeds the 160 KB read limit.'));
            return;
          }
          chunks.push(chunk);
        });
        res.on('end', () => resolve({text:Buffer.concat(chunks).toString('utf8'), contentType:type}));
        res.on('error',reject);
      });
      req.on('timeout', () => req.destroy(new Error('Web request timed out.')));
      req.on('error', reject);
      req.end();
    });
    if ('redirect' in response) {
      if (!response.redirect) throw new Error('Website returned a redirect without a URL.');
      url = parsePublicUrl(new URL(response.redirect, url).href);
      continue;
    }
    const text = rawHtml ? response.text : response.contentType.includes('html') ? textFromHtml(response.text) : response.text;
    return {url:url.href, text:text.slice(0, rawHtml ? MAX_PAGE_BYTES : 9000)};
  }
  throw new Error('Too many webpage redirects.');
}

function htmlAttribute(tag, name) {
  const attributes = [...tag.matchAll(/([\w-]+)\s*=\s*["']([^"']+)["']/gi)];
  return attributes.find(a => a[1].toLowerCase() === name)?.[2] ?? '';
}
function decodeHtml(text) {
  return String(text).replace(/&amp;/gi,'&').replace(/&quot;/gi,'"')
    .replace(/&#39;|&apos;/gi,"'").replace(/&lt;/gi,'<').replace(/&gt;/gi,'>');
}
export function extractSearchResults(html, limit = 6) {
  const results=[];
  // DuckDuckGo's HTML results contain anchors with class="result__a".
  const anchors=/<a\b([^>]+)>([\s\S]*?)<\/a>/gi;
  let match;
  while ((match=anchors.exec(String(html))) && results.length<limit) {
    if (!/\bresult__a\b/.test(htmlAttribute(match[1],'class'))) continue;
    const title=decodeHtml(textFromHtml(match[2])).slice(0,180);
    let href=decodeHtml(htmlAttribute(match[1],'href'));
    try {
      const url=new URL(href,'https://duckduckgo.com');
      if (url.hostname.endsWith('duckduckgo.com') && url.searchParams.has('uddg')) href=url.searchParams.get('uddg');
      else href=url.href;
      const safe=parsePublicUrl(href);
      if (!title || results.some(r=>r.url===safe.href)) continue;
      results.push({title,url:safe.href});
    } catch { /* Exclude malformed/private links. */ }
  }
  return results;
}

/** Parse RSS search results as data. Do not execute or interpret feed HTML. */
export function extractRssResults(xml, limit=6) {
  const results=[];
  const items=String(xml).match(/<item\b[^>]*>[\s\S]*?<\/item>/gi) || [];
  for (const item of items.slice(0, Math.max(limit * 3,10))) {
    const get = key => {
      const pattern=key==='title'
        ? /<title\b[^>]*>([\s\S]*?)<\/title>/i
        : /<link\b[^>]*>([\s\S]*?)<\/link>/i;
      const match=item.match(pattern);
      return (match?.[1] || '').replace(/^<!\[CDATA\[|\]\]>$/g,'').trim();
    };
    const title=decodeHtml(textFromHtml(get('title'))).slice(0,180);
    try {
      const url=parsePublicUrl(decodeHtml(get('link')));
      if (!title || results.some(r=>r.url===url.href)) continue;
      results.push({title,url:url.href});
      if(results.length>=limit) break;
    } catch { /* Never surface unsupported/private links. */ }
  }
  return results;
}

/** A fallback search URL is NOT a verified result; tell the user the difference. */
export function searchFallback(query, errors=[]) {
  const youtube = /site:youtube\.com\/watch/i.test(query);
  const terms = youtube ? query.replace(/site:youtube\.com\/watch\s*/ig,'').trim() : query;
  const destination = youtube
    ? `https://www.youtube.com/results?search_query=${encodeURIComponent(terms)}`
    : `https://www.bing.com/search?q=${encodeURIComponent(query)}`;
  const reason=errors.length ? ` (${errors.map(e=>String(e).slice(0,80)).join('; ')})` : '';
  return {url:destination,results:[],fallback:true,
    text:`Automated search couldn't retrieve verified results${reason}.\nOpen this search in your browser:\n${destination}\nNo videos or articles have been checked.`};
}

export function keepRelevantSearchResults(query, results) {
  if (!/site:youtube\.com\/watch/i.test(query)) return results;
  return results.filter(r => {
    try {
      const u=new URL(r.url);
      const host=u.hostname.replace(/^www\./,'');
      return (host==='youtube.com' && (/^\/(?:watch|shorts)\b/.test(u.pathname))) || host==='youtu.be';
    } catch {return false;}
  });
}

export async function searchWeb(query, fetchPage = fetchPublicPage) {
  const q=String(query).trim();
  if (q.length < 2 || q.length > 200) throw new Error('Search query must be 2–200 characters.');
  const errors=[];
  try {
    // DuckDuckGo sometimes returns HTTP 202 (human-verification challenge).
    const page=await fetchPage(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(q)}`, {rawHtml:true});
    const results=keepRelevantSearchResults(q,extractSearchResults(page.text));
    if (results.length) return {url:page.url,results,
      text:results.map((r,i)=>`${i+1}. ${r.title}\n   ${r.url}`).join('\n')};
    errors.push('DuckDuckGo returned no readable results');
  } catch(err) {errors.push(`DuckDuckGo: ${err.message}`);}
  try {
    // Unofficial public RSS endpoint; may be unavailable or rate limited.
    const page=await fetchPage(`https://www.bing.com/search?format=rss&q=${encodeURIComponent(q)}`, {rawHtml:true});
    const results=keepRelevantSearchResults(q,extractRssResults(page.text));
    if(results.length) return {url:page.url,results,
      text:results.map((r,i)=>`${i+1}. ${r.title}\n   ${r.url}`).join('\n')};
    errors.push('Bing RSS returned no readable results');
  } catch(err) {errors.push(`Bing: ${err.message}`);}
  return searchFallback(q,errors);
}

export function machineInfo() {
  const gib = n => (n / (1024 ** 3)).toFixed(1) + ' GiB';
  return `System: ${platform()} ${release()} (${arch()})\nMachine: ${hostname()}\nCPU: ${cpus()[0]?.model || 'unknown'} (${cpus().length} logical)\nRAM: ${gib(totalmem())} total, ${gib(freemem())} free\nLoad average: ${loadavg().map(x=>x.toFixed(2)).join(', ')}\nUptime: ${Math.round(uptime()/60)} min`;
}

export async function runApprovedCommand(command, cwd, run = execFileAsync) {
  if (!command.trim() || command.length > 1000 || command.includes('\0')) throw new Error('Command must be 1–1000 characters.');
  if (!cwd) throw new Error('A project directory is required.');
  // No root elevation or implicit auto-approval. Caller MUST ask user before invoking.
  const env = {...process.env};
  for (const key of Object.keys(env)) {
    if (/TOKEN|SECRET|PASSWORD|API_KEY|CREDENTIAL|PRIVATE_KEY/i.test(key)) delete env[key];
  }
  try {
    const onWindows = process.platform === 'win32';
    // Windows runs approved commands in PowerShell; Linux uses Bash.
    // The command is passed as one argument, not interpolated into another shell command.
    const executable = onWindows ? 'powershell.exe' : 'bash';
    const parameters = onWindows ? ['-NoProfile', '-NonInteractive', '-Command', command] : ['-lc', command];
    const {stdout = '', stderr = ''} = await run(executable, parameters, {
      cwd, env, timeout:120_000, maxBuffer:60_000, windowsHide:true,
    });
    return {ok:true, text:(stdout + (stderr ? '\n[stderr]\n'+stderr : '')).slice(0,12000) || '(No output)'};
  } catch (err) {
    return {ok:false, text:((err.stdout || '')+'\n'+(err.stderr || '')).slice(0,12000) || err.message, exitCode:err.code ?? 'error'};
  }
}

export function parseAgentAction(content) {
  const candidates=[content.trim()];
  const fenced=content.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) candidates.push(fenced[1].trim());
  const start=content.indexOf('{'),end=content.lastIndexOf('}');
  if (start>=0 && end>start) candidates.push(content.slice(start,end+1));
  for (const str of candidates) {
    try {
      const obj=JSON.parse(str);
      if (!obj || typeof obj !== 'object' || Array.isArray(obj)) continue;
      if (!['files','read','web','search','shell','write','answer','edit','new','machine','expand_context'].includes(obj.action)) continue;
      if (obj.action==='expand_context') {
        if (!Number.isInteger(obj.tokens)) continue;
        return {action:'expand_context',tokens:obj.tokens};
      }
      if (obj.action==='answer') {
        if (typeof obj.text !== 'string' || !obj.text.trim()) continue;
        return {action:'answer',text:obj.text.slice(0,6000)};
      }
      if (obj.action==='write') {
        if (typeof obj.path !== 'string'||typeof obj.content !== 'string') continue;
        return {action:'write',path:obj.path,content:obj.content,summary:String(obj.summary||'Agent proposed an edit').slice(0,200)};
      }
      if (typeof obj.value!=='string'||!obj.value.trim()) continue;
      if (obj.action==='edit'||obj.action==='new') {
        if(typeof obj.task!=='string'||!obj.task.trim()) continue;
        return {action:obj.action,value:obj.value.slice(0,260),task:obj.task.slice(0,480)};
      }
      return {action:obj.action,value:obj.value.slice(0,1000)};
    } catch { /* continue */ }
  }
  throw new Error('Local model did not produce a valid tool action; try a shorter /agent request.');
}
