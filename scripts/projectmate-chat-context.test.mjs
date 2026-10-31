import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isSimpleGreeting, needsBackground, buildChatMessages } from './projectmate-chat-context.mjs';

const params = {
  profile:'Projects: Raspberry Pi, PiProbe, Arduino, Unity.',
  notes:'Raspberry Pi troubleshooting required',
  projectRoot:'C:\\Users\\Someone\\Downloads\\ProjectMate',
  history:[{role:'user',content:'How do I wire my Raspberry Pi?'},{role:'assistant',content:'Use the GPIO header'}],
  webContext:'Raspberry Pi documentation from a webpage',
};
test('simple greetings and small talk are conversational, not project questions',()=>{
  for (const greeting of ['hello','HELLO!!','heyyy','Hi','hey there','good morning','how are you?']) {
    assert.equal(isSimpleGreeting(greeting),true,greeting);
    assert.equal(needsBackground(greeting),false,greeting);
  }
  assert.equal(isSimpleGreeting('hello can you fix my project'),false);
});
test('hello does not leak Raspberry Pi background, notes, stale web data, or chat history',()=>{
  const messages=buildChatMessages({...params, prompt:'hello'});
  assert.equal(messages.length,2);
  assert.equal(messages.at(-1).content,'hello');
  assert.doesNotMatch(messages[0].content,/Raspberry Pi|PiProbe|GPIO|Downloads|webpage/i);
  assert.match(messages[0].content,/greet them back/i);
});
test('project work retains saved context',()=>{
  const messages=buildChatMessages({...params, prompt:'Help me improve my Raspberry Pi project'});
  assert.match(messages[0].content,/Raspberry Pi|PiProbe/);
  assert.equal(messages.length,4);
});
test('ordinary chat does not inject unrelated project context',()=>{
  const messages=buildChatMessages({...params, prompt:'What is the capital of Iceland?'});
  assert.doesNotMatch(messages[0].content,/Raspberry Pi|PiProbe|GPIO/);
});
test('references to web results can use recent web data',()=>{
  const messages=buildChatMessages({...params, prompt:'Summarize those search results'});
  assert.match(messages[0].content,/webpage/);
});
