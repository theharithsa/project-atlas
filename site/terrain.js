import { e, icon, url } from './ui.js';

const width = 560, height = 250;
const stations = [[.48,.56], [.77,.73], [.21,.78], [.76,.24], [.19,.30], [.43,.14]];
function projection(angle) {
  const c = Math.cos(angle), s = Math.sin(angle);
  const xu = 370*c + 120*s, xv = 120*c - 370*s;
  const yu = 43*c - 83*s, yv = -83*c - 43*s;
  return (u,v,elevation = 0) => ({
    x: 280 + xu*(u-.5) + xv*(v-.5),
    y: 167 + yu*(u-.5) + yv*(v-.5) - elevation,
  });
}

export function terrainBoards(products) {
  const boards = products.map(p => ({key:p.key, name:p.label, count:p.open.length}));
  boards.sort((a,b) => b.count - a.count || a.name.localeCompare(b.name) || a.key.localeCompare(b.key));
  const max = boards[0]?.count || 1;
  return boards.map((board, index) => {
    const [u,v] = stations[index % stations.length];
    const elevation = 112 * Math.sqrt(board.count / max);
    return {...board, u, v, elevation};
  });
}

function surface(u, v, boards) {
  let highest = 0;
  for (const [i, board] of boards.entries()) {
    const dx = u - board.u, dy = v - board.v;
    const angle = Math.atan2(dy,dx);
    const shape = .25 + .05 * Math.sin(3*angle+i) + .026 * Math.cos(5*angle-i);
    const distance = Math.hypot(dx*.99 + dy*.12,dy*.89) / shape;
    if (distance >= 1) continue;
    const profile = (1 + Math.cos(Math.PI * distance)) / 2;
    const ridge = 1 - .24*Math.sin(Math.PI*distance)**2 * (.5+.5*Math.cos(4*angle+9*distance+i));
    highest = Math.max(highest,board.elevation * profile ** 1.12 * ridge);
  }
  return highest;
}

const resolution = 64;
function makeMesh(boards) {
  return Array.from({length:resolution+1},(_,row) =>
    Array.from({length:resolution+1},(_,col) => surface(col/resolution,row/resolution,boards)));
}

// Draw the engraved base, then mask each rear contour with the slice in front of it.
function paint(canvas, mesh, project) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const theme = getComputedStyle(canvas);
  ctx.setTransform(canvas.width/width,0,0,canvas.height/height,0,0);
  const color = token => theme.getPropertyValue('--plot-' + token).trim();
  const base = color('base'), low = color('low'), mid = color('mid'), high = color('high');
  if (!base || !low || !mid || !high) return;
  const relief = ctx.createLinearGradient(0,22,0,229);
  relief.addColorStop(0,high); relief.addColorStop(.58,mid); relief.addColorStop(1,low);
  ctx.clearRect(0,0,width,height);
  function line(a,b) { ctx.beginPath(); ctx.moveTo(a.x,a.y); ctx.lineTo(b.x,b.y); ctx.stroke(); }

  const corners = [[0,0],[1,0],[1,1],[0,1]].map(([u,v]) => project(u,v));
  const frontEdges = corners.map((a,i) => [a,corners[(i+1)%4]]).filter(([a,b]) => (a.y+b.y)/2 >= 167);
  for (const [a,b] of frontEdges) {
    ctx.beginPath(); ctx.moveTo(a.x,a.y); ctx.lineTo(b.x,b.y);
    ctx.lineTo(b.x,b.y+9); ctx.lineTo(a.x,a.y+9); ctx.closePath();
    ctx.fillStyle = color('face'); ctx.fill();
    ctx.strokeStyle = low; ctx.lineWidth = .75;
    line({x:a.x,y:a.y+9},{x:b.x,y:b.y+9});
    for (let i = 0; i <= 48; i++) {
      const x = a.x+(b.x-a.x)*i/48, y = a.y+(b.y-a.y)*i/48;
      line({x,y},{x,y:y+(i%4 ? 3 : 8)});
    }
  }

  // Traverse the mesh from back to front at every camera angle, including mid-turn.
  const du = corners[1].y-corners[0].y, dv = corners[3].y-corners[0].y;
  const swap = Math.abs(du)>Math.abs(dv), increasing = (swap ? du : dv)>0;
  const sample = (row,col,ground = false) => {
    const x = swap ? row : col, y = swap ? col : row;
    return project(x/resolution,y/resolution,ground ? 0 : mesh[y][x]);
  };
  const grid = color('grid');
  for (let slice = 0; slice <= resolution; slice++) {
    const row = increasing ? slice : resolution-slice;
    const path = new Path2D();
    const start = sample(row,0); path.moveTo(start.x,start.y);
    for (let col = 1; col <= resolution; col++) {
      const p = sample(row,col); path.lineTo(p.x,p.y);
    }
    const silhouette = new Path2D(path);
    for (const col of [resolution,0]) { const p = sample(row,col,true); silhouette.lineTo(p.x,p.y); }
    silhouette.closePath(); ctx.fillStyle = base; ctx.fill(silhouette);
    if (slice < resolution) {
      const next = row + (increasing ? 1 : -1);
      ctx.strokeStyle = grid; ctx.lineWidth = .63;
      for (let col = 0; col <= resolution; col += 4) line(sample(row,col),sample(next,col));
    }
    ctx.strokeStyle = relief; ctx.lineWidth = row%4 === 0 ? 1.17 : .74; ctx.stroke(path);
  }
  ctx.strokeStyle = mid; ctx.lineWidth = .75;
  for (const [a,b] of frontEdges) line(a,b);
}

export function terrainPanel() {
  return `<section class="terrain" aria-label="Workload terrain">
    <div class="terrain-heading"><span><i aria-hidden="true"></i> Workload terrain</span><small>Open issues / board</small></div>
    <div class="terrain-stage"><canvas aria-hidden="true" width="1120" height="500"></canvas><div class="terrain-pins"></div></div>
    <div class="terrain-foot"><div class="terrain-readout" aria-live="polite" aria-atomic="true"></div>
    <div class="terrain-tools"><button type="button" id="terrain-rotate" data-rotate aria-label="Rotate terrain 90 degrees" title="Rotate terrain 90 degrees">${icon('rotate',16)}</button><div class="terrain-nav"><button type="button" id="terrain-previous" data-step="-1" aria-label="Inspect previous board">${icon('left',15)}</button><button type="button" id="terrain-next" data-step="1" aria-label="Inspect next board">${icon('right',15)}</button></div></div></div>
  </section>`;
}

export function mountTerrain(host, products, timeframe, previous) {
  if (!host) return null;
  const boards = terrainBoards(products);
  const canvas = host.querySelector('canvas'), pins = host.querySelector('.terrain-pins');
  const readout = host.querySelector('.terrain-readout');
  const controls = host.querySelector('.terrain-nav');
  let index = Math.max(0,boards.findIndex(board => board.key === previous?.key));
  let sheet = -1, visible = [], mesh;
  let angle = previous?.angle || 0, destination = angle, frame;
  function repaint() {
    if (!host.isConnected) return;
    const project = projection(angle);
    paint(canvas,mesh,project);
    for (const [i,pin] of [...pins.children].entries()) {
      const board = visible[i], point = project(board.u,board.v,board.elevation);
      pin.style.left = (100*point.x/width) + '%'; pin.style.top = (100*point.y/height) + '%';
      pin.classList.toggle('pin-west',point.x > width*.67);
      pin.classList.toggle('pin-low',point.y < 38);
    }
  }
  function rotate(pointer) {
    cancelAnimationFrame(frame);
    destination += Math.PI/2;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    if (!pointer || reduced.matches) { angle = destination; repaint(); return; }
    const from = angle, start = performance.now();
    function turn(time) {
      if (!host.isConnected) return;
      const fraction = document.hidden || reduced.matches ? 1 : Math.min(1,(time-start)/250);
      angle = from+(destination-from)*fraction;
      repaint();
      if (fraction < 1) frame = requestAnimationFrame(turn);
    }
    frame = requestAnimationFrame(turn);
  }
  function select(next) {
    index = next;
    const board = boards[index], start = Math.floor(index/stations.length)*stations.length;
    if (start !== sheet) {
      sheet = start;
      visible = boards.slice(start,start+stations.length);
      mesh = makeMesh(visible);
      pins.innerHTML = visible.map((b,i) => `<button type="button" class="terrain-pin" id="terrain-pin-${e(b.key)}" data-index="${start+i}" aria-label="${e('Inspect ' + b.name + ', ' + b.count + ' open issues')}" title="${e(b.name + ' · ' + b.count + ' open')}"><span class="pin-value" aria-hidden="true">${b.count}</span></button>`).join('');
      repaint();
    }
    for (const pin of pins.children) pin.setAttribute('aria-pressed',String(Number(pin.dataset.index) === index));
    controls.hidden = boards.length < 2;
    host.querySelector('[data-rotate]').hidden = !boards.some(b => b.count);
    readout.innerHTML = board
      ? `<a id="terrain-board" aria-label="${e('Open '+board.name+' overview')}" href="${e(url('overview',board.key,{window:timeframe}))}"><strong>${e(board.name)}</strong>${icon('right',13)}</a><span>${board.count} open</span>`
      : '<span>No public boards in this portfolio</span>';
  }
  select(index);
  host.addEventListener('click', event => {
    const button = event.target.closest('button');
    if (!button || !boards.length) return;
    if (button.hasAttribute('data-rotate')) rotate(event.detail > 0);
    else if (button.hasAttribute('data-index')) select(Number(button.dataset.index));
    else if (button.hasAttribute('data-step')) select((index + Number(button.dataset.step) + boards.length) % boards.length);
  });
  return {repaint, get angle() { return destination % (2*Math.PI); }, get key() { return boards[index]?.key; }};
}
