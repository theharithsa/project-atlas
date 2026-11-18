import test from 'node:test';
import assert from 'node:assert/strict';
import {decodeView, linkedIssueFilter, viewLink} from '../site/sharing.js';
import {url, setRoutePrefix} from '../site/ui.js';
import {repositoryRecords, streakSummary, developerRoute} from '../site/activity.js';
import {deliveryMetrics, deliveryTimeframe, portfolioInventory, prepare, day, iso} from '../site/model.js';
import {samplePortfolio} from './fixtures/portfolio.mjs';

const settings={users:['Example'],organizations:['other-labs']};
const route=(page,product,query='')=>({page,product,q:new URLSearchParams(query)});

test('personal links round-trip typed owners, product-scoped sprint, issue search and page in the fragment',()=>{
  const address=viewLink('https://atlas.example/?unused=1#sources',settings,
    route('sprints','example-12','sprint=s1&show=closed&extra=ignored'),{term:'api? #5/重',page:2});
  const u=new URL(address);
  assert.equal(u.origin,'https://atlas.example'); assert.equal(u.search,'');
  const link=decodeView(u.hash);
  assert.deepEqual(link.owners,settings);
  const params=new URLSearchParams(link.route.split('?')[1]);
  assert.equal(params.get('sprint'),'s1'); assert.equal(params.get('product'),'example-12');
  assert.equal(params.get('show'),'closed'); assert.ok(!params.has('extra'));
  assert.deepEqual(linkedIssueFilter(params),{term:'api? #5/重',page:2});
  setRoutePrefix(link.prefix);
  try { assert.equal(decodeView(url('history','example-12',{window:'7d'})).prefix,link.prefix); }
  finally { setRoutePrefix(null); }
  assert.equal(url('sprints'),'#sprints'); assert.equal(decodeView('#sprints?product=normal'),null);
});

test('oversized, ambiguous and malformed links stay out of personal settings',()=>{
  for (const bad of ['#p/2/dev/-/sprints','#p/1/../../sprints','#p/1/user/USER/sources','#p/1/a%2Fb/-/history',
    '#p/1/-/-/missing','#p/1/-/-/history?'+ 'x'.repeat(4100),'#p/1/'+Array.from({length:13},(_,i)=>'x'+i).join(',')+'/-/sources'])
    assert.equal(decodeView(bad)?.invalid,true,bad);
  assert.deepEqual(decodeView('#p/1/-/-/overview').owners,{users:[],organizations:[]});
  assert.throws(()=>viewLink('https://atlas.example/',settings,route('history','all'),{term:'🔎'.repeat(600),page:0}),/Shorten/);
  assert.equal(linkedIssueFilter(new URLSearchParams('page=-4')).page,0);
});

test('developer view and delivery drilldown filters survive sharing',()=>{
  const r=route('overview','acme-1','offset=4');
  const userRoute=developerRoute(r,' @Example ');
  assert.equal(userRoute,'#activity?product=acme-1&offset=4&activity=developer&developer=example');
  assert.equal(developerRoute(r,'org/other'),null);
  for(const [page,query] of [['activity','activity=developer&developer=example'],['history','window=7d'],
    ['overview','window=30d'],['sprints','period=window&window=90d'],['backlog','scope=milestone'],['roadmap','when=upcoming&window=30d']]){
    const link=viewLink('https://atlas.example/',settings,route(page,'acme-1',query));
    const parsed=decodeView(new URL(link).hash);
    const params=new URLSearchParams(parsed.route.split('?')[1]);
    for(const [key,value] of new URLSearchParams(query)) assert.equal(params.get(key),value);
  }
});

test('tiles weight sprint membership, deduplicate closures and use the seven India calendar dates',()=>{
  const sample=samplePortfolio(), [a,b]=sample.projects;
  b.items[0].sprint=null;
  a.items[0].closedAt='2026-11-11T18:30:00Z';
  b.items[0].closedAt='2026-11-11T18:29:59Z';
  b.items.push({...a.items[0],sprint:null});
  b.items.push({...b.items[0],closedAt:null,url:b.items[0].url+'no-date'});
  const m=sample.repositories[a.repos[0]].milestones[0];
  sample.repositories[a.repos[0]].milestones.push({...m,due:null,open:1},{...m,name:'Maintenance',due:null},{...m,due:null,open:0});
  const d=prepare(sample), seven=deliveryTimeframe(d.asOf,'7d');
  const {upcoming,...metrics}=deliveryMetrics(d,d.projects.slice(0,2),seven);
  assert.deepEqual(metrics,{recentlyClosed:1,sprintTotal:5,sprintClosed:1,sprintOpen:4,completion:20,needsSprint:2,undated:1});
  assert.equal(upcoming.length,1);
  assert.equal(deliveryMetrics(d,[],seven).completion,null);
});

test('changing the timeframe selects closure days, overlapping sprints and upcoming targets',()=>{
  const snapshot=samplePortfolio(), board=snapshot.projects[0];
  board.items[0].closedAt='2026-11-05T18:30:00Z';
  board.sprints.push({id:'prior',name:'Prior',start:'2026-10-06',end:'2026-10-20'});
  for (let i=0;i<2;i++)
    board.items.push({...board.items[0],url:board.items[0].url+'-prior-'+i,sprint:'prior',closedAt:'2026-10-20T17:00:00Z'});
  const m=snapshot.repositories[board.repos[0]].milestones[0];
  snapshot.repositories[board.repos[0]].milestones.push({...m,name:'v2.0.0',due:'2026-12-17'},
    {...m,name:'v3.0.0',due:'2026-12-18'});
  const d=prepare(snapshot), products=[d.projects.find(p=>p.key===board.key)], seven=deliveryTimeframe(d.asOf,'7d'), month=deliveryTimeframe(d.asOf,'30d');
  assert.equal(month.from,'2026-10-20');
  assert.equal(month.releaseThrough,'2026-12-17');
  const a=deliveryMetrics(d,products,seven), b=deliveryMetrics(d,products,month);
  assert.deepEqual([a.recentlyClosed,b.recentlyClosed],[0,3]);
  assert.deepEqual([a.sprintTotal,b.sprintTotal],[3,5]);
  assert.deepEqual([a.completion,b.completion],[33,60]);
  assert.deepEqual([a.upcoming.length,b.upcoming.length],[1,2]);
  assert.equal(deliveryTimeframe(d.asOf,'bad-value'),null);
});

test('adding an empty public board and linking a repository each updates the corresponding overview count',()=>{
  const snapshot=samplePortfolio(), p=snapshot.projects[0];
  const initial=portfolioInventory(prepare(snapshot).projects);
  const board={...p,key:'atlas-example-4',name:'New project',items:[],repos:[]};
  snapshot.projects.push(board);
  const empty=portfolioInventory(prepare(snapshot).projects);
  assert.equal(empty.boards,initial.boards+1);
  assert.equal(empty.repositories.length,initial.repositories.length);
  board.repos.push(p.repos[0].toUpperCase(),'atlas-example/new-repository');
  const linked=portfolioInventory(prepare(snapshot).projects);
  assert.equal(linked.boards,empty.boards);
  assert.equal(linked.repositories.length,empty.repositories.length+1);
});

const asOf='2026-11-18';
const rec=(days,status='complete')=>({start:'2026-10-22',through:asOf,days,status});
test('project streaks deduplicate shared repositories, use calendar days and carry yesterday through today',()=>{
  const one=rec({'2026-11-15':1,'2026-11-16':3});
  const two=rec({'2026-11-17':1,'2026-11-13':2});
  const records=repositoryRecords({repositories:{'ORG/ONE':{activity:one},'org/two':{activity:two}}},
    [{repos:['org/one','org/two']},{repos:['ORG/ONE']}]);
  assert.equal(records.length,2);
  const s=streakSummary(asOf,records);
  assert.equal(s.current,3); assert.equal(s.best,3); assert.equal(s.active,4);
  assert.equal(s.unknown,false); assert.equal(s.currentUnknown,false); assert.equal(s.complete,2);
  assert.deepEqual(s.days.at(-1),{date:asOf,count:0,complete:true});
  assert.equal(streakSummary(asOf,[rec({})]).current,0);
  assert.equal(streakSummary(asOf,[rec(Object.fromEntries(Array.from({length:28},(_,i)=>[iso(day(asOf)-i),1])))]).touchesStart,true);
});

test('missing and capped streak coverage retains proven active days and flags unobserved days',()=>{
  const partial=rec({'2026-11-17':3},'partial');
  const s=streakSummary(asOf,[rec({'2026-11-18':1}),partial,undefined]);
  assert.equal(s.current,2); assert.equal(s.best,2); assert.equal(s.unknown,true); assert.equal(s.currentUnknown,true);
  assert.equal(s.complete,1); assert.equal(s.days[0].complete,false);
  const stale={...rec({}),through:'2026-11-17'};
  assert.equal(streakSummary(asOf,[stale]).days.at(-2).complete,false);
  assert.equal(streakSummary(asOf,[stale]).days.at(-1).complete,false);
});
