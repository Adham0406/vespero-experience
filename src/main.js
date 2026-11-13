import './style.css';
import '@fontsource/archivo/400.css';
import '@fontsource/archivo/600.css';
import '@fontsource/archivo/800.css';
import '@fontsource/cinzel-decorative/900.css';
import '@fontsource/pinyon-script/400.css';
import Lenis from 'lenis';
import { Painter, path } from './painter.js';
import { Renderer } from './renderer.js';
import { buildLayers } from './layers.js';
import { C, FLAVORS, clamp, lerp, ease, drawBottle } from './art.js';
import { SCENES } from './scenes.js';

const sh = Painter.sh;
const TR = 0.45; // length of a panel wipe, in screens

const $ = (s) => document.querySelector(s);
const cv = $('#stage');
const renderer = new Renderer(cv);

const touch = matchMedia('(hover: none), (pointer: coarse)').matches;
document.documentElement.classList.toggle('is-touch', touch);

const S = {
  w: 1, h: 1, k: 1, time: 0, t0: 0, touch,
  flavor: 0, hover: -1, hits: [], lift: [0, 0, 0],
  pour: 0, tilt: 1.3, pouring: false, boost: 0,
  hold: false, touchActive: false,
  pointer: { x: 0, y: 0, nx: 0.5, ny: 0.5, moved: false },
  handTip: { x: 0, y: 0 },
  L: null,
  drawReveal: null,
};

// ------------------------------------------------------------ timeline
const starts = [];
let total = 0;
for (const sc of SCENES) { starts.push(total); total += sc.len; }

let P = null;
let unit = innerHeight;
let lastW = 0, lastH = 0;
const mask = document.createElement('canvas');
const mctx = mask.getContext('2d');
const fc = document.createElement('canvas');
const fctx = fc.getContext('2d');
const gc = document.createElement('canvas');
const gctx = gc.getContext('2d');

function build() {
  const W = innerWidth, H = innerHeight;
  lastW = W; lastH = H;
  S.w = W; S.h = H;
  const k = W * H > 1.9e6 ? 0.75 : 1;
  S.k = k;
  if (!P) P = new Painter(k);
  P.resize(W, H, k);
  renderer.resize(W, H, Math.min(window.devicePixelRatio || 1, 2));
  cv.style.width = '100%';
  cv.style.height = '100%';
  buildLayers(S, W, H, k);
  // keep the revealed area when resizing
  const old = document.createElement('canvas');
  old.width = mask.width; old.height = mask.height;
  if (mask.width > 1) old.getContext('2d').drawImage(mask, 0, 0);
  for (const c of [mask, fc, gc]) { c.width = P.cc.width; c.height = P.cc.height; }
  if (old.width > 1) mctx.drawImage(old, 0, 0, mask.width, mask.height);
  unit = H;
  $('#track').style.height = `${Math.round(total * unit + unit)}px`;
  if (!S.pointer.moved) S.handTip = idleTip(0);
}

function idleTip(time) {
  return { x: S.w * 0.62 + Math.sin(time * 0.8) * S.w * 0.025, y: S.h * 0.56 + Math.cos(time * 0.6) * S.h * 0.03 };
}

// red face hidden in the wood, shown through the painted mask
S.drawReveal = (P) => {
  fctx.globalCompositeOperation = 'source-over';
  fctx.clearRect(0, 0, fc.width, fc.height);
  fctx.drawImage(S.L.face.cc, 0, 0);
  fctx.globalCompositeOperation = 'destination-in';
  fctx.drawImage(mask, 0, 0);
  gctx.globalCompositeOperation = 'source-over';
  gctx.clearRect(0, 0, gc.width, gc.height);
  gctx.fillStyle = sh(0.05, 0, 0.3);
  gctx.fillRect(0, 0, gc.width, gc.height);
  gctx.globalCompositeOperation = 'destination-in';
  gctx.drawImage(fc, 0, 0);
  for (const [ctx, src] of [[P.c, fc], [P.s, gc]]) {
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.drawImage(src, 0, 0);
    ctx.restore();
  }
};

let lastPaint = null;
function paintReveal(x, y) {
  const k = S.k;
  const r = Math.min(S.w, S.h) * 0.12 * k;
  const pts = [];
  if (lastPaint) {
    const d = Math.hypot(x - lastPaint.x, y - lastPaint.y);
    const n = Math.min(30, Math.ceil(d / 12));
    for (let i = 1; i <= n; i++) pts.push([lerp(lastPaint.x, x, i / n), lerp(lastPaint.y, y, i / n)]);
  } else pts.push([x, y]);
  for (const [px, py] of pts) {
    const g = mctx.createRadialGradient(px * k, py * k, 0, px * k, py * k, r);
    g.addColorStop(0, 'rgba(255,255,255,0.55)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    mctx.fillStyle = g;
    mctx.fillRect(px * k - r, py * k - r, r * 2, r * 2);
  }
  lastPaint = { x, y };
}

// ------------------------------------------------------------ wipes
function wipe(type, p, sc) {
  const W = S.w, H = S.h;
  const R = (seed) => { let x = Math.sin(seed * 91.7) * 43758.5; return x - Math.floor(x); };
  const clipP = new Path2D();
  let edge = new Path2D();
  if (type === 'iris') {
    const cy = H * (sc.irisY ?? 0.5);
    const r = Math.max(0.01, p * Math.hypot(W, H));
    clipP.arc(W / 2, cy, r, 0, Math.PI * 2);
    edge = clipP;
  } else if (type === 'left') {
    const x = W * (1 - p) * 1.1;
    const xt = x - (1 - p) * W * 0.08;
    clipP.moveTo(xt, -5); clipP.lineTo(W + 5, -5); clipP.lineTo(W + 5, H + 5); clipP.lineTo(x, H + 5); clipP.closePath();
    edge.moveTo(xt, -5); edge.lineTo(x, H + 5);
  } else {
    const down = type === 'down';
    const base = down ? H * p * 1.15 - H * 0.15 : H * (1 - p) * 1.15;
    const pts = [];
    const n = 12;
    for (let i = 0; i <= n; i++) {
      const x = (i / n) * W;
      const slant = (down ? 1 : -1) * (1 - p) * H * 0.12 * (i / n);
      pts.push([x, base + slant + (i > 0 && i < n ? (R(i + (down ? 7 : 3)) - 0.5) * 14 : 0)]);
    }
    if (down) {
      clipP.moveTo(-5, -5);
      clipP.lineTo(W + 5, -5);
      for (let i = pts.length - 1; i >= 0; i--) clipP.lineTo(pts[i][0], pts[i][1]);
    } else {
      clipP.moveTo(-5, H + 5);
      for (const q of pts) clipP.lineTo(q[0], q[1]);
      clipP.lineTo(W + 5, H + 5);
    }
    clipP.closePath();
    edge = path.poly(pts, false);
  }
  return { clipP, edge };
}

// ------------------------------------------------------------ input
const ui = (el) => el && el.closest && el.closest('.ui, .modal, #endcard');
addEventListener('pointermove', (e) => {
  if (e.pointerType === 'touch') return;
  S.pointer.x = e.clientX; S.pointer.y = e.clientY;
  S.pointer.nx = e.clientX / S.w; S.pointer.ny = e.clientY / S.h;
  S.pointer.moved = true;
});
addEventListener('pointerdown', (e) => {
  if (e.pointerType === 'touch' || e.button !== 0 || ui(e.target)) return;
  S.hold = true;
  e.preventDefault();
});
const release = () => { S.hold = false; lastPaint = null; };
addEventListener('pointerup', release);
addEventListener('pointercancel', release);
addEventListener('blur', release);

const touchPos = (e) => {
  const tt = e.touches[0];
  if (!tt) return;
  S.pointer.x = tt.clientX; S.pointer.y = tt.clientY;
  S.pointer.nx = tt.clientX / S.w; S.pointer.ny = tt.clientY / S.h;
  S.pointer.moved = true;
};
addEventListener('touchstart', (e) => { if (ui(e.target)) return; S.touchActive = true; touchPos(e); }, { passive: true });
addEventListener('touchmove', (e) => { if (S.touchActive) touchPos(e); }, { passive: true });
addEventListener('touchend', () => { S.touchActive = false; lastPaint = null; }, { passive: true });

const holdBtn = $('#hold-btn');
holdBtn.addEventListener('pointerdown', (e) => {
  if (!holdBtn.classList.contains('active')) return;
  e.preventDefault();
  holdBtn.setPointerCapture?.(e.pointerId);
  S.hold = true;
  holdBtn.classList.add('pressed');
});
for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) {
  holdBtn.addEventListener(ev, () => { S.hold = false; holdBtn.classList.remove('pressed'); });
}
addEventListener('contextmenu', (e) => { if (touch || S.hold) e.preventDefault(); });

function hitBottle(x, y) {
  for (const b of S.hits) {
    const pad = b.bw * 0.25;
    if (x > b.x0 - pad && x < b.x1 + pad && y > b.y0 - pad && y < b.y1) return b.i;
  }
  return -1;
}
let curMode = null;
addEventListener('click', (e) => {
  if (ui(e.target) || curMode !== 'choose') return;
  const i = hitBottle(e.clientX, e.clientY);
  if (i >= 0) chooseFlavor(i);
});
function chooseFlavor(i) {
  S.flavor = i;
  document.documentElement.style.setProperty('--flavor', FLAVORS[i].color);
  const c = document.querySelector('[data-cap="@flavor"]');
  if (c) c.classList.add('pulse');
  setTimeout(() => c && c.classList.remove('pulse'), 400);
}

// ------------------------------------------------------------ UI
const capWrap = $('#captions');
const caps = [];
SCENES.forEach((sc, si) => sc.caps.forEach(([a, b, pos, text]) => {
  const el = document.createElement('div');
  el.className = `caption pos-${pos}`;
  el.dataset.cap = text;
  el.innerHTML = '<p></p>';
  if (!text.startsWith('@')) el.firstChild.textContent = text;
  capWrap.appendChild(el);
  caps.push({ si, a, b, text, el });
}));

const cursor = $('#cursor');
const cursorLabel = cursor.querySelector('span');
const holdLabel = holdBtn.querySelector('span');
const hint = $('#scroll-hint');
const endcard = $('#endcard');
const LABELS = {
  move: touch ? 'Drag to reveal' : 'Hold & move',
  choose: touch ? 'Tap a bottle' : 'Choose flavor',
  pour: 'Hold & pour',
  hold: 'Hold',
};
let cur = { x: innerWidth / 2, y: innerHeight / 2 };
let lastLabel = '';

function updateUI(dom, tDom, s) {
  const mode = SCENES[dom].mode || null;
  const label = mode ? LABELS[mode] : '';
  if (label !== lastLabel) {
    cursorLabel.textContent = label;
    holdLabel.textContent = label;
    lastLabel = label;
  }
  const hoverBottle = mode === 'choose' && S.hover >= 0;
  cursor.classList.toggle('big', !!label && !hoverBottle);
  cursor.classList.toggle('hover', hoverBottle);
  cursor.classList.toggle('down', S.hold);
  if (!touch) {
    cur.x = lerp(cur.x, S.pointer.x, 0.35);
    cur.y = lerp(cur.y, S.pointer.y, 0.35);
    cursor.style.transform = `translate3d(${cur.x}px, ${cur.y}px, 0)`;
  }
  holdBtn.classList.toggle('show', !!label);
  holdBtn.classList.toggle('active', mode === 'pour' || mode === 'hold');

  for (const c of caps) {
    const on = c.si === dom && tDom >= c.a && tDom <= c.b &&
      (c.text !== '@full' || S.pour >= 1);
    if (on && c.text === '@flavor') {
      const f = FLAVORS[S.flavor];
      const html = `<b>${f.name}</b> — ${f.note}`;
      if (c.el.firstChild.innerHTML !== html) c.el.firstChild.innerHTML = html;
    }
    if (on && c.text === '@full' && !c.el.firstChild.textContent) {
      c.el.firstChild.textContent = 'Perfetto. The glass glows — now, drink.';
    }
    c.el.classList.toggle('show', on);
  }
  hint.classList.toggle('show', s < 0.04 && S.time - S.t0 > 1.2);
  endcard.classList.toggle('show', dom === SCENES.length - 1 && tDom > 0.72);
  $('#progress i').style.transform = `scaleX(${clamp(s / (total - 0.001))})`;
}

// ------------------------------------------------------------ frame
let lenis = null;
let lastNow = 0;
function frame(now) {
  requestAnimationFrame(frame);
  lenis.raf(now);
  const dt = Math.min(0.05, (now - lastNow) / 1000 || 0.016);
  lastNow = now;
  S.time = now / 1000;
  const s = clamp(lenis.scroll / unit, 0, total - 0.0001);

  let i = 0;
  while (i < SCENES.length - 1 && s >= starts[i + 1]) i++;
  const sc = SCENES[i], nx = SCENES[i + 1];
  const t = (s - starts[i]) / sc.len;
  let p = 0;
  if (nx && s > starts[i + 1] - TR) p = ease(clamp((s - (starts[i + 1] - TR)) / TR));
  const dom = p > 0.5 ? i + 1 : i;
  const tDom = (s - starts[dom]) / SCENES[dom].len;
  const mode = SCENES[dom].mode || null;
  curMode = mode;

  // --- interaction state
  const tipTarget = S.pointer.moved ? { x: S.pointer.x, y: S.pointer.y } : idleTip(S.time);
  const f = 1 - Math.pow(0.0005, dt);
  S.handTip.x = lerp(S.handTip.x, tipTarget.x, f);
  S.handTip.y = lerp(S.handTip.y, tipTarget.y, f);
  if (mode === 'move' && (S.hold || S.touchActive) && S.pointer.moved) paintReveal(S.handTip.x, S.handTip.y);

  S.hover = mode === 'choose' && !touch ? hitBottle(S.pointer.x, S.pointer.y) : -1;
  document.documentElement.classList.toggle('pointer', S.hover >= 0);

  const pourIdx = SCENES.findIndex((q) => q.id === 'pour');
  if (s < starts[pourIdx] - TR) S.pour = 0;
  if (mode === 'pour') {
    const auto = tDom > 0.72;
    S.pouring = (S.hold || auto) && S.pour < 1 && tDom > 0.06;
  } else S.pouring = false;
  S.tilt = lerp(S.tilt, S.pouring ? 1.95 : 1.3, 1 - Math.pow(0.002, dt));
  if (S.pouring && S.tilt > 1.75) S.pour = Math.min(1, S.pour + dt * 0.3);
  S.boost = lerp(S.boost, mode === 'hold' && S.hold ? 1 : 0, 1 - Math.pow(0.02, dt));

  // --- draw
  P.begin(C.INK, sh(1));
  sc.draw(P, t, S);
  if (p > 0) {
    const { clipP, edge } = wipe(nx.enter, p, nx);
    P.save();
    P.clip(clipP);
    nx.draw(P, (s - starts[i + 1]) / nx.len, S);
    P.restore();
    if (p < 0.999) P.stroke(edge, C.INK, sh(1), 6);
  }
  renderer.draw(P.cc, P.sc, S.time);
  updateUI(dom, tDom, s);
}

// ------------------------------------------------------------ collection modal
function buildCollection() {
  const list = $('#collection-list');
  FLAVORS.forEach((f, i) => {
    const B = new Painter(2);
    B.resize(90, 230, 2);
    B.begin(null);
    drawBottle(B, 45, 226, 220, f.color);
    const li = document.createElement('button');
    li.className = 'flavor-card';
    li.style.setProperty('--c', f.color);
    li.appendChild(B.cc);
    const tx = document.createElement('div');
    tx.innerHTML = `<h3>${f.name}</h3><p>${f.note}</p><span>Select</span>`;
    li.appendChild(tx);
    li.addEventListener('click', () => { chooseFlavor(i); closeModal(); });
    list.appendChild(li);
  });
}
const modal = $('#collection');
function openModal() { modal.classList.add('open'); lenis.stop(); }
function closeModal() { modal.classList.remove('open'); lenis.start(); }
modal.addEventListener('click', (e) => { if (e.target === modal || e.target.closest('[data-close]')) closeModal(); });
addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });

function replay() {
  mctx.clearRect(0, 0, mask.width, mask.height);
  S.pour = 0;
  lenis.scrollTo(0, { duration: 2.4 });
}
document.addEventListener('click', (e) => {
  const a = e.target.closest('[data-action]');
  if (!a) return;
  e.preventDefault();
  const act = a.dataset.action;
  if (act === 'top') { closeModal(); lenis.scrollTo(0, { duration: 2 }); }
  if (act === 'collection') openModal();
  if (act === 'replay') replay();
});

// ------------------------------------------------------------ boot
let rt = 0;
addEventListener('resize', () => {
  clearTimeout(rt);
  rt = setTimeout(() => {
    if (!lenis) return;
    if (innerWidth === lastW && Math.abs(innerHeight - lastH) < 160) return;
    const s = lenis.scroll / unit;
    build();
    lenis.resize();
    lenis.scrollTo(s * unit, { immediate: true });
  }, 180);
});

async function boot() {
  const bar = $('#loader i');
  bar.style.transform = 'scaleX(0.3)';
  try {
    await Promise.race([
      Promise.all([
        document.fonts.load('900 80px "Cinzel Decorative"', 'VESPERO'),
        document.fonts.load('40px "Pinyon Script"', 'Vespero'),
        document.fonts.load('600 12px "Archivo"'),
      ]),
      new Promise((r) => setTimeout(r, 2500)),
    ]);
  } catch { /* fonts are optional */ }
  bar.style.transform = 'scaleX(0.7)';
  await new Promise((r) => setTimeout(r, 30));
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  scrollTo(0, 0);
  build();
  buildCollection();
  lenis = new Lenis({ lerp: 0.085, wheelMultiplier: 0.9, touchMultiplier: 1.4 });
  bar.style.transform = 'scaleX(1)';
  S.t0 = performance.now() / 1000;
  requestAnimationFrame(frame);
  setTimeout(() => document.documentElement.classList.add('ready'), 250);
}
boot();
