import {test} from 'node:test';
import assert from 'node:assert/strict';
import { routeTask } from './projectmate-router.mjs';
import { researchWeb, isUsefulResearchExcerpt } from './projectmate-research.mjs';
import { PROJECTMATE_VERSION } from './projectmate-cli.mjs';

test('build version is visible to users',()=>assert.equal(PROJECTMATE_VERSION,'0.8.2'));
test('natural memory questions are handled without model inference',()=>{
  for (const q of ['have you learnt anything?', 'what did you learn?', 'what have you learned from that research?']) {
    assert.equal(routeTask(q).action,'learned',q);
  }
});
test('do not save browser error screen as research',async()=>{
  assert.equal(isUsefulResearchExcerpt('A required part of this site couldn’t load. This may be due to a browser extension or a connection issue. Please check and try again.','pygame'),false);
  const result=await researchWeb('pygame','pygame',{search:async()=>({results:[{title:'pygame pypi',url:'https://pypi.org/project/pygame/'}]}),fetchPage:async()=>({url:'https://pypi.org/project/pygame/',text:'A required part of this site couldn’t load. This may be due to a browser extension or a connection issue. Please check and try again.'})});
  assert.equal(result.verifiedPages.length,0);
});
test('keep relevant substantive research excerpt',()=>{
  assert.equal(isUsefulResearchExcerpt('Pygame developers recommend calling pygame.event.get() each frame to keep the application responsive. A running main loop should tick the clock, handle QUIT events and update the display regularly.','pygame'),true);
});
