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
  browser.setTimeout = (callback,delay) => { assert.ok(delay >= 3100 && delay <= 3500); dismiss = callback; };
  const classes = new Set();
  globalThis.document = {documentElement:{classList:{add:name=>classes.add(name),remove:name=>classes.delete(name)}},getElementById:id => id === 'atlas-intro' ? intro : null};
  globalThis.window = browser;
  t.after(()=>{ delete globalThis.document; delete globalThis.window; });
  playAtlasIntro();
  assert.equal(intro.hidden,true);
  assert.equal(dismiss,undefined);
  reduced = false;
  playAtlasIntro();
  assert.equal(intro.hidden,false);
  assert.ok(classes.has('atlas-booting'));
  browser.dispatchEvent(new Event('keydown'));
  assert.equal(intro.hidden,true);
  assert.equal(classes.size,0);
  playAtlasIntro();
  dismiss();
  assert.equal(intro.hidden,true);
});
