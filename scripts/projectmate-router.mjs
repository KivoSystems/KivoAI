import { researchRequest, normalizeResearchTopic } from './projectmate-research.mjs';
/** Fast, offline routing for common tasks. No model call needed to choose obvious tools. */
export function isProceedFollowup(input) {
  return /^(?:(?:can|could|will|would) you (?:please )?(?:do|check|look (?:it |that )?up|search(?: for)?|find) (?:that|it|this|so)(?: for me)?(?: right now| now| please)?|(?:yes|yeah|yep|sure|go ahead|do it|please do|do that))(?:[.!?\s]*)$/i.test(String(input).trim());
}

/** Return a human-readable search query; do not misrepresent this as watching videos. */
export function youtubeSearchQuery(input) {
  const topic=String(input)
    .replace(/^(?:(?:hey,?\s*)?i (?:wanted|want) you to |(?:can|could|would|will) you (?:please )?)/i,'')
    .replace(/^(?:check|search|browse|look (?:on|at|up)|find|show(?: me)?|watch|see)\s+(?:on\s+)?(?:youtube|yt)?\s*(?:for\s+)?/i,'')
    .replace(/\b(?:on youtube|from youtube|on yt|from yt|youtube|yt)\b/gi,'')
    .replace(/\s+/g,' ').replace(/[?.!]+$/,'').trim();
  const year=new Date().getFullYear();
  return `site:youtube.com/watch ${topic || 'new technology gadgets releases'} ${year}`.slice(0,195);
}

/** Safety boundary: only explicit edit/create or command requests grant those tools.
 * Model-generated tool plans are suggestions, never permission by themselves. */
export function allowedAgentActions(task) {
  const text=normalizeResearchTopic(task).toLowerCase();
  const webOnly=/\b(?:online|internet|web|forums?|websites?|youtube|yt)\b/.test(text)
    && /\b(?:search|browse|study|research|learn|look|check|find|read)\b/.test(text)
    && !/\b(?:my files|my project|local files|on my computer|shell|terminal|run a command|edit|modify|write code|create a file|change my)\b/.test(text);
  if (webOnly) return new Set(['answer','web','search']);
  const allowed=new Set(['answer','files','read','web','search','machine']);
  const wantsWrite=/\b(?:edit|modify|change|rewrite|refactor|fix|repair|patch|update|implement|create|make|write|add|remove|delete)\b/.test(text)
    && /\b(?:file|code|source|script|app|program|project|codebase|bug|function|feature|test|folder|readme|config|\w+\.(?:py|js|ts|txt|json|md|cs|lua|html|css))\b/.test(text);
  if (wantsWrite) { allowed.add('write');allowed.add('edit');allowed.add('new'); }
  if (/\b(?:run|execute|install|compile|build|launch|start|test (?:the|my|this)|run tests|shell|terminal|command)\b/.test(text)) allowed.add('shell');
  return allowed;
}

export function isAllowedAgentAction(task, action) {
  return Boolean(action && allowedAgentActions(task).has(action.action));
}

export function routeTask(input, {lastAction} = {}) {
  const text = String(input || '').trim();
  if (!text || text.startsWith('/')) return {mode:'chat'};
  const lower = normalizeResearchTopic(text).toLowerCase();
  // Open-ended browsing should pick a meaningful technical subject instead of searching the word 'anything'.
  if (/^can you search (?:the )?web for anything you(?:'|’)d like[?.!]*$/i.test(text)) {
    return {mode:'quick',action:'search',value:`latest technology hardware and software news ${new Date().getFullYear()}`};
  }
  if (/^(?:have you (?:learned|learnt) anything|what (?:have|did) you (?:learn|learned|learnt)|did you (?:learn|learned) anything|what did you find out)(?:\s+(?:from (?:that|the) research|about (?:pygame|that)))?[?.!]*$/i.test(text)) return {mode:'quick', action:'learned',value:''};
  if (isProceedFollowup(text) && lastAction && ['search','web','research','files','read','machine'].includes(lastAction.action)) {
    return {mode:'quick', action:lastAction.action, value:lastAction.value};
  }
  // Requests to look *on YouTube* are searches of public video titles/snippets,
  // not promises that we can watch or understand the video contents.
  if (/\b(?:youtube|yt)\b/i.test(text) &&
      /\b(check|search|look|find|show|browse|watch|see|cool|released|release|latest|new|tech|videos?)\b/i.test(text)) {
    return {mode:'quick', action:'search',value:youtubeSearchQuery(text)};
  }
  if (/\b(?:cool new tech|tech (?:that's|that has been) released|latest tech releases|new gadgets released)\b/i.test(text) &&
      /\b(?:check|find|look|search|show|what|any|latest)\b/i.test(text)) {
    return {mode:'quick', action:'search',value:`new technology and gadget launches ${new Date().getFullYear()}`};
  }
  if (/\b(?:refactor|rewrite|upgrade|implement|fix|modify|update|improve|add)\b/i.test(text) && /\b(?:source code|codebase|entire project|whole project|multiple files|across files|repository|repo|my project)\b/i.test(text) && !/\b(?:just explain|explain how|how do i|what is|why is)\b/i.test(text)) return {mode:'code'};
  const multi = /\b(and then|then|after that|also (?:edit|fix|change|run|search|read)|and (?:fix|edit|write|update|run|make|change|explain))\b/i.test(text);
  const research = researchRequest(text);
  if (!multi && research) return {mode:'quick',action:'research',value:research.query,topic:research.topic};
  // A direct request to learn a named library means public research, not a chat guess.
  if (!multi && /\b(?:learn|study) how to use (?:the )?(?:pygame|python|arduino|unity)\b/i.test(text)) {
    const subject=text.match(/\b(pygame|python|arduino|unity)\b/i)?.[1].toLowerCase();
    return {mode:'quick',action:'research',value:`${subject} official documentation tutorial examples`,topic:subject};
  }
  if (!multi && /^(?:show|list|display)\s+(?:me\s+)?(?:the\s+)?(?:files|folder|directory|project files|project directory)(?:\s+(?:in|under)\s+(.+))?[?.!]*$/i.test(text)) {
    const match = text.match(/(?:in|under)\s+(.+?)[?.!]*$/i);
    return {mode:'quick', action:'files', value:match?.[1] || '.'};
  }
  if (!multi && /^(?:show|check|what(?:'s| is)\s+(?:my|this)\s+)?(?:machine info|system info|computer specs|hardware specs|system specs|my specs)(?:\s+please)?[?.!]*$/i.test(text)) {
    return {mode:'quick',action:'machine',value:'.'};
  }
  // Short, explicit programming tasks can skip a whole model planning pass.
  const codePath='([\\w./-]+\\.(?:py|js|mjs|ts|tsx|jsx|json|md|txt|html|css|c|cpp|h|sh|rs|lua|cs))';
  const readMatch=text.match(new RegExp('^(?:read|open|inspect)\\s+'+codePath+'(?:\\s+(?:and\\s+)?(?:explain|summarise|summarize|review|check)(?:\\s+.*)?)?$','i'));
  if(readMatch) return {mode:'quick',action:'read',value:readMatch[1]};
  const editMatch=text.match(new RegExp('^(?:edit|change|modify|update)\\s+'+codePath+'\\s+(?:to|so that|and|:)\\s+(.+)$','i'));
  if(!multi && editMatch) return {mode:'quick',action:'edit',value:editMatch[1],task:editMatch[2]};
  const newMatch=text.match(new RegExp('^(?:create|make|write)\\s+(?:a\\s+(?:new\\s+)?)?'+codePath+'\\s+(?:to|that|which|with|:)\\s+(.+)$','i'));
  if(!multi && newMatch) return {mode:'quick',action:'new',value:newMatch[1],task:newMatch[2]};
  const gitMatch=text.match(/^(?:run|execute)\s+(git\s+(?:status|diff|log(?:\s+--oneline)?))\s*[.!?]*$/i);
  if(!multi && gitMatch) return {mode:'quick',action:'shell',value:gitMatch[1]};
  // Explicit natural-language web requests must not go through a small model planner.
  const webSearch=text.match(/^(?:(?:can|could|would|will) you (?:please )?|please )?(?:search|look up|find|research|check) (?:the )?(?:web|internet|online) (?:for|about|on) (.+)$/i);
  if (!multi && webSearch) return {mode:'quick', action:'search', value:webSearch[1].replace(/[?!]+$/,'').trim()};
  // Produce a proposed source file instead of dumping a truncated code snippet into chat.
  // Choose a conservative file name only when the user clearly asks for Python/Pygame.
  if (!multi && /\b(?:make|create|write|build|generate)\b/i.test(text) &&
      /\b(?:\.py|python|pygame)\b/i.test(text) &&
      /\b(?:game|script|program|file|platformer)\b/i.test(text)) {
    const explicit=text.match(/\b([\w-]+\.py)\b/i);
    const name=explicit?.[1] || (/\bplatformer\b/i.test(text)?'platformer.py':'main.py');
    return {mode:'quick', action:'new', value:name, task:text};
  }
  // A bare public URL is safe to fetch; local URLs are still blocked by the web tool.
  if (!multi && /^https:\/\/\S+$/i.test(text)) return {mode:'quick',action:'web',value:text};
  if (!multi && /^(?:search (?:the )?web for|search for|look up|google|search online for|look up)\s+(.+)/i.test(text)) {
    return {mode:'quick',action:'search',value:text.replace(/^(?:search (?:the )?web for|search for|look up|google|search online for|look up)\s+/i,'')};
  }
  if (/\b(search|browse|website|online|latest|current|recent|internet|documentation|docs|github|look up|research|inspect|read|open|files|folder|directory|project|codebase|fix|edit|modify|update|create|write|run|execute|terminal|shell|command|debug|test|install|build|compile|refactor|check my|look at my)\b/i.test(lower)) {
    if(/^(?:inspect|check|explore|look at) (?:my |the )?(?:project|codebase)(?:\b|$)/i.test(text)) return {mode:'agent',firstAction:{action:'files',value:'.'}};
    return {mode:'agent'};
  }
  return {mode:'chat'};
}

export function compactObservation(action, result, limit=680) {
  const content = String(result ?? '').slice(0, limit);
  return `${action.action} ${action.value || action.path || ''}: ${content}`;
}
