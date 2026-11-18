import assert from 'node:assert/strict';
import test from 'node:test';
import {prepare, sprintStats, targets} from '../site/model.js';
import {samplePortfolio} from './fixtures/portfolio.mjs';

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
