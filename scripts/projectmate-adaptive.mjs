/** Adaptive model context and tool plans. No model weights or paid APIs required.
 * All token counts are estimates; Ollama's own tokenizer has final authority.
 */
import { allowedAgentActions } from './projectmate-router.mjs';

export const WINDOWS = Object.freeze([512, 1024, 2048, 4096, 8192, 16384, 32768]);
export const TOOL_GUIDE = Object.freeze({
  files: 'List the active project folder',
  read: 'Read an existing project file',
  search: 'Find public internet results',
  web: 'Read a public HTTPS page',
  machine: 'Inspect local system information',
  shell: 'Run a command; permission rules still apply',
  edit: 'Propose an edit, requiring APPLY',
  new: 'Propose a file, requiring APPLY',
  answer: 'Respond using observations',
});

export function estimateTokens(messages) {
  // Conservative character heuristic; not the model's true tokenizer.
  return Math.ceil((messages || []).reduce((n, m) => n + String(m?.content || '').length, 0) / 3) + 24 * (messages?.length || 0);
}

export function chooseContextWindow({messages=[], base=1024, cap=8192, outputTokens=256, task='', min=512, mode='auto'}={}) {
  if(!Number.isInteger(base) || !Number.isInteger(cap) || base<512 || cap<base || cap>32768)
    throw new Error('Context settings must be 512–32768 tokens, with cap >= base.');
  const inputEstimate = estimateTokens(messages);
  const desiredOutput=Math.max(64,Math.min(outputTokens,4096));
  if(mode==='fixed') return {size:base,inputEstimate,required:inputEstimate+desiredOutput+128,limited:inputEstimate+desiredOutput+128>base,mode};
  if(mode!=='auto')throw new Error('Context mode must be auto or fixed.');
  const taskStr=String(task).toLowerCase();
  const complex=/\b(?:refactor|architecture|codebase|repository|multi.file|rewrite|debug|review|implement|entire project|source code|tests?|large file)\b/.test(taskStr);
  const required=Math.max(base, min, inputEstimate + desiredOutput + Math.max(192,Math.ceil(inputEstimate*.15)), complex?2048:512);
  const size = WINDOWS.find(n=>n>=required && n>=base && n<=cap) ?? cap;
  return {size,inputEstimate,required,limited:required>size,mode};
}

/** Reduce optional history before exceeding the permitted context. Never truncate the current task. */
export function fitMessagesToContext(messages, size, outputTokens=256) {
  const result=messages.map(m=>({...m}));
  const maxInput=Math.floor(size*.86)-Math.min(outputTokens,Math.floor(size*.30));
  if(estimateTokens(result)<=maxInput)return {messages:result,trimmed:0,overflow:false};
  let trimmed=0;
  // Remove only old conversation turns; retain system rules and the newest user request.
  for(let i=result.length-2;i>0 && estimateTokens(result)>maxInput;i--) {
    if(result[i].role==='user'||result[i].role==='assistant') {result.splice(i,1);trimmed++;}
  }
  return {messages:result,trimmed,overflow:estimateTokens(result)>maxInput};
}

export function validateContextExpansion(current, requested, cap=8192) {
  const amount=Number(requested);
  if(!Number.isInteger(amount)||amount<=current||amount>cap || !WINDOWS.includes(amount))
    return null;
  return amount;
}

export function suggestedTools(task) {
  const t=String(task).toLowerCase();
  const permitted=allowedAgentActions(task);
  const wanted=[];
  if(/\b(?:web|internet|online|search|research|docs|documentation|recent|latest)\b/.test(t))wanted.push('search','web');
  if(/\b(?:project|repo|codebase|files?|source|folder|fix|bug|test|review|refactor|edit)\b/.test(t))wanted.push('files','read');
  if(/\b(?:run|test|verify|build|compile|execute|terminal|command)\b/.test(t))wanted.push('shell');
  if(/\b(?:edit|modify|refactor|rewrite|fix|repair|patch)\b/.test(t))wanted.push('edit');
  if(/\b(?:create|make|add|write|implement)\b/.test(t))wanted.push('new');
  return [...new Set(wanted)].filter(tool=>permitted.has(tool));
}

/** Strictly sanitize the model's tool plan. A plan is advice, NEVER authorisation. */
export function parseTaskToolPlan(raw, task, maxTools=5) {
  let data;
  try {
    const text=String(raw).trim();
    const json=text.match(/\{[\s\S]*\}/)?.[0];
    data=JSON.parse(json||text);
  } catch {throw new Error('Model did not return a valid tool plan.');}
  if(!data||!Array.isArray(data.tools))throw new Error('Plan must contain a tools array.');
  const allowed=allowedAgentActions(task);
  const tools=[];
  for(const entry of data.tools) {
    const name=typeof entry==='string'?entry:entry?.name;
    if(typeof name!=='string'||!Object.hasOwn(TOOL_GUIDE,name)||!allowed.has(name))continue;
    if(!tools.includes(name)&&name!=='answer')tools.push(name);
    if(tools.length>=maxTools)break;
  }
  const preferred=Number(data.context);
  return {tools,context:Number.isInteger(preferred)&&WINDOWS.includes(preferred)?preferred:null,
    goal:typeof data.goal==='string'?data.goal.slice(0,220):String(task).slice(0,220)};
}
