import assert from 'node:assert/strict';
import test from 'node:test';
import {playAtlasIntro} from '../site/atlas-motion.js';

test('the opening shows briefly, dismisses on input and respects reduced motion',t=>{
  const intro = new EventTarget();
  intro.hidden = true;
  const browser = new EventTarget();
  let reduced = true;
  let dismiss;
  browser.matchMedia = query => {
    assert.equal(query,'(prefers-reduced-motion: reduce)');
    return {matches:reduced};
  };
  browser.setTimeout = (callback,delay) => { assert.ok(delay <= 1500); dismiss = callback; };
  globalThis.document = {getElementById:id => id === 'atlas-intro' ? intro : null};
  globalThis.window = browser;
  t.after(()=>{ delete globalThis.document; delete globalThis.window; });
  playAtlasIntro();
  assert.equal(intro.hidden,true);
  assert.equal(dismiss,undefined);
  reduced = false;
  playAtlasIntro();
  assert.equal(intro.hidden,false);
  browser.dispatchEvent(new Event('keydown'));
  assert.equal(intro.hidden,true);
  playAtlasIntro();
  dismiss();
  assert.equal(intro.hidden,true);
});
