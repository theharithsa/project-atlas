const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function playAtlasIntro() {
  const intro = document.getElementById('atlas-intro');
  if (!intro || reduceMotion()) return;
  const interaction = new AbortController();
  const finish = () => { intro.hidden = true; interaction.abort(); };
  intro.hidden = false;
  const options = {once:true,signal:interaction.signal};
  window.addEventListener('keydown',finish,options);
  window.addEventListener('pointerdown',finish,options);
  intro.addEventListener('animationend',event => { if (event.target === intro) finish(); },{signal:interaction.signal});
  window.setTimeout(finish,3300);
}

const TAU = Math.PI * 2;
const radians = value => value * Math.PI / 180;
const tilt = radians(17);
const world = [];
for (let latitude = -84; latitude <= 84; latitude += 7) {
  const lat = radians(latitude);
  const count = Math.max(8, Math.round(62 * Math.cos(lat)));
  for (let index = 0; index < count; index++) {
    const lon = TAU * index / count;
    world.push([Math.cos(lat)*Math.cos(lon), Math.sin(lat), Math.cos(lat)*Math.sin(lon)]);
  }
}

let played = false;
export function drawAtlasGlobe() {
  const canvas = document.querySelector('[data-atlas-orbit]');
  const ctx = canvas?.getContext('2d');
  if (!ctx) return;
  const x = canvas.width * .5, y = canvas.height * .5, radius = canvas.height * .356;
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const halo = ctx.createRadialGradient(x,y,radius*.82,x,y,radius*1.27);
  halo.addColorStop(0,'#4ea57736');
  halo.addColorStop(.46,'#70c78832');
  halo.addColorStop(1,'#70c78800');
  const shade = ctx.createRadialGradient(x-radius*.37,y-radius*.46,5,x,y,radius);
  shade.addColorStop(0,'#2a4633');
  shade.addColorStop(.56,'#132622');
  shade.addColorStop(1,'#09171b');

  function ring(phase, main) {
    ctx.save();
    ctx.translate(x,y);
    ctx.rotate(main ? -.32 : .40);
    const a = radius*(main ? 1.56 : 1.36), b = radius*(main ? .43 : .25);
    ctx.strokeStyle = main ? '#a0f5ad99' : '#83c9c46a';
    ctx.lineWidth = main ? 1.35 : 1;
    ctx.setLineDash(main ? [] : [4,7]);
    ctx.beginPath();
    ctx.ellipse(0,0,a,b,0,0,TAU);
    ctx.stroke();
    ctx.setLineDash([]);
    if (main) {
      const sx = a*Math.cos(phase), sy = b*Math.sin(phase);
      ctx.fillStyle = '#c6fa831c';
      ctx.beginPath();ctx.arc(sx,sy,13,0,TAU);ctx.fill();
      ctx.fillStyle = '#d7ffb0';
      ctx.beginPath();ctx.arc(sx,sy,4.2,0,TAU);ctx.fill();
    }
    ctx.restore();
  }

  function paint(turn) {
    ctx.clearRect(0,0,canvas.width,canvas.height);
    const phase = radians(31) + turn;
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(x,y,radius*1.27,0,TAU);
    ctx.fill();
    ring(phase,false);
    ctx.fillStyle = shade;
    ctx.strokeStyle = '#82c6a370';
    ctx.lineWidth = 1;
    ctx.beginPath();ctx.arc(x,y,radius,0,TAU);ctx.fill();ctx.stroke();
    const sine = Math.sin(phase), cosine = Math.cos(phase);
    const cosTilt = Math.cos(tilt), sinTilt = Math.sin(tilt);
    for (const [px,py,pz] of world) {
      const u = px * cosine - pz * sine;
      const depth = px * sine + pz * cosine;
      if (depth < -.1) continue;
      const mappedX = u * cosTilt - py * sinTilt;
      const mappedY = u * sinTilt + py * cosTilt;
      ctx.fillStyle = depth > .8 ? '#c4f8ac' : depth > .32 ? '#89c9a3' : '#507c62';
      const dot = depth > .67 ? 2.5 : 1.55;
      ctx.fillRect(x+mappedX*radius-dot/2,y-mappedY*radius-dot/2,dot,dot);
    }
    ring(phase+.12,true);
  }

  const canAnimate = !played && !motion.matches && !document.hidden;
  played = true;
  if (!canAnimate) { paint(.89); return; }
  let start, last = -Infinity;
  function frame(time) {
    if (!canvas.isConnected) return;
    start ??= time;
    const fraction = Math.min(1,(time-start)/3600);
    if (time-last >= 32 || fraction === 1 || document.hidden || motion.matches) {
      const next = document.hidden || motion.matches ? 1 : fraction;
      paint(.89*(1-(1-next)**3));
      last = time;
      if (next === 1) return;
    }
    window.requestAnimationFrame(frame);
  }
  window.requestAnimationFrame(frame);
}
