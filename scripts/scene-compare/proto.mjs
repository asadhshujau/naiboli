// Renders the HTML prototype's own paint() for each scenario written by native.render.ts,
// using headless Chrome, so the two can be diffed (compare.py).
//   node scripts/scene-compare/proto.mjs <SCENE_OUT>
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const out = path.resolve(process.argv[2]);
const html = fs.readFileSync(path.join(root, 'design_handoff_naiboli/design/Naiboli Scene Live.dc.html'), 'utf8');
const script = html.match(/<script type="text\/x-dc" data-dc-script[^>]*>([\s\S]*?)<\/script>/)[1];
const clouds = script.match(/this\._clouds = (\[[^;]*\]);/)[1];
const fixtures = fs.readFileSync(path.join(out, 'fixtures.json'), 'utf8');
const figtree = 'file://' + path.join(root, 'node_modules/@expo-google-fonts/figtree/700Bold/Figtree_700Bold.ttf');
const chrome = process.env.CHROME || '/usr/bin/google-chrome';

const page = (sc) => `<!DOCTYPE html><html><head><meta charset="utf-8">
<style>@font-face{font-family:Figtree;font-weight:700;src:url(${figtree})}html,body{margin:0;padding:0;overflow:hidden;background:#000}canvas{display:block}</style>
</head><body><canvas id="c" width="402" height="874" style="width:402px;height:874px"></canvas>
<script>
const SC = ${JSON.stringify(sc)};
const FX = ${fixtures};
function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;}}
class DCLogic { constructor(){ this.props = {}; this.state = {}; } setState(p, cb){ const v = typeof p === 'function' ? p(this.state) : p; this.state = { ...this.state, ...v }; cb && cb(); } forceUpdate(){} }
const React = { createRef: () => ({ current: null }) };
${script}
(async () => {
  await document.fonts.load('700 12px Figtree');
  DAY0 = FX.day0; RISE = SC.sun.rise; SET = SC.sun.set;
  const c = new Component();
  c._clouds = ${clouds}; c._t = SC.t; c._stars = SC.stars; c._rain = SC.rain; c._flashT = SC.flashT; c._signName = SC.signName;
  let m;
  if (SC.live) { TIDE = c.procTide(FX.tide); const W = c.procWx(FX.weather); m = { ...SC.m, live: true, W }; }
  else { TIDE = null; m = { ...MOODS[SC.mood], ...SC.m, live: false, hour: SC.hour0 }; }
  const ctx = document.getElementById('c').getContext('2d');
  Math.random = mulberry32(SC.seed);
  c.paint(ctx, 402, 874, SC.dt, m, SC.hour, SC.dt);
  document.title = 'done';
})();
</script></body></html>`;

for (const f of fs.readdirSync(out).filter((f) => f.endsWith('.json') && f !== 'fixtures.json')) {
  const sc = JSON.parse(fs.readFileSync(path.join(out, f), 'utf8'));
  const file = path.join(out, `${sc.name}.proto.html`);
  fs.writeFileSync(file, page(sc));
  execFileSync(chrome, [
    '--headless=new', '--disable-gpu', '--no-sandbox', '--hide-scrollbars', '--force-device-scale-factor=1',
    '--allow-file-access-from-files', '--virtual-time-budget=4000', '--window-size=402,874',
    `--screenshot=${path.join(out, `${sc.name}.proto.png`)}`, 'file://' + file,
  ], { stdio: 'ignore' });
  console.log('rendered', sc.name);
}
