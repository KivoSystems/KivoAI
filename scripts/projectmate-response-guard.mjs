import { isFalseSelfDescription } from './projectmate-identity.mjs';

const normalize = text => String(text || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/**
 * Detect consecutive repeated phrases (including repetitions across punctuation).
 * Deliberately restricted to conversational answers: code generation is validated
 * separately, as legitimate programs can contain repeated structures.
 */
export function repeatedTextLoop(text) {
  const normalized = normalize(text);
  if (!normalized) return false;
  const words = normalized.split(' ');
  if (words.length < 8) return false;
  for (let length = 2; length <= Math.min(18, Math.floor(words.length / 3)); length++) {
    const required = length <= 3 ? 5 : 3;
    if (words.length < length * required) continue;
    for (let start = 0; start + length * required <= words.length; start++) {
      const pattern = words.slice(start, start + length).join(' ');
      if (pattern.length < 7) continue;
      let matches = 1;
      while (start + length * (matches + 1) <= words.length &&
        words.slice(start + length * matches, start + length * (matches + 1)).join(' ') === pattern) {
        matches++;
      }
      if (matches >= required) return true;
    }
  }
  return false;
}

/** Kimi Q2 occasionally emits a planner's description of the user instead of an answer. */
export function isMetaNarration(reply) {
  const text=String(reply||'').trim();
  return /^(?:the user (?:is (?:asking|confirming|expressing|requesting)|wants|has requested)|the task is to|the assistant should|final response\b|user intent:)/i.test(text);
}

/** Decide whether a model reply is safe to show or include in future context. */
export function isLoopingReply(prompt, reply, history = []) {
  if (isFalseSelfDescription(reply) || repeatedTextLoop(reply) || isMetaNarration(reply)) return true;
  const answer = normalize(reply);
  if (!answer) return true;
  const question = normalize(prompt);
  if (question.length >= 6 && answer === question) return true;
  const recent = history.filter(x => x.role === 'assistant').slice(-4).map(x => normalize(x.content));
  if (answer.length <= 100 && recent.includes(answer)) return true;
  if (/^(you are|no you cannot|i cannot do that for you right now)$/.test(answer) &&
      /\b(why|what|how|can you|please|youtube|search|sassy|not being)\b/i.test(question)) return true;
  return false;
}

/** Drop poisoned user/assistant pairs from model context without deleting chat logs. */
export function compactSafeHistory(history = [], maxPairs = 2) {
  const clean = [];
  for (const message of history.slice(-maxPairs * 4)) {
    if (message.role !== 'user' && message.role !== 'assistant') continue;
    if (message.role === 'assistant' && isLoopingReply(clean.at(-1)?.role==='user' ? clean.at(-1).content : '', message.content, clean)) {
      if (clean.at(-1)?.role === 'user') clean.pop();
      continue;
    }
    clean.push(message);
  }
  return clean.slice(-maxPairs * 2);
}
