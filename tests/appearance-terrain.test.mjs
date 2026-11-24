import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {prepare} from '../site/model.js';
import {terrainBoards} from '../site/terrain.js';
import {samplePortfolio} from './fixtures/portfolio.mjs';

const script = readFileSync(new URL('../site/appearance.js',import.meta.url),'utf8');

function appearance(value, blocked = false) {
  const meta = {}, root = {dataset:{}}, inputs = {};
  const events = new Map();
  const watch = (type,listener) => events.set(type,listener);
  const system = {matches:false,addEventListener:(_,fn) => watch('system',fn)};
  const reduced = {matches:true,addEventListener:(_,fn) => watch('motion',fn)};
  const window = {matchMedia:q => q.includes('color-scheme') ? system : reduced, addEventListener:watch};
  const document = {
    documentElement:root, addEventListener:watch, dispatchEvent() {},
    querySelector(selector) {
      if (selector.startsWith('meta')) return meta;
      const key = selector.match(/value="(\w+)"/)[1];
      return inputs[key] ||= {};
    },
  };
  const storage = {
    getItem() { if (blocked) throw Error(); return value; },
    setItem(_,choice) { if (blocked) throw Error(); value = choice; },
  };
  runInNewContext(script,{window,document,localStorage:storage,Event});
  return {root,meta,system,inputs,emit:(name,event) => events.get(name)(event),saved:()=>value};
}

test('System resolves before styles and follows a device change, even with an invalid saved value',()=>{
  const ui = appearance('invalid');
  assert.deepEqual(ui.root.dataset,{appearance:'system',theme:'light'});
  assert.equal(ui.meta.content,'#ffffff');
  ui.system.matches = true;
  ui.emit('system');
  assert.equal(ui.root.dataset.theme,'dark');
  assert.equal(ui.meta.content,'#101116');
});
test('explicit appearance persists independently, syncs across tabs and returns to System on clear',()=>{
  const ui = appearance('dark');
  ui.emit('change',{target:{name:'atlas-appearance',value:'light'}});
  assert.equal(ui.saved(),'light');
  ui.system.matches = true;
  ui.emit('system');
  assert.equal(ui.root.dataset.theme,'light');
  ui.emit('storage',{key:'atlas.appearance.v1',newValue:'dark'});
  assert.equal(ui.root.dataset.appearance,'dark');
  ui.emit('storage',{key:null,newValue:null});
  assert.deepEqual(ui.root.dataset,{appearance:'system',theme:'dark'});
  assert.ok(ui.inputs.system.checked);
});
test('a tab with unavailable storage can still choose and keep a theme',()=>{
  const ui = appearance(undefined,true);
  ui.emit('change',{target:{name:'atlas-appearance',value:'dark'}});
  ui.emit('DOMContentLoaded');
  assert.equal(ui.root.dataset.theme,'dark');
  assert.equal(ui.saved(),undefined);
});
test('terrain elevation comes from the same open leaf issues as the delivery metric',()=>{
  const data = samplePortfolio();
  const board = data.projects[0];
  for (const extra of [{archived:true},{rollup:true},{kind:'PullRequest'},{state:'CLOSED'}])
    board.items.push({...board.items[1],...extra});
  data.projects[1].items = [];
  const prepared = prepare(data);
  const boards = terrainBoards(prepared.projects);
  assert.equal(boards.find(b=>b.key === board.key).count,5);
  assert.equal(boards.at(-1).count,0);
  assert.equal(boards.at(-1).elevation,0);
  assert.deepEqual(terrainBoards([]),[]);
});
test('sheets of six preserve every board and use one scale across the portfolio',()=>{
  const projects = Array.from({length:13},(_,i)=>({key:'k'+i,label:'Board '+i,open:Array(i)}));
  const boards = terrainBoards(projects);
  assert.equal(boards[0].elevation,112);
  assert.equal(boards.find(b=>b.count===3).elevation,56);
  assert.equal(boards[12].key,'k0');
  assert.equal(new Set(boards.map(b=>b.key)).size,13);
  assert.equal(new Set(boards.slice(0,6).map(b=>[b.u,b.v].join(','))).size,6);
  assert.deepEqual([boards[0].u,boards[0].v],[boards[6].u,boards[6].v]);
});
