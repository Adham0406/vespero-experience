// Pre-rendered (cached) backgrounds, rebuilt on resize.
import { Painter, path } from './painter.js';
import { C, rng, drawColumn } from './art.js';

const sh = Painter.sh;

function make(w, h, k) {
  const L = new Painter(k);
  L.resize(w, h);
  return L;
}

function wood(w, h, k) {
  const L = make(w, h, k);
  const r = rng(7);
  L.begin(C.DEEP, sh(0.17, 0, 1));
  L.s.globalAlpha = 0.5;
  for (let i = 0; i < 16; i++) {
    L.s.fillStyle = sh(0.3 + r() * 0.3, 0, 1);
    L.s.fillRect(r() * w, 0, 20 + r() * 140, h);
  }
  L.s.globalAlpha = 1;
  for (let i = 0; i < 36; i++) {
    let x = r() * w * 1.1 - w * 0.05;
    const pts = [];
    for (let y = -30; y < h + 60; y += 34) {
      x += (r() - 0.5) * 16;
      pts.push([x, y]);
    }
    const wd = 0.8 + Math.pow(r(), 2) * 6.5;
    L.stroke(path.smooth(pts), '#26050b', sh(1), wd);
    if (r() < 0.6) {
      const b = pts[Math.floor(r() * pts.length)];
      const pb = [[b[0], b[1]]];
      let bx = b[0], by = b[1];
      for (let j = 0; j < 4; j++) { bx += (r() - 0.3) * 18; by += 30; pb.push([bx, by]); }
      L.stroke(path.smooth(pb), '#26050b', sh(1), wd * 0.5);
    }
  }
  return L;
}

// hidden red face revealed by "hold & move"
function face(w, h, k) {
  const L = make(w, h, k);
  L.begin(null);
  const c = L.c;
  c.fillStyle = '#ff2a20';
  c.strokeStyle = '#ff2a20';
  c.lineCap = 'round';
  const blob = (x, y, rx, ry, rot = 0) => c.fill(path.ellipse(x, y, rx, ry, rot));
  for (const s of [-1, 1]) {
    blob(w * 0.5 + s * w * 0.12, h * 0.3, w * 0.075, h * 0.04, s * 0.1);
    c.lineWidth = h * 0.025;
    c.stroke(path.smooth([[w * 0.5 + s * w * 0.04, h * 0.21], [w * 0.5 + s * w * 0.12, h * 0.18], [w * 0.5 + s * w * 0.2, h * 0.21]]));
    blob(w * 0.5 + s * w * 0.15, h * 0.47, w * 0.05, h * 0.06);
  }
  c.lineWidth = h * 0.02;
  c.stroke(path.smooth([[w * 0.5, h * 0.3], [w * 0.52, h * 0.42], [w * 0.535, h * 0.49], [w * 0.5, h * 0.5]]));
  blob(w * 0.5, h * 0.58, w * 0.09, h * 0.028);
  blob(w * 0.5, h * 0.625, w * 0.07, h * 0.03);
  const r = rng(11);
  for (let i = 0; i < 22; i++) blob(r() * w, r() * h, 8 + r() * 40, 6 + r() * 24, r() * 3);
  // blobs in the inset panel
  blob(w * 0.12, h * 0.68, w * 0.05, h * 0.03);
  blob(w * 0.1, h * 0.74, w * 0.03, h * 0.02);
  return L;
}

function panelTex(w, h, k, seed) {
  const L = make(w, h, k);
  const r = rng(seed);
  L.begin(C.PAPER, sh(0));
  for (let x = 0; x < w; x += 5) {
    const g = L.lg(0, 0, 0, h, [[0, r() * 0.9], [0.3 + r() * 0.3, r() * 0.6], [1, 0.4 + r() * 0.6]], 0, 0.9);
    L.fillShade(path.rect(x, 0, 6, h), g);
  }
  return L;
}

function forest(w, h, k, strength, seed) {
  const L = make(w, h, k);
  const r = rng(seed);
  L.begin(null);
  for (let i = 0; i < 16; i++) {
    const tx = (i / 15) * w * 1.1 - w * 0.05 + (r() - 0.5) * 60;
    const th = h * (0.4 + r() * 0.4);
    const top = h - th;
    const tw = 50 + r() * 90;
    const trunk = path.rect(tx - tw * 0.1, top + th * 0.4, tw * 0.2, th);
    L.fill(trunk, C.PAPER, sh(0.85 * strength, 0, 1));
    for (let j = 0; j < 6; j++) {
      const cy = top + th * (j / 6) * 0.7 + tw * 0.4;
      const cr = tw * (0.5 + r() * 0.5) * (0.6 + j * 0.12);
      const cx = tx + (r() - 0.5) * tw * 0.7;
      L.fill(path.circle(cx, cy, cr), C.PAPER,
        L.lg(0, cy - cr, 0, cy + cr, [[0, 0.1 * strength], [1, 0.75 * strength]], 0, 1));
    }
  }
  for (let i = 0; i < 50; i++) {
    const x = r() * w, y = h * (0.05 + r() * 0.4);
    L.stroke(path.line(x, y, x + (r() - 0.5) * 4, y + 20 + r() * 70), C.INK, sh(strength), 1 + r() * 1.5);
  }
  const g = [[0, h]];
  for (let x = 0; x <= w + 40; x += 40) g.push([x, h * 0.86 + (r() - 0.5) * h * 0.06]);
  g.push([w, h]);
  L.fill(path.poly(g), C.INK, sh(0.95 * strength + 0.05, 0, 1));
  return L;
}

function stripes(w, h, k) {
  const L = make(w, h, k);
  const r = rng(5);
  L.begin(C.PAPER, sh(0));
  L.fillShade(path.rect(0, 0, w, h), L.lg(0, 0, 0, h, [[0, 0.42], [0.4, 0.5], [0.62, 0.65], [1, 0.95]], 0, 1));
  const spikes = [[0, h]];
  for (let x = 0; x <= w; x += 14) spikes.push([x, h * (0.5 + r() * 0.12) + (x % 28 ? 0 : -h * r() * 0.08)]);
  spikes.push([w, h]);
  L.fill(path.poly(spikes), C.PAPER, sh(0.9, 0, 1));
  L.rect(0, 0, w, h * 0.07, C.RED, sh(0.04));
  for (let i = 0; i < 6; i++) L.rect(r() * w, 0, 20 + r() * 50, h * 0.07, C.PAPER, sh(0.4 + r() * 0.5, 0, 0.6));
  L.rect(0, h * 0.07, w, 3, C.INK, sh(1));
  return L;
}

function colonnade(w, h, k) {
  const L = make(w, h, k);
  L.begin(null);
  const arch = path.rect(0, 0, w, h * 0.12);
  L.fill(arch, C.PAPER, L.lg(0, 0, 0, h * 0.12, [[0, 0.15], [0.7, 0.35], [1, 0.75]], 0.5, 0.4));
  L.stroke(arch, C.INK, sh(1), 2);
  const xs = [0.03, 0.12, 0.21, 0.3, 0.38, 0.62, 0.7, 0.79, 0.88, 0.97];
  for (const fx of xs) {
    const depth = Math.abs(fx - 0.5);
    drawColumn(L, w * fx, h * 0.12, h, Math.max(18, w * (0.035 + depth * 0.03)), C.PAPER, 0);
  }
  return L;
}

export function buildLayers(S, w, h, k) {
  S.L = {
    wood: wood(w, h, k),
    face: face(w, h, k),
    panelA: panelTex(Math.round(w * 0.37), Math.round(h * 0.42), k, 3),
    panelB: panelTex(Math.round(w * 0.37), Math.round(h * 0.42), k, 9),
    forestFar: forest(w, h, k, 0.55, 11),
    forestNear: forest(w, h, k, 1, 23),
    stripes: stripes(w, h, k),
    colonnade: colonnade(w, Math.round(h * 0.7), k),
  };
}
