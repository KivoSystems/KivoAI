/**
 * Kivo's predictable model router. It never downloads, executes, or grants
 * tool permissions. Model routing is based only on locally installed IDs.
 */
const PREFERENCES = [
  /^qwen3\.5:9b(?:-|$)/i,
  /^qwen3\.5:(?:latest|9b)$/i,
  /^qwen3\.5:4b(?:-|$)/i,
  /^qwen3:8b(?:-|$)/i,
  /^qwen3:(?:latest|8b)$/i,
  /^qwen2\.5-coder:7b(?:-|$)/i,
  /^qwen2\.5-coder:(?:latest|7b)$/i,
  /^qwen3:4b(?:-|$)/i,
];

/** Prefer a modest-size quality model over Kimi Q2; never pull a model. */
export function findSmartModel(installed = [], defaultModel = '') {
  for (const pattern of PREFERENCES) {
    const found = installed.find(name => pattern.test(name) && name !== defaultModel);
    if (found) return found;
  }
  return defaultModel;
}

/** Only short, obviously casual messages stay with the fast model. */
export function needsThought(task = '') {
  const q = String(task).trim();
  if (!q || /^(?:hi|hello|hey+|yo+|thanks|thank you|good(?: morning| night)|lol|lmao|ok|okay|bye)[!.?\s]*$/i.test(q)) return false;
  if (q.length > 105 || (q.includes('?') && q.length > 20)) return true;
  return /\b(?:why|how|explain|analyse|analyze|reason|plan|design|should|compare|best|recommend|research|learn|think|help|fix|debug|solve|understand|review|develop|improve|write|create|build|code|script|error|problem|project|source|remember|memory|what (?:would|should|happens|went wrong|do you know))\b/i.test(q);
}

/** Return a transparent model decision for chat requests. */
export function selectChatModel({task='',fastModel='',smartModel='',enabled=true} = {}) {
  const deep=enabled && Boolean(smartModel) && smartModel !== fastModel && needsThought(task);
  return {model:deep?smartModel:fastModel, smart:deep, reason:deep?'complex request':'fast chat'};
}

/** A planning failure cannot authorize writing files or shell commands. */
export function safeAgentFallback(task, allowed, attempted = new Set()) {
  // On unclear/planner-failed destructive requests, never take a surrogate action.
  if (/\b(?:delete|remove|wipe|erase|format|destroy|overwrite)\b/i.test(task)) return null;
  const can = name => allowed.has(name) && !attempted.has(name);
  if (can('files') && /\b(?:project|codebase|folder|directory|files|repo|source|inspect)\b/i.test(task)) return {action:'files', value:'.'};
  if (can('search') && /\b(?:search|research|web|online|internet|find|look up)\b/i.test(task)) {
    const topic=String(task).replace(/^(?:can|could|would|will) you (?:please )?/i,'')
      .replace(/^(?:search|research|look up|find) (?:the )?(?:internet|web|online)?\s*(?:for|about|on)?\s*/i,'').trim();
    if(topic.length>=3) return {action:'search',value:topic.slice(0,180)};
  }
  return null;
}
