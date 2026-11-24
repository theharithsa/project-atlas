const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function playAtlasIntro() {
  const intro = document.getElementById('atlas-intro');
  if (!intro || reduceMotion()) return;
  const interaction = new AbortController();
  const finish = () => {
    intro.hidden = true;
    document.documentElement.classList.remove('atlas-booting');
    interaction.abort();
  };
  document.documentElement.classList.add('atlas-booting');
  intro.hidden = false;
  const options = {once:true,signal:interaction.signal};
  window.addEventListener('keydown',finish,options);
  window.matchMedia('(prefers-reduced-motion: reduce)').addEventListener?.('change', event => {
    if (event.matches) finish();
  }, {signal:interaction.signal});
  window.addEventListener('pointerdown',finish,options);
  intro.addEventListener('animationend',event => { if (event.target === intro) finish(); },{signal:interaction.signal});
  window.setTimeout(finish,3300);
}

// Only deliberate pointer navigation animates. Polling, keyboard travel and filter changes stay immediate.
export function enterWorkspacePage(main) {
  if (reduceMotion() || document.hidden) return;
  const sections = [...main.children].filter(node => !node.classList.contains('linked-notice')).slice(0, 2);
  sections.forEach((section,index) => section.animate?.(
    [{opacity:.35,transform:'translateY(6px)'},{opacity:1,transform:'translateY(0)'}],
    {duration:200,delay:index*35,easing:'cubic-bezier(.23,1,.32,1)',fill:'backwards'},
  ));
}
