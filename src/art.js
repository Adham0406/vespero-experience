import { Painter, path } from './painter.js';

const sh = Painter.sh;

export const C = {
  RED: '#d8111d',
  DEEP: '#9b0f24',
  PAPER: '#f3f0e9',
  WHITE: '#faf8f3',
  INK: '#121010',
  SKIN: '#efe2cf',
  GOLD: '#c99a3b',
  SILVER: '#e7e6e1',
  STRAW: '#d9b46a',
};

export const FLAVORS = [
  { name: 'Blu Notte', note: 'Juniper · sea salt · bergamot', color: '#38a6ee' },
  { name: 'Verde Sera', note: 'Basil · lime · bitter herbs', color: '#55dd66' },
  { name: 'Oro Alba', note: 'Saffron · honey · orange peel', color: '#f3df2b' },
];

export const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export const easeOut = (t) => 1 - Math.pow(1 - clamp(t), 3);
export const range = (t, a, b) => clamp((t - a) / (b - a));

export function rng(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// --- outlined comic "capsule" limb ----------------------------------------
export function chain(P, pts, w, color, d = 0.2, a = 0.25, b = 0.3, ol = 3, shadow = true) {
  const p = new Path2D();
  p.moveTo(pts[0][0], pts[0][1]);
  if (pts.length === 1) p.lineTo(pts[0][0] + 0.01, pts[0][1]);
  for (let i = 1; i < pts.length; i++) p.lineTo(pts[i][0], pts[i][1]);
  P.stroke(p, C.INK, sh(1), w + ol * 2);
  P.stroke(p, color, sh(d, a, b), w);
  if (shadow) {
    P.save();
    P.translate(0, w * 0.22);
    P.stroke(p, color, sh(Math.min(0.95, d + 0.38), a, b), w * 0.42);
    P.restore();
  }
}

// pointing hand — wrist at origin, fingers point towards -x
export const HAND_TIP = [-136, -26];
export function drawHandPoint(P, x, y, rot, s, curl = 0) {
  P.save();
  P.translate(x, y);
  P.rotate(rot);
  P.scale(s, s);
  const k = C.SKIN;
  chain(P, [[-8, 2], [-56, 0]], 58, k, 0.2);
  chain(P, [[-50, 24], [-70, 34], [-62, 44]], 13, k, 0.24);
  chain(P, [[-58, 12], [-84, 22], [-76, 36]], 15, k, 0.22);
  chain(P, [[-62, -1], [-94, 6], [-88, 21]], 16, k, 0.2);
  chain(P, [[-26, -24], [-58, -40], [-82, -37]], 15, k, 0.18);
  const ix = -100 - (1 - curl) * 34;
  chain(P, [[-58, -15], [-100, -22], [ix, -26 + curl * 18]], 16, k, 0.16);
  // knuckle creases
  for (const [cx, cy] of [[-96, -21], [-118, -24]]) {
    P.stroke(path.line(cx, cy - 6, cx + 2, cy + 6), C.INK, sh(1), 1.6);
  }
  P.restore();
}

export function drawArm(P, wx, wy, ax, ay, s, sleeve = true) {
  chain(P, [[ax, ay], [wx, wy]], 54 * s, C.SKIN, 0.24, 0.25, 0.3, 3, false);
  if (!sleeve) return;
  const sx = lerp(wx, ax, 0.55), sy = lerp(wy, ay, 0.55);
  chain(P, [[ax, ay], [sx, sy]], 86 * s, C.WHITE, 0.05, 0.5, 0.2, 3, false);
  const n = 5;
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const cx = lerp(sx, ax, t * 0.8 + 0.05), cy = lerp(sy, ay, t * 0.8 + 0.05);
    P.stroke(path.ellipse(cx, cy, 17 * s, 26 * s, Math.atan2(ay - wy, ax - wx)), C.INK, sh(1), 6 * s);
  }
}

// bottle — origin at bottom centre
export function drawBottle(P, x, by, h, color, label = 'Vespero') {
  const bw = h * 0.3, bodyTop = by - h * 0.74, neckTop = by - h * 0.83, capTop = by - h;
  const body = path.rr(x - bw / 2, bodyTop, bw, by - bodyTop, bw * 0.36);
  P.fill(body, color, P.lg(x - bw / 2, 0, x + bw / 2, 0,
    [[0, 0.66], [0.22, 0.2], [0.5, 0.07], [0.82, 0.3], [1, 0.72]], 0.5, 0.25));
  P.stroke(body, C.INK, sh(1), Math.max(1.5, h * 0.012));
  // glass ridges
  for (let i = 1; i < 9; i++) {
    const yy = bodyTop + (by - bodyTop) * (i / 9);
    const p = new Path2D();
    p.moveTo(x - bw * 0.47, yy);
    p.quadraticCurveTo(x, yy + h * 0.012, x + bw * 0.47, yy);
    P.stroke(p, color, sh(0.55, 0.5, 0.3), Math.max(1, h * 0.006));
  }
  const neck = path.rect(x - bw * 0.22, neckTop, bw * 0.44, bodyTop - neckTop + bw * 0.12);
  P.fill(neck, C.SILVER, P.lg(x - bw * 0.22, 0, x + bw * 0.22, 0, [[0, 0.8], [0.4, 0.12], [1, 0.8]], 0, 0.2));
  P.stroke(neck, C.INK, sh(1), Math.max(1.2, h * 0.009));
  const cap = new Path2D();
  cap.moveTo(x - bw * 0.31, neckTop);
  cap.bezierCurveTo(x - bw * 0.36, capTop - h * 0.03, x + bw * 0.36, capTop - h * 0.03, x + bw * 0.31, neckTop);
  cap.closePath();
  P.fill(cap, C.SILVER, P.rg(x - bw * 0.08, capTop + h * 0.06, 1, bw * 0.45, [[0, 0.04], [0.6, 0.32], [1, 0.85]], 0.5, 0.3));
  P.stroke(cap, C.INK, sh(1), Math.max(1.2, h * 0.009));
  // cap "crown" ribs
  for (let i = -2; i <= 2; i++) {
    P.stroke(path.line(x + i * bw * 0.1, capTop + h * 0.03, x + i * bw * 0.12, neckTop), C.INK, sh(1), Math.max(1, h * 0.006));
  }
  P.rect(x - bw * 0.33, neckTop - h * 0.012, bw * 0.66, h * 0.024, C.INK, sh(1));
  const ly = by - h * 0.42, lh = h * 0.09;
  P.rect(x - bw / 2 + 1, ly, bw - 2, lh, C.INK, sh(0));
  if (h > 40) P.text(label, x, ly + lh * 0.72, `${lh * 0.72}px "Pinyon Script", cursive`, '#f3efe6');
  return { x0: x - bw / 2, x1: x + bw / 2, y0: capTop, y1: by, bw };
}

// classical column
export function drawColumn(P, x, top, bottom, cw, color, d = 0) {
  const capH = cw * 0.42, baseH = cw * 0.34;
  const shaft = path.rect(x - cw / 2, top + capH - 1, cw, bottom - top - capH - baseH + 2);
  P.fill(shaft, color, P.lg(x - cw / 2, 0, x + cw / 2, 0,
    [[0, clamp(0.78 + d)], [0.28, clamp(0.26 + d)], [0.55, clamp(0.1 + d)], [0.85, clamp(0.4 + d)], [1, clamp(0.88 + d)]], 0, 0.15));
  const ab = path.rect(x - cw * 0.78, top, cw * 1.56, capH * 0.42);
  P.fill(ab, color, P.lg(0, top, 0, top + capH * 0.42, [[0, clamp(0.15 + d)], [1, clamp(0.5 + d)]], 0.5, 0.2));
  const ech = path.poly([[x - cw * 0.72, top + capH * 0.42], [x + cw * 0.72, top + capH * 0.42], [x + cw * 0.53, top + capH], [x - cw * 0.53, top + capH]]);
  P.fill(ech, color, P.lg(0, top + capH * 0.42, 0, top + capH, [[0, clamp(0.25 + d)], [1, clamp(0.7 + d)]], 0.5, 0.2));
  const b1 = path.rect(x - cw * 0.62, bottom - baseH, cw * 1.24, baseH * 0.5);
  const b2 = path.rect(x - cw * 0.75, bottom - baseH * 0.5, cw * 1.5, baseH * 0.5);
  P.fill(b1, color, sh(clamp(0.35 + d), 0.5, 0.2));
  P.fill(b2, color, sh(clamp(0.5 + d), 0.5, 0.2));
  const lw = Math.max(1, cw * 0.035);
  for (const p of [shaft, ab, ech, b1, b2]) P.stroke(p, C.INK, sh(1), lw);
}

// standing black cloaked silhouette with hair in the wind
export function drawCloakSilhouette(P, x, by, h, time) {
  const head = h * 0.065, hy = by - h * 0.86;
  for (let j = 0; j < 10; j++) {
    const p = new Path2D();
    const y0 = hy - head * 0.5 + j * head * 0.17;
    p.moveTo(x + head * 0.2, y0);
    const segs = 7;
    for (let k = 1; k <= segs; k++) {
      const xx = x + head * 0.2 + k * h * 0.042 * (1 - j * 0.03);
      const yy = y0 + k * h * 0.008 + Math.sin(time * 4 + k * 0.9 + j * 0.7) * h * 0.016 * (k / segs);
      p.lineTo(xx, yy);
    }
    P.stroke(p, C.INK, sh(1), Math.max(1, h * 0.013 * (1 - j / 13)));
  }
  const c = new Path2D();
  c.moveTo(x - h * 0.05, hy + head * 0.6);
  c.quadraticCurveTo(x - h * 0.14, by - h * 0.77, x - h * 0.15, by - h * 0.6);
  c.lineTo(x - h * 0.22, by);
  c.lineTo(x + h * 0.21, by);
  c.lineTo(x + h * 0.15 + Math.sin(time * 3) * h * 0.01, by - h * 0.6);
  c.quadraticCurveTo(x + h * 0.14, by - h * 0.77, x + h * 0.05, hy + head * 0.6);
  c.closePath();
  P.fill(c, C.INK, sh(1));
  P.fill(path.ellipse(x, hy, head * 0.85, head), C.INK, sh(1));
}

// figure seen from behind (big, upper body)
export function drawFigureBack(P, x, by, h, robe, time) {
  const sw = h * 0.36;
  const r = new Path2D();
  r.moveTo(x - h * 0.1, by - h * 0.62);
  r.quadraticCurveTo(x - sw * 0.9, by - h * 0.6, x - sw, by - h * 0.38);
  r.lineTo(x - sw * 1.1, by + 5);
  r.lineTo(x + sw * 1.1, by + 5);
  r.lineTo(x + sw, by - h * 0.38);
  r.quadraticCurveTo(x + sw * 0.9, by - h * 0.6, x + h * 0.1, by - h * 0.62);
  r.closePath();
  P.fill(r, robe, P.lg(x - sw, 0, x + sw, 0, [[0, 0.8], [0.2, 0.42], [0.5, 0.32], [0.8, 0.42], [1, 0.85]], 0, 0.35));
  P.stroke(r, C.INK, sh(1), 3);
  const hy = by - h * 0.8, hr = h * 0.12;
  const sway = Math.sin(time * 1.3) * hr * 0.06;
  const hair = new Path2D();
  hair.moveTo(x - hr * 0.95, hy);
  hair.bezierCurveTo(x - hr * 1.1, hy - hr * 1.4, x + hr * 1.1, hy - hr * 1.4, x + hr * 0.95, hy);
  hair.bezierCurveTo(x + hr * 1.15, hy + hr * 1.4, x + hr * 1.3 + sway, by - h * 0.42, x + hr * 1.1 + sway, by - h * 0.32);
  hair.lineTo(x - hr * 1.1 + sway, by - h * 0.32);
  hair.bezierCurveTo(x - hr * 1.3 + sway, by - h * 0.42, x - hr * 1.15, hy + hr * 1.4, x - hr * 0.95, hy);
  hair.closePath();
  P.fill(hair, C.INK, sh(0.94, 0, 0.8));
  for (let i = -3; i <= 3; i++) {
    const p = new Path2D();
    p.moveTo(x + i * hr * 0.22, hy - hr * 0.9);
    p.quadraticCurveTo(x + i * hr * 0.32, hy + hr * 0.5, x + i * hr * 0.34 + sway, by - h * 0.34);
    P.stroke(p, '#3b3636', sh(0.72, 0, 0.8), 1.3);
  }
}

// gold-robed figure standing (3/4 front)
export function drawStandingFigure(P, x, by, h, robe, time) {
  const hy = by - h * 0.875;
  // hair behind
  const hb = path.poly([[x - h * 0.06, hy - h * 0.05], [x + h * 0.06, hy - h * 0.05], [x + h * 0.08, by - h * 0.66], [x - h * 0.09, by - h * 0.64]]);
  P.fill(hb, C.INK, sh(1));
  const r = new Path2D();
  r.moveTo(x - h * 0.04, by - h * 0.8);
  r.quadraticCurveTo(x - h * 0.15, by - h * 0.78, x - h * 0.15, by - h * 0.6);
  r.lineTo(x - h * 0.2, by);
  r.lineTo(x + h * 0.17, by);
  r.lineTo(x + h * 0.14, by - h * 0.6);
  r.quadraticCurveTo(x + h * 0.14, by - h * 0.78, x + h * 0.04, by - h * 0.8);
  r.closePath();
  P.fill(r, robe, P.lg(x - h * 0.2, 0, x + h * 0.17, 0, [[0, 0.8], [0.3, 0.28], [0.55, 0.15], [0.8, 0.45], [1, 0.85]], 0, 0.45));
  // black inner cloak
  const inner = path.poly([[x - h * 0.03, by - h * 0.79], [x + h * 0.0, by], [x - h * 0.12, by], [x - h * 0.1, by - h * 0.55]]);
  P.fill(inner, C.INK, sh(1));
  // folds
  for (const fx of [-0.13, 0.05, 0.1]) {
    const p = new Path2D();
    p.moveTo(x + h * fx * 0.6, by - h * 0.6);
    p.quadraticCurveTo(x + h * fx, by - h * 0.3, x + h * fx * 1.1, by);
    P.stroke(p, C.INK, sh(1), 1.6);
  }
  P.stroke(r, C.INK, sh(1), 2.5);
  // hands
  P.fill(path.ellipse(x + h * 0.15, by - h * 0.43, h * 0.022, h * 0.03), C.SKIN, sh(0.3, 0.25));
  // head
  const head = path.ellipse(x, hy, h * 0.045, h * 0.062);
  P.fill(head, C.SKIN, P.lg(x - h * 0.045, 0, x + h * 0.045, 0, [[0, 0.55], [0.5, 0.15], [1, 0.4]], 0, 0.3));
  P.stroke(head, C.INK, sh(1), 2);
  // hair top / side strands
  const ht = new Path2D();
  ht.moveTo(x - h * 0.05, hy + h * 0.02);
  ht.bezierCurveTo(x - h * 0.06, hy - h * 0.09, x + h * 0.06, hy - h * 0.09, x + h * 0.05, hy + h * 0.02);
  ht.lineTo(x + h * 0.035, hy - h * 0.025);
  ht.lineTo(x - h * 0.035, hy - h * 0.025);
  ht.closePath();
  P.fill(ht, C.INK, sh(1));
  P.rect(x - h * 0.012, hy - h * 0.01, h * 0.024, h * 0.05, C.INK, sh(0.95));
}

// figure from behind in a long flowing robe
export function drawFlowingRobeFigure(P, x, by, h, color, time) {
  const wv = Math.sin(time * 1.6) * h * 0.03;
  const wv2 = Math.cos(time * 1.2) * h * 0.02;
  const r = new Path2D();
  r.moveTo(x - h * 0.06, by - h * 0.8);
  r.quadraticCurveTo(x - h * 0.16, by - h * 0.78, x - h * 0.17, by - h * 0.6);
  r.quadraticCurveTo(x - h * 0.2, by - h * 0.25, x - h * 0.23, by);
  r.lineTo(x + h * 0.08, by + h * 0.02);
  r.bezierCurveTo(x + h * 0.3, by + h * 0.05 + wv, x + h * 0.5, by - h * 0.0 + wv2, x + h * 0.64, by - h * 0.07 - wv);
  r.bezierCurveTo(x + h * 0.52, by - h * 0.22 + wv, x + h * 0.34, by - h * 0.3 + wv2, x + h * 0.2, by - h * 0.52);
  r.quadraticCurveTo(x + h * 0.16, by - h * 0.78, x + h * 0.06, by - h * 0.8);
  r.closePath();
  P.fill(r, color, P.lg(x - h * 0.23, 0, x + h * 0.64, 0, [[0, 0.72], [0.18, 0.36], [0.4, 0.28], [0.7, 0.42], [1, 0.6]], 0, 0.6));
  for (let i = 0; i < 6; i++) {
    const p = new Path2D();
    const sx = x - h * 0.12 + i * h * 0.05;
    p.moveTo(sx, by - h * 0.7);
    p.bezierCurveTo(sx + h * 0.02, by - h * 0.4, sx + h * (0.05 + i * 0.06), by - h * 0.15 + wv * 0.5, sx + h * (0.04 + i * 0.09), by - h * 0.02 + wv * (i / 6));
    P.stroke(p, C.INK, sh(1), 1.6);
  }
  P.stroke(r, C.INK, sh(1), 2.6);
  // arm holding the robe out
  chain(P, [[x + h * 0.12, by - h * 0.7], [x + h * 0.24, by - h * 0.58], [x + h * 0.3, by - h * 0.5]], h * 0.06, color, 0.35, 0, 0.5, 2.4);
  // hair
  const hy = by - h * 0.86;
  const hair = new Path2D();
  hair.moveTo(x - h * 0.06, hy);
  hair.bezierCurveTo(x - h * 0.07, hy - h * 0.09, x + h * 0.07, hy - h * 0.09, x + h * 0.06, hy);
  hair.bezierCurveTo(x + h * 0.09, hy + h * 0.05, x + h * 0.13 + wv, hy + h * 0.08, x + h * 0.17 + wv, hy + h * 0.06);
  hair.bezierCurveTo(x + h * 0.08, hy + h * 0.14, x - h * 0.04, hy + h * 0.15, x - h * 0.065, hy + h * 0.11);
  hair.closePath();
  P.fill(hair, C.INK, sh(1));
  for (let j = 0; j < 5; j++) {
    const p = new Path2D();
    p.moveTo(x + h * 0.05, hy + j * h * 0.015);
    p.quadraticCurveTo(x + h * 0.15, hy + h * 0.02 + j * h * 0.01 + wv, x + h * (0.22 + j * 0.02) + wv, hy + h * (0.01 + j * 0.02) + wv2);
    P.stroke(p, C.INK, sh(1), Math.max(1, h * 0.006));
  }
}

// diving figure (action panel) — head towards +x
export function drawDiver(P, x, y, s, robe, time) {
  P.save();
  P.translate(x, y);
  P.rotate(0.38);
  P.scale(s, s);
  const k = C.SKIN;
  const flap = Math.sin(time * 9) * 6;
  chain(P, [[-40, -6], [-96, -28 + flap], [-142, -22 + flap]], 17, k, 0.22);
  chain(P, [[-40, 8], [-90, 14 - flap], [-128, 40 - flap]], 17, k, 0.22);
  const r = new Path2D();
  r.moveTo(40, -22);
  r.quadraticCurveTo(0, -36, -50, -24);
  r.bezierCurveTo(-90, -40 + flap, -130, -70 + flap, -170, -56 + flap);
  r.bezierCurveTo(-130, -20, -90, 30 - flap, -60, 26);
  r.quadraticCurveTo(0, 34, 40, 20);
  r.closePath();
  P.fill(r, robe, P.lg(0, -36, 0, 34, [[0, 0.55], [0.4, 0.2], [1, 0.75]], 0.5, 0.5));
  for (let i = 0; i < 4; i++) {
    const p = new Path2D();
    p.moveTo(30, -14 + i * 10);
    p.quadraticCurveTo(-40, -18 + i * 12, -100 - i * 12, -30 + i * 14 + flap);
    P.stroke(p, C.INK, sh(1), 3);
  }
  P.stroke(r, C.INK, sh(1), 3);
  chain(P, [[26, -16], [64, -34], [100, -28]], 14, k, 0.2);
  chain(P, [[26, 12], [66, 20], [98, 6]], 14, k, 0.2);
  P.fill(path.circle(58, 0, 20), C.INK, sh(1));
  for (let j = 0; j < 7; j++) {
    const p = new Path2D();
    p.moveTo(50, -14 + j * 5);
    p.quadraticCurveTo(10, -20 + j * 6 + flap, -30, -30 + j * 7 + flap * 1.5);
    P.stroke(p, C.INK, sh(1), 3.4);
  }
  P.restore();
}

// martini glass — returns geometry
export function drawGlass(P, cx, rimY, s, fill, liq) {
  const d = s * 0.55, ay = rimY + d;
  const cone = path.poly([[cx - s / 2, rimY], [cx + s / 2, rimY], [cx, ay]]);
  P.fill(cone, '#f4f4f2', P.lg(cx - s / 2, 0, cx + s / 2, 0, [[0, 0.5], [0.15, 0.1], [0.85, 0.1], [1, 0.5]], 0, 0.2));
  let ly = ay;
  if (fill > 0.002) {
    const lh = d * fill;
    ly = ay - lh;
    const hw = (s / 2) * fill;
    P.fill(path.poly([[cx - hw, ly], [cx + hw, ly], [cx, ay]]), liq,
      P.lg(cx - hw, 0, cx + hw, 0, [[0, 0.55], [0.3, 0.08], [0.7, 0.08], [1, 0.55]], 0, 0.3));
    P.fill(path.ellipse(cx, ly, hw, Math.max(1, s * 0.035 * fill)), liq, sh(0.0));
    P.stroke(path.ellipse(cx, ly, hw, Math.max(1, s * 0.035 * fill)), C.INK, sh(1), 1.5);
  }
  P.stroke(path.ellipse(cx, rimY, s / 2, s * 0.035), C.INK, sh(1), 2.5);
  P.stroke(cone, C.INK, sh(1), 3);
  const stem = path.rect(cx - s * 0.028, ay - 3, s * 0.056, s * 0.86);
  P.fill(stem, '#f4f4f2', P.lg(cx - s * 0.028, 0, cx + s * 0.028, 0, [[0, 0.65], [0.5, 0.04], [1, 0.65]], 0, 0.1));
  P.stroke(stem, C.INK, sh(1), 2.5);
  const base = path.ellipse(cx, ay + s * 0.86, s * 0.28, s * 0.05);
  P.fill(base, '#f4f4f2', P.lg(0, ay + s * 0.81, 0, ay + s * 0.91, [[0, 0.1], [1, 0.6]], 0.5, 0.2));
  P.stroke(base, C.INK, sh(1), 2.5);
  return { ay, ly, baseY: ay + s * 0.86 };
}

// irregular marble shard
export function drawShard(P, x, y, r, rot, seed) {
  const R = rng(seed);
  const n = 5 + Math.floor(R() * 3);
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + R() * 0.5;
    const rr = r * (0.55 + R() * 0.5);
    pts.push([Math.cos(a) * rr, Math.sin(a) * rr]);
  }
  P.save();
  P.translate(x, y);
  P.rotate(rot);
  const p = path.poly(pts);
  P.fill(p, C.WHITE, P.lg(-r, -r, r, r, [[0, 0.08], [0.6, 0.3], [1, 0.75]], R(), 0.6));
  P.stroke(p, C.INK, sh(1), Math.max(1, r * 0.06));
  P.restore();
}
