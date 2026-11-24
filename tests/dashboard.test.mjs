import assert from 'node:assert/strict';
import test from 'node:test';
import {prepare, sprintStats, targets, closedIssues} from '../site/model.js';
import {samplePortfolio} from './fixtures/portfolio.mjs';
import {productMark, selectPicker} from '../site/ui.js';

test('product badges derive initials from discovered names and handle symbol-only titles', () => {
  const badge = label => productMark({label, color:'green'}, true);
  assert.match(badge('Project Atlas'), />PA<\/span>/);
  assert.match(badge('SalesDrone'), />SD<\/span>/);
  assert.match(badge('東京'), />東京<\/span>/);
  assert.match(badge('🛰'), /generated\/icons.svg#box/);
});

test('filters keep one native select, its full selected title and a separate decorative caret', () => {
  const title = 'A long board title with <markup> & spaces';
  const filter = selectPicker('product-select','Product filter',[['all','All products'],['long',title]],'long',
    {leading:'box',caption:'Product'});
  assert.match(filter, /class="picker-label">Product<\/span>/);
  assert.match(filter, /<select [^>]*aria-label="Product filter"/);
  assert.match(filter, /<selectedcontent><\/selectedcontent>/);
  assert.match(filter, /<option value="long" selected>A long board title with &lt;markup&gt; &amp; spaces<\/option>/);
  assert.match(filter, /<\/select>\s*<span class="picker-chevron"><svg [^>]*aria-hidden="true"/);
});

test('current sprint and backlog count leaf issues separately from planned work', () => {
  const sample = samplePortfolio();
  const board = sample.projects[0], base = board.items[1];
  board.items.push({...base, kind:'PullRequest'}, {...base, rollup:true}, {...base, archived:true});
  const data = prepare(sample), product = data.projects[0];
  assert.equal(product.open.length, 5);
  assert.deepEqual(product.backlog.map(i => i.number), [4]);
  assert.equal(product.current.length, 1);
  const stats = sprintStats(product, product.current[0]);
  assert.equal(stats.open, 2);
  assert.equal(stats.closed, 1);
});

test('a shared milestone appears once on the roadmap and retains its products', () => {
  const sample = samplePortfolio();
  sample.projects[1].repos.push(sample.projects[0].repos[0]);
  const data = prepare(sample), releases = targets(data, data.projects);
  assert.equal(releases.length, 3);
  assert.equal(releases[0].products.length, 2);
  assert.ok(releases.every(release => release.version && release.due >= data.asOf));
});

test('a newly discovered empty board can be selected with any public title', () => {
  const data = samplePortfolio();
  data.projects.push({ key: 'fixture-72', name: 'constructor', repos: [], items: [], sprints: [] });
  const board = prepare(data).projects.find(p => p.key === 'fixture-72');
  assert.equal(board.label, 'constructor');
  assert.deepEqual(board.current, []);
  assert.deepEqual(board.backlog, []);
  assert.deepEqual(targets(data, [board]), []);
});

test('history includes unscheduled and rollup closures, deduplicates shared issues, and keeps missing dates last', () => {
  const sample = samplePortfolio();
  const [first, second] = sample.projects;
  const base = first.items[0];
  Object.assign(base, {closedAt:'2026-11-01T12:00:00.000Z', sprint:null});
  const parent = {...base, number:28, url:'https://github.com/' + base.repo + '/issues/28', rollup:true, closedAt:'2026-11-15T18:00:00.000Z'};
  first.items.push(parent);
  first.items.push({...base, number:91, url:base.url+'archived', archived:true});
  first.items.push({...base, number:92, url:base.url+'pull', kind:'PullRequest'});
  second.items.push({...base, sprint:'s2'});
  const data = prepare(sample);
  const both = data.projects.filter(p => [first.key,second.key].includes(p.key));
  const history = closedIssues(both);
  assert.deepEqual(history.map(r=>r.i.url), [parent.url,base.url,second.items[0].url]);
  assert.deepEqual(history[1].memberships.map(m => m.i.sprint), [null,'s2']);
  assert.equal(closedIssues(both.filter(p => p.key === second.key)).length,2);
  assert.equal(both.find(p => p.key === first.key).open.length,5);
  assert.deepEqual(closedIssues([]),[]);
});

test('assigned rows render from Backlog and retain the selected sprint window in drilldowns',async t=>{
  const {backlogPage,sprintPage,paintIssues} = await import('../site/work.js');
  const data = prepare(samplePortfolio()), product = data.projects[0];
  const target = {innerHTML:''};
  globalThis.document = {querySelector:selector => selector === '#issue-results' ? target : null};
  t.after(()=>{ delete globalThis.document; });
  backlogPage([product],{product:product.key,q:new URLSearchParams('scope=all')});
  paintIssues();
  assert.match(target.innerHTML,/sprint=s1"/);
  assert.doesNotMatch(target.innerHTML,/ATLAS_LABEL/);
  assert.match(target.innerHTML,/>In progress</);
  const q = new URLSearchParams('period=window&window=90d');
  const list = sprintPage(data,[product],{product:product.key,q});
  assert.match(list,/sprint=s1&amp;period=window&amp;window=90d/);
  q.set('sprint','s1'); q.set('show','open');
  sprintPage(data,[product],{product:product.key,q});
  paintIssues();
  assert.match(target.innerHTML,/sprint=s1&amp;period=window&amp;window=90d&amp;show=open/);
});
