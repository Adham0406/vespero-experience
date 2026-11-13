// Every scene draws a full frame into the Painter for a local progress t (0..1).
// t may be slightly negative while the scene is wiping in over the previous one.
import { Painter, path } from './painter.js';
import {
  C, FLAVORS, clamp, lerp, ease, easeOut, range, rng, chain,
  drawHandPoint, HAND_TIP, drawArm, drawBottle, drawColumn, drawCloakSilhouette,
  drawFigureBack, drawStandingFigure, drawFlowingRobeFigure, drawDiver, drawGlass, drawShard,
} from './art.js';

const sh = Painter.sh;
const flav = (S) => FLAVORS[S.flavor].color;

function bg(P, S, color, shade) {
  P.rect(-4, -4, S.w + 8, S.h + 8, color, shade);
}

function zoom(P, cx, cy, z) {
  P.translate(cx, cy);
  P.scale(z, z);
  P.translate(-cx, -cy);
}

function textBoth(P, str, x, y, font, color, shade) {
  for (const [ctx, st] of [[P.c, color], [P.s, shade]]) {
    ctx.font = font;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = st;
    ctx.fillText(str, x, y);
  }
}

// ---------------------------------------------------------------- eye
export function drawEye(P, cx, cy, r, iris, open = 1, look = 0, pupil = 0.4, side = 1, brow = 1) {
  const top = r * 0.6 * open, bot = r * 0.42 * open;
  const al = new Path2D();
  al.moveTo(cx - r, cy);
  al.bezierCurveTo(cx - r * 0.5, cy - top * 1.35, cx + r * 0.5, cy - top * 1.35, cx + r, cy);
  al.bezierCurveTo(cx + r * 0.5, cy + bot * 1.3, cx - r * 0.5, cy + bot * 1.3, cx - r, cy);
  al.closePath();
  P.fill(al, C.WHITE, P.lg(0, cy - top, 0, cy + bot, [[0, 0.5], [0.45, 0.06], [1, 0.22]], 0.5, 0.4));
  P.save();
  P.clip(al);
  const ix = cx + look * r * 0.25, ir = r * 0.47;
  P.fill(path.circle(ix, cy, ir), iris, P.rg(ix, cy - ir * 0.2, ir * 0.15, ir, [[0, 0.08], [0.65, 0.32], [1, 0.8]], 0.25, 0.45));
  // iris fibres
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * Math.PI * 2;
    P.stroke(path.line(ix + Math.cos(a) * ir * pupil * 1.1, cy + Math.sin(a) * ir * pupil * 1.1,
      ix + Math.cos(a) * ir * 0.9, cy + Math.sin(a) * ir * 0.9), C.INK, sh(1), Math.max(0.6, r * 0.012));
  }
  P.stroke(path.circle(ix, cy, ir), C.INK, sh(1), Math.max(1.5, r * 0.045));
  P.fill(path.circle(ix, cy, ir * pupil), C.INK, sh(1));
  P.fill(path.circle(ix - ir * 0.32, cy - ir * 0.32, ir * 0.17), C.WHITE, sh(0));
  // shadow of upper lid
  const ls = new Path2D();
  ls.moveTo(cx - r, cy);
  ls.bezierCurveTo(cx - r * 0.5, cy - top * 1.35, cx + r * 0.5, cy - top * 1.35, cx + r, cy);
  P.stroke(ls, C.WHITE, sh(0.75, 0.5, 0.5), r * 0.22);
  P.restore();
  const lw = Math.max(1.5, r * 0.04);
  P.stroke(al, C.INK, sh(1), lw);
  const tl = new Path2D();
  tl.moveTo(cx - r * 1.06, cy + r * 0.03);
  tl.bezierCurveTo(cx - r * 0.5, cy - top * 1.38, cx + r * 0.5, cy - top * 1.38, cx + r * 1.06, cy - r * 0.05);
  P.stroke(tl, C.INK, sh(1), r * 0.1);
  // crease
  const cr = new Path2D();
  cr.moveTo(cx - r * 0.78, cy - top * 0.95 - r * 0.08);
  cr.bezierCurveTo(cx - r * 0.3, cy - top * 1.6 - r * 0.12, cx + r * 0.4, cy - top * 1.6 - r * 0.12, cx + r * 0.9, cy - top * 0.95 - r * 0.06);
  P.stroke(cr, C.INK, sh(1), lw * 0.8);
  // lashes
  for (let i = 0; i < 9; i++) {
    const a = 0.08 + (i / 8) * 0.84;
    const px = lerp(cx - r, cx + r, a);
    const py = cy - top * 1.0 * Math.sin(Math.PI * a) - r * 0.02;
    const out = (a - 0.5) * 0.9;
    P.stroke(path.line(px, py, px + out * r * 0.25, py - r * 0.18), C.INK, sh(1), lw);
  }
  // lower lid line
  const lo = new Path2D();
  lo.moveTo(cx - r * 0.7, cy + bot * 1.05 + r * 0.1);
  lo.quadraticCurveTo(cx, cy + bot * 1.35 + r * 0.14, cx + r * 0.75, cy + bot * 0.95 + r * 0.1);
  P.stroke(lo, C.INK, sh(1), lw * 0.6);
  if (brow) {
    const by = cy - top * 1.5 - r * 0.42 * brow;
    const b = new Path2D();
    b.moveTo(cx - side * r * 0.95, by + r * 0.18);
    b.quadraticCurveTo(cx - side * r * 0.1, by - r * 0.16, cx + side * r * 1.05, by + r * 0.08);
    P.stroke(b, C.INK, sh(1), r * 0.14);
  }
}

// ---------------------------------------------------------------- 0 · hero
function hero(P, t, S) {
  const { w: W, h: H, L, time } = S;
  const u = Math.min(W, H);
  const nx = S.pointer.nx - 0.5, ny = S.pointer.ny - 0.5;
  P.layer(L.wood, -30 - nx * 30, -30 - ny * 30 - Math.max(0, t) * H * 0.06, W + 60, H + 60);
  S.drawReveal(P);

  // floating embers
  const R = rng(4);
  for (let i = 0; i < 46; i++) {
    const sp = 6 + R() * 22;
    const x = ((R() * W + Math.sin(time * 0.7 + i) * 20) % W + W) % W;
    const y = ((R() * H - time * sp) % H + H) % H;
    P.fill(path.circle(x, y, 0.8 + R() * 2), C.WHITE, sh(0));
  }

  const enter = easeOut(clamp((time - S.t0) / 1.8));
  const leave = ease(range(t, 0.45, 0.95));
  const tip = {
    x: S.handTip.x + (1 - enter) * W * 0.5 + leave * W * 0.7,
    y: S.handTip.y + (1 - enter) * H * 0.5 + leave * H * 0.55,
  };
  const s = u / 430;
  const rot = 0.48 + nx * 0.25;
  const cr = Math.cos(rot), sr = Math.sin(rot);
  const lx = HAND_TIP[0] * s, ly = HAND_TIP[1] * s;
  const wx = tip.x - (lx * cr - ly * sr), wy = tip.y - (lx * sr + ly * cr);
  drawArm(P, wx, wy, wx + cr * 1100 * s, wy + sr * 1100 * s, s);
  drawHandPoint(P, wx, wy, rot, s, S.hold ? 0.3 : 0);
  if (S.touch) {
    const coin = path.ellipse(tip.x, tip.y, u * 0.045, u * 0.04, -0.3);
    P.fill(coin, C.WHITE, sh(0.05, 0.5, 0.2));
    P.stroke(coin, C.INK, sh(1), 2.5);
  }
}

// ---------------------------------------------------------------- 1 · round window
function windowScene(P, t, S) {
  const { w: W, h: H, time } = S;
  const R = Math.min(W * 0.4, H * 0.34);
  const cx = W / 2, cy = H * 0.6;
  bg(P, S, C.PAPER, sh(0.02, 0, 0.3));
  const z = 1 + Math.pow(range(t, 0.45, 1), 2.2) * 7;
  const drift = (1 - easeOut(range(t, -0.3, 0.4))) * H * 0.22;
  P.save();
  zoom(P, cx, cy, z);
  P.translate(0, drift);

  // hatched curtain panels at the top
  const ph = cy - R * 0.6;
  for (const side of [-1, 1]) {
    const x0 = side < 0 ? W * 0.04 : cx + R * 0.1;
    const x1 = side < 0 ? cx - R * 0.1 : W * 0.96;
    const pp = path.rect(x0, -H * 0.3, x1 - x0, ph + H * 0.3);
    P.fill(pp, C.PAPER, P.lg(0, 0, 0, ph, [[0, 0.95], [0.55, 0.62], [1, 0.28]], 0, 0.95));
    P.stroke(pp, C.INK, sh(1), 3);
  }
  // floor
  const fy = cy + R * 0.92;
  P.rect(-W, fy, W * 3, H * 2, C.PAPER, P.lg(0, fy, 0, H, [[0, 0.18], [1, 0.55]], 0.5, 0.8));
  P.stroke(path.line(-W, fy, W * 2, fy), C.INK, sh(1), 3);
  // pillar above ring
  const pil = path.rect(cx - R * 0.07, -H, R * 0.14, cy - R * 1.1 + H);
  P.fill(pil, C.WHITE, P.lg(cx - R * 0.07, 0, cx + R * 0.07, 0, [[0, 0.6], [0.5, 0.1], [1, 0.6]], 0, 0.2));
  P.stroke(pil, C.INK, sh(1), 3);
  // ring
  const ring = path.circle(cx, cy, R * 1.12);
  P.fill(ring, C.WHITE, P.rg(cx, cy, R, R * 1.12, [[0, 0.4], [1, 0.04]], 0.25, 0.3));
  P.stroke(ring, C.INK, sh(1), 4);
  const win = path.circle(cx, cy, R);
  P.fill(win, C.RED, P.rg(cx, cy - R * 0.2, R * 0.1, R * 1.05, [[0, 0.04], [0.6, 0.2], [1, 0.62]], 0.5, 0.35));
  P.save();
  P.clip(win);
  drawCloakSilhouette(P, cx - R * 0.05, cy + R * 1.02, R * 1.35, time);
  P.restore();
  P.stroke(win, C.INK, sh(1), 6);
  // rubble
  for (let i = 0; i < 9; i++) {
    drawShard(P, cx + (i - 4) * R * 0.34, fy + R * 0.1 + (i % 2) * R * 0.08, R * (0.07 + (i % 3) * 0.03), i, 30 + i);
  }
  P.restore();
}

// ---------------------------------------------------------------- 2 · forest
function forest(P, t, S) {
  const { w: W, h: H, L } = S;
  bg(P, S, C.PAPER, sh(0.3, 0, 0.95));
  const z1 = 1 + Math.max(0, t) * 0.35, z2 = 1 + Math.max(0, t) * 1.5;
  P.save();
  zoom(P, W / 2, H * 0.75, z1);
  P.layer(L.forestFar, 0, 0, W, H);
  P.restore();
  P.save();
  zoom(P, W / 2, H * 0.8, z2);
  P.layer(L.forestNear, 0, 0, W, H);
  P.restore();
  const dark = range(t, 0.55, 0.92);
  if (dark > 0) {
    P.alpha(dark);
    bg(P, S, C.INK, sh(1));
    P.alpha(1);
  }
}

// ---------------------------------------------------------------- 3 · red hall
function hall(P, t, S) {
  const { w: W, h: H, time } = S;
  const u = Math.min(W, H);
  bg(P, S, C.INK, sh(1));
  const rise = easeOut(range(t, -0.15, 0.32));
  const off = (1 - rise) * H * 0.9;
  const glow = path.rect(-4, H * 0.18 + off, W + 8, H);
  P.fill(glow, C.RED, P.lg(0, H * 0.18 + off, 0, H + off, [[0, 0.8], [0.5, 0.4], [1, 0.12]], 0, 0.75));
  const nb = Math.max(6, Math.round(W / (u * 0.15)));
  for (let i = 0; i < nb; i++) {
    const x = ((i + 0.5) / nb) * W;
    drawColumn(P, x, H * 0.16 + off * 1.15, H * 0.8 + off * 1.15, u * 0.05, C.RED, 0.28);
  }
  // distant pedestal with three tiny bottles
  const tx = W / 2, ty = H * 0.8 + off;
  drawColumn(P, tx, ty - u * 0.09, ty, u * 0.05, C.PAPER, 0.12);
  for (let i = 0; i < 3; i++) drawBottle(P, tx + (i - 1) * u * 0.022, ty - u * 0.09, u * 0.06, FLAVORS[i].color);
  P.rect(-4, H * 0.8 + off, W + 8, H, C.RED, P.lg(0, H * 0.8 + off, 0, H + off, [[0, 0.62], [1, 0.2]], 0.5, 0.4));
  const nf = Math.max(4, Math.round(W / (u * 0.32)));
  for (let i = 0; i < nf; i++) {
    const x = ((i + 0.5) / nf) * W;
    if (Math.abs(x - W / 2) < u * 0.14) continue;
    drawColumn(P, x, -u * 0.04 + off * 1.4, H * 1.03 + off * 1.4, u * 0.11, C.RED, 0.05);
  }

  // strip with watching eyes
  const e = easeOut(range(t, 0.28, 0.42)) * (1 - ease(range(t, 0.6, 0.72)));
  if (e > 0) {
    const sw = Math.min(W * 0.86, u * 1.3), shh = sw * 0.24;
    const sx = (W - sw) / 2, sy = -shh - 10 + e * (shh + H * 0.06);
    const strip = path.rect(sx, sy, sw, shh);
    P.fill(strip, C.SKIN, sh(0.34, 0, 0.7));
    P.save();
    P.clip(strip);
    const look = Math.sin(time * 0.9) * 0.7;
    drawEye(P, sx + sw * 0.3, sy + shh * 0.62, shh * 0.36, '#8b6a46', 0.75, look, 0.42, -1, 0.7);
    drawEye(P, sx + sw * 0.7, sy + shh * 0.62, shh * 0.36, '#8b6a46', 0.75, look, 0.42, 1, 0.7);
    P.restore();
    P.stroke(strip, C.INK, sh(1), 4);
  }
  const f = easeOut(range(t, 0.62, 1));
  if (f > 0) drawFigureBack(P, W * 0.5, H + (1 - f) * H * 0.75, Math.min(H * 0.95, W * 1.25), C.STRAW, time);
}

// ---------------------------------------------------------------- 4 · approach the pedestal
function approach(P, t, S) {
  const { w: W, h: H, time } = S;
  const u = Math.min(W, H);
  const port = H > W;
  const z = lerp(1, 1.16, ease(clamp(t)));
  P.save();
  zoom(P, W * 0.55, H * 0.65, z);
  bg(P, S, C.RED, P.lg(0, 0, 0, H, [[0, 0.3], [0.7, 0.06]], 0.5, 0.4));
  const fy = H * 0.74;
  const R = rng(9);
  for (let i = 0; i < 8; i++) {
    const cl = path.ellipse(R() * W, fy - u * 0.015 + R() * u * 0.03, u * (0.1 + R() * 0.14), u * (0.03 + R() * 0.02));
    P.fill(cl, C.PAPER, sh(0.12, 0.5, 0.9));
  }
  const floor = path.rect(-W, fy, W * 3, H);
  P.fill(floor, C.PAPER, P.lg(0, fy, 0, H, [[0, 0.6], [0.3, 0.3], [1, 0.12]], 0.5, 0.9));
  P.stroke(path.line(-W, fy, W * 2, fy), C.INK, sh(1), 2.5);
  const px = W * (port ? 0.74 : 0.64);
  const colH = Math.min(H * 0.34, u * 0.5), cw = colH * 0.32;
  drawColumn(P, px, fy - colH, fy + u * 0.012, cw, C.PAPER, 0);
  const hb = colH * 0.42;
  for (let i = 0; i < 3; i++) drawBottle(P, px + (i - 1) * hb * 0.36, fy - colH, hb, FLAVORS[i].color);
  const fx = lerp(W * (port ? 0.2 : 0.28), W * (port ? 0.34 : 0.43), ease(range(t, 0, 0.8)));
  const figH = Math.min(H * 0.66, W * (port ? 0.85 : 0.95));
  drawStandingFigure(P, fx, fy + u * 0.03, figH, C.GOLD, time);
  P.restore();
}

// ---------------------------------------------------------------- 5 · choose a flavour
function bottles(P, t, S) {
  const { w: W, h: H, L } = S;
  P.layer(L.stripes, 0, 0, W, H);
  const shelfY = H * 0.86;
  P.rect(-4, shelfY, W + 8, H, C.INK, sh(0.9, 0.5, 0.5));
  const shelf = path.rect(-4, shelfY, W + 8, H * 0.035);
  P.fill(shelf, C.PAPER, sh(0.1, 0.5, 0.2));
  P.stroke(shelf, C.INK, sh(1), 3);
  const hb = Math.min(H * 0.6, W * 0.6), gap = hb * 0.42;
  S.hits = [];
  for (let i = 0; i < 3; i++) {
    const rise = easeOut(range(t, -0.25 + i * 0.07, 0.18 + i * 0.07));
    const target = (S.flavor === i ? 0.06 : 0) + (S.hover === i ? 0.025 : 0);
    S.lift[i] = lerp(S.lift[i], target, 0.15);
    const x = W / 2 + (i - 1) * gap;
    const by = shelfY - S.lift[i] * hb + (1 - rise) * H * 0.9;
    P.fill(path.ellipse(x, shelfY + 3, hb * 0.17, hb * 0.022), C.INK, sh(1));
    const b = drawBottle(P, x, by, hb, FLAVORS[i].color);
    S.hits.push({ i, ...b });
    if (S.flavor === i && rise > 0.9) {
      const ay = b.y0 - hb * 0.06;
      const tri = path.poly([[x - hb * 0.035, ay - hb * 0.05], [x + hb * 0.035, ay - hb * 0.05], [x, ay]]);
      P.fill(tri, C.WHITE, sh(0));
      P.stroke(tri, C.INK, sh(1), 2.5);
    }
  }
}

// ---------------------------------------------------------------- 6 · hold & pour
function pour(P, t, S) {
  const { w: W, h: H, time } = S;
  const u = Math.min(W, H);
  const col = flav(S);
  bg(P, S, C.RED, P.lg(0, 0, 0, H, [[0, 0.14], [1, 0.04]], 0, 0.3));
  const gs = Math.min(W * 0.36, H * 0.4);
  const gx = W * (H > W ? 0.6 : 0.62), rimY = H * 0.97 - gs * 1.43;
  const g = drawGlass(P, gx, rimY, gs, S.pour, col);

  const hb = gs * 1.15, bw = hb * 0.3;
  const th = S.tilt;
  const enter = easeOut(range(t, -0.15, 0.25));
  const mx = gx - gs * 0.1 - (1 - enter) * W * 0.8;
  const my = rimY - gs * 0.32 - (1 - enter) * H * 0.7;
  const m = -hb * 0.47;
  const cxB = mx + Math.sin(th) * m, cyB = my - Math.cos(th) * m;

  if (S.pouring && th > 1.7) {
    const ly = S.pour > 0.01 ? g.ly : g.ay;
    const wob = Math.sin(time * 18) * gs * 0.01;
    const st = new Path2D();
    st.moveTo(mx, my);
    st.quadraticCurveTo(mx + gs * 0.13 + wob, my + gs * 0.04, gx + wob * 0.5, ly);
    const sw = u * 0.013;
    P.stroke(st, C.INK, sh(1), sw + 5);
    P.stroke(st, col, sh(0.12, 0, 0.3), sw);
    const R = rng(Math.floor(time * 12));
    for (let i = 0; i < 6; i++) {
      const d = path.circle(gx + (R() - 0.5) * gs * 0.3, ly - R() * gs * 0.08, 1.5 + R() * 3);
      P.fill(d, col, sh(0.1));
      P.stroke(d, C.INK, sh(1), 1.2);
    }
  }

  P.save();
  P.translate(cxB, cyB);
  P.rotate(th);
  drawBottle(P, 0, hb / 2, hb, col);
  // the hand gripping the bottle (local -x faces up in world)
  const c = Math.cos(-th), s = Math.sin(-th);
  const dx = -1 * c - -1 * s, dy = -1 * s + -1 * c; // world (-1,-1) → local
  const dl = Math.hypot(dx, dy);
  const palm = [-bw * 0.62, hb * 0.1];
  chain(P, [palm, [palm[0] + (dx / dl) * hb * 3, palm[1] + (dy / dl) * hb * 3]], bw * 0.72, C.SKIN, 0.24, 0.25, 0.3, 3, false);
  chain(P, [[-bw * 0.62, hb * 0.0], [-bw * 0.62, hb * 0.2]], bw * 0.55, C.SKIN, 0.2);
  for (let j = 0; j < 4; j++) {
    const y = -hb * 0.02 + j * hb * 0.062;
    chain(P, [[-bw * 0.5, y], [-bw * 0.05, y - hb * 0.012], [bw * 0.38, y + hb * 0.014]], bw * 0.17, C.SKIN, 0.18);
  }
  chain(P, [[-bw * 0.55, hb * 0.0], [-bw * 0.42, -hb * 0.12], [-bw * 0.28, -hb * 0.17]], bw * 0.18, C.SKIN, 0.16);
  P.restore();
}

// ---------------------------------------------------------------- 7 · drink
function drawBust(P, x, ny, s, col, time, sip) {
  const hair = path.poly([[x - s * 0.12, ny - s * 0.28], [x + s * 0.12, ny - s * 0.28], [x + s * 0.17, ny + s * 0.14], [x - s * 0.17, ny + s * 0.14]]);
  P.fill(hair, C.INK, sh(1));
  const r = new Path2D();
  r.moveTo(x - s * 0.07, ny);
  r.quadraticCurveTo(x - s * 0.3, ny + s * 0.04, x - s * 0.36, ny + s * 0.16);
  r.lineTo(x - s * 0.42, ny + s * 0.9);
  r.lineTo(x + s * 0.42, ny + s * 0.9);
  r.lineTo(x + s * 0.36, ny + s * 0.16);
  r.quadraticCurveTo(x + s * 0.3, ny + s * 0.04, x + s * 0.07, ny);
  r.closePath();
  P.fill(r, C.GOLD, P.lg(x - s * 0.4, 0, x + s * 0.4, 0, [[0, 0.72], [0.3, 0.3], [0.6, 0.2], [1, 0.72]], 0, 0.5));
  P.save();
  P.clip(r);
  P.rect(x - s * 0.5, ny + s * 0.38, s, s, col, P.lg(0, ny + s * 0.38, 0, ny + s * 0.9, [[0, 0.1], [1, 0.45]], 0.5, 0.5));
  for (let k = 0; k < 4; k++) P.rect(x - s * 0.5, ny + s * (0.45 + k * 0.08), s, s * 0.014, C.INK, sh(1));
  for (const fx of [-0.22, -0.08, 0.1, 0.24]) {
    const p = new Path2D();
    p.moveTo(x + s * fx * 0.6, ny + s * 0.1);
    p.quadraticCurveTo(x + s * fx, ny + s * 0.4, x + s * fx * 1.15, ny + s * 0.9);
    P.stroke(p, C.INK, sh(1), 1.8);
  }
  P.restore();
  P.stroke(r, C.INK, sh(1), 3);
  P.rect(x - s * 0.035, ny - s * 0.07, s * 0.07, s * 0.09, C.SKIN, sh(0.5, 0, 0.3));
  const hy = ny - s * 0.17;
  const head = path.ellipse(x, hy, s * 0.074, s * 0.1);
  P.fill(head, C.SKIN, P.lg(x - s * 0.074, 0, x + s * 0.074, 0, [[0, 0.5], [0.5, 0.12], [1, 0.42]], 0, 0.3));
  P.stroke(head, C.INK, sh(1), 2.2);
  for (const sd of [-1, 1]) {
    const hp = path.poly([
      [x + sd * s * 0.085, hy - s * 0.05], [x + sd * s * 0.02, hy - s * 0.105], [x + sd * s * 0.058, hy + s * 0.0],
      [x + sd * s * 0.065, ny + s * 0.1], [x + sd * s * 0.15, ny + s * 0.13], [x + sd * s * 0.11, hy],
    ]);
    P.fill(hp, C.INK, sh(1));
    P.stroke(path.line(x + sd * s * 0.045, hy - s * 0.01, x + sd * s * 0.02, hy - s * 0.012), C.INK, sh(1), Math.max(1.5, s * 0.006));
    P.fill(path.circle(x + sd * s * 0.032, hy + s * 0.004, s * 0.006), col, sh(0.2));
  }
  const top = new Path2D();
  top.moveTo(x - s * 0.085, hy - s * 0.02);
  top.bezierCurveTo(x - s * 0.09, hy - s * 0.15, x + s * 0.09, hy - s * 0.15, x + s * 0.085, hy - s * 0.02);
  top.lineTo(x + s * 0.03, hy - s * 0.075);
  top.lineTo(x - s * 0.03, hy - s * 0.075);
  top.closePath();
  P.fill(top, C.INK, sh(1));
  P.stroke(path.line(x, hy + s * 0.005, x + s * 0.006, hy + s * 0.035), C.INK, sh(1), 1.6);
  P.stroke(path.line(x - s * 0.016, hy + s * 0.058, x + s * 0.016, hy + s * 0.058), C.INK, sh(1), 2);

  const sg = s * 0.15;
  const gx = x - s * 0.04 + sip * s * 0.02;
  const gy = lerp(ny + s * 0.1, hy + s * 0.02, sip);
  P.save();
  P.translate(gx, gy);
  P.rotate(sip * 0.5);
  const g = drawGlass(P, 0, 0, sg, lerp(0.75, 0.12, sip), col);
  chain(P, [[sg * 0.14, g.ay + sg * 0.45], [sg * 0.9, g.ay + sg * 1.6], [sg * 1.4, g.ay + sg * 3.2]], sg * 0.34, C.GOLD, 0.3, 0, 0.5);
  for (let j = 0; j < 3; j++) {
    const y = g.ay + sg * (0.22 + j * 0.13);
    chain(P, [[sg * 0.16, y], [-sg * 0.07, y + sg * 0.02]], sg * 0.1, C.SKIN, 0.2);
  }
  P.restore();
}

function drink(P, t, S) {
  const { w: W, h: H, time } = S;
  const u = Math.min(W, H);
  const port = H > W;
  bg(P, S, C.RED, P.lg(0, 0, 0, H, [[0, 0.1], [1, 0.03]], 0, 0.3));
  const cw = u * 0.34;
  drawColumn(P, port ? W * 0.06 : W * 0.18, H * 0.05, H + cw, cw, C.PAPER, 0);
  const rise = easeOut(range(t, -0.25, 0.3));
  const s = Math.min(H * 0.95, W * (port ? 1.2 : 0.75));
  const bx = W * 0.6, ny = H * 0.42 + (1 - rise) * H * 0.75;
  const sip = ease(range(t, 0.3, 0.75));
  drawBust(P, bx, ny, s, flav(S), time, sip);
}

// ---------------------------------------------------------------- 8 · wide eyes
function eyes(P, t, S) {
  const { w: W, h: H, time } = S;
  const u = Math.min(W, H);
  const port = H > W;
  const shake = range(t, 0.3, 1) * u * 0.006;
  P.save();
  zoom(P, W / 2, H * 0.5, 1 + ease(clamp(t)) * 0.25);
  P.translate(Math.sin(time * 47) * shake, Math.cos(time * 39) * shake);
  bg(P, S, C.SKIN, P.lg(0, 0, 0, H, [[0, 0.55], [0.5, 0.28], [1, 0.45]], 0, 0.75));
  const r = port ? W * 0.19 : Math.min(W * 0.15, H * 0.27);
  const d = port ? W * 0.25 : r * 1.45;
  const cy = H * 0.54;
  const open = lerp(0.55, 1.1, easeOut(range(t, 0.05, 0.4)));
  const pupil = lerp(0.42, 0.2, range(t, 0.1, 0.5));
  for (const sd of [-1, 1]) drawEye(P, W / 2 + sd * d, cy, r, flav(S), open, 0, pupil, sd, 0.6 + open * 0.5);
  // nose bridge
  P.stroke(path.smooth([[W / 2 - r * 0.2, cy - r * 0.2], [W / 2 - r * 0.25, cy + r * 0.6], [W / 2 - r * 0.1, cy + r * 1.1]]), C.INK, sh(1), Math.max(2, r * 0.035));
  // fringe
  const R = rng(21);
  const pts = [[-20, -20]];
  for (let x = -20; x <= W + 40; x += Math.max(14, W / 40)) {
    pts.push([x, H * (0.16 + R() * 0.08) - cy * 0.0]);
    pts.push([x + W / 80, H * (0.08 + R() * 0.05)]);
  }
  pts.push([W + 40, -20]);
  P.fill(path.poly(pts), C.INK, sh(1));
  for (let i = 0; i < 26; i++) {
    const x = R() * W;
    P.stroke(path.line(x, 0, x + (R() - 0.5) * 20, H * (0.05 + R() * 0.12)), '#3b3636', sh(0.7, 0, 0.6), 1.4);
  }
  P.restore();
}

// ---------------------------------------------------------------- 9 · hold – the dive
function dive(P, t, S) {
  const { w: W, h: H, time } = S;
  const u = Math.min(W, H);
  const b = S.boost;
  const col = flav(S);
  bg(P, S, C.INK, sh(1));
  const cx = W / 2, cy = H * 0.5;
  const R = rng(Math.floor(time * 8) + 1);
  const pts = [];
  const n = 60;
  const rx = W * 0.46 * (1 + b * 0.1), ry = H * 0.4 * (1 + b * 0.1);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const k = i % 2 ? 0.76 + R() * 0.12 : 1 + R() * 0.2;
    pts.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k]);
  }
  const burst = path.poly(pts);
  P.fill(burst, C.PAPER, sh(0.03, 0.4, 0.4));
  const ang = 0.38, ux = Math.cos(ang), uy = Math.sin(ang);
  const speed = 380 * (1 + b * 3);
  const span = W * 1.6;
  P.save();
  P.clip(burst);
  const R2 = rng(17);
  for (let i = 0; i < 80; i++) {
    const len = u * (0.05 + R2() * 0.28);
    const x0 = ((R2() * span + time * speed * (0.5 + R2())) % span) - W * 0.3;
    const y0 = R2() * H * 1.2 - H * 0.3 + x0 * uy * 0.3;
    P.stroke(path.line(x0, y0, x0 - ux * len, y0 - uy * len), C.INK, sh(1), 0.8 + R2() * 2.4);
  }
  P.restore();
  for (let i = 0; i < 40; i++) {
    const len = u * (0.04 + R2() * 0.18);
    const x0 = ((R2() * span + time * speed * 1.4 * (0.5 + R2())) % span) - W * 0.3;
    const y0 = R2() * H;
    if (Math.abs(x0 - cx) < rx * 0.7 && Math.abs(y0 - cy) < ry * 0.7) continue;
    P.stroke(path.line(x0, y0, x0 - ux * len, y0 - uy * len), C.WHITE, sh(0), 0.8 + R2() * 1.8);
  }
  const p = ease(range(t, 0, 0.85));
  const dx = lerp(W * 0.05, W * 0.6, p), dy = lerp(-H * 0.1, H * 0.6, p);
  const jit = b * u * 0.005;
  const R3 = rng(5);
  const cnt = Math.round(24 + b * 40);
  for (let i = 0; i < cnt; i++) {
    const life = (time * (0.6 + b) + R3()) % 1;
    const sx = dx - ux * life * u * (0.3 + R3() * 0.5) + (R3() - 0.5) * u * 0.12;
    const sy = dy - uy * life * u * (0.3 + R3() * 0.5) + (R3() - 0.5) * u * 0.12;
    const d = path.ellipse(sx, sy, (1 - life) * u * 0.012 + 1, (1 - life) * u * 0.007 + 1, ang);
    P.fill(d, col, sh(0.1));
    P.stroke(d, C.INK, sh(1), 1.2);
  }
  drawDiver(P, dx + Math.sin(time * 50) * jit, dy + Math.cos(time * 43) * jit, u / 470, col, time * (1 + b * 2));
}

// ---------------------------------------------------------------- 10 · shattering columns
function shatter(P, t, S) {
  const { w: W, h: H, time } = S;
  const u = Math.min(W, H);
  const port = H > W;
  bg(P, S, C.RED, P.lg(0, 0, 0, H, [[0, 0.5], [0.5, 0.16], [1, 0.08]], 0.5, 0.4));
  const sep = ease(range(t, 0.35, 1));
  const cols = port ? [[0.22, 0.55], [0.76, 0.5]] : [[0.2, 0.5], [0.5, 0.56], [0.8, 0.48]];
  const len = Math.hypot(W, H) * 0.95, cw = u * (port ? 0.22 : 0.17);
  cols.forEach(([fx, fy], ci) => {
    const cx = W * fx, cy = H * fy, rot = -0.42 + ci * 0.07;
    for (let j = 0; j < 3; j++) {
      const a0 = -len / 2 + (j * len) / 3, a1 = a0 + len / 3;
      const R = rng(ci * 10 + j + 1);
      const band = [];
      band.push([-cw * 1.2, a0]);
      for (let q = 1; q < 6; q++) band.push([-cw * 1.2 + (q / 6) * cw * 2.4, a0 + (R() - 0.5) * cw * 0.5 * (j > 0)]);
      band.push([cw * 1.2, a0]);
      band.push([cw * 1.2, a1]);
      for (let q = 5; q > 0; q--) band.push([-cw * 1.2 + (q / 6) * cw * 2.4, a1 + (R() - 0.5) * cw * 0.5 * (j < 2)]);
      band.push([-cw * 1.2, a1]);
      const bp = path.poly(band);
      const tr = () => {
        P.translate(cx, cy);
        P.rotate(rot);
        P.translate(sep * cw * (j - 1) * 0.6 * (ci % 2 ? 1 : -1), -sep * H * (0.25 + j * 0.25));
        P.rotate(sep * (j - 1) * 0.3 * (ci % 2 ? -1 : 1));
      };
      P.save();
      tr();
      P.clip(bp);
      drawColumn(P, 0, -len / 2, len / 2, cw, C.PAPER, 0);
      for (let q = 0; q < 3; q++) {
        const y = a0 + R() * (a1 - a0);
        P.stroke(path.poly([[-cw * 0.5, y], [-cw * 0.1, y + cw * 0.15], [cw * 0.15, y - cw * 0.05], [cw * 0.5, y + cw * 0.1]], false), C.INK, sh(1), 2);
      }
      P.restore();
      if (sep > 0.01) {
        P.save();
        tr();
        P.stroke(path.poly(band.slice(0, 7), false), C.INK, sh(1), 2.5);
        P.stroke(path.poly(band.slice(7), false), C.INK, sh(1), 2.5);
        P.restore();
      }
    }
  });
  const R = rng(77);
  for (let i = 0; i < 26; i++) {
    const x = R() * W, y0 = R() * H * 1.3;
    const y = y0 - sep * H * (0.4 + R() * 0.8);
    drawShard(P, x, y, u * (0.01 + R() * 0.03), time * (R() - 0.5) * 2 + i, 100 + i);
  }
  const ins = 1 - ease(range(t, 0.2, 0.5));
  if (ins > 0) {
    const pw = W * (port ? 0.42 : 0.24), ph = H * 0.3;
    const pxx = W * 0.04, pyy = H * 0.07 - (1 - ins) * H * 0.5;
    const pp = path.rect(pxx, pyy, pw, ph);
    P.fill(pp, C.PAPER, sh(0.35, 0, 0.8));
    P.save();
    P.clip(pp);
    drawFlowingRobeFigure(P, pxx + pw * 0.35, pyy + ph * 1.05 + Math.sin(time * 2) * ph * 0.02, ph * 1.1, flav(S), time);
    P.restore();
    P.stroke(pp, C.INK, sh(1), 4);
  }
}

// ---------------------------------------------------------------- 11 · title
function titleLine(P, str, x, y, fs, maxW) {
  let font = `900 ${fs}px "Cinzel Decorative", serif`;
  P.c.font = font;
  const mw = P.c.measureText(str).width;
  if (mw > maxW) {
    fs *= maxW / mw;
    font = `900 ${fs}px "Cinzel Decorative", serif`;
  }
  for (let d = 7; d >= 1; d--) textBoth(P, str, x + d * fs * 0.008, y + d * fs * 0.01, font, C.INK, sh(1));
  textBoth(P, str, x, y, font, C.WHITE, P.lg(0, y - fs * 0.75, 0, y, [[0, 0.04], [0.6, 0.16], [1, 0.42]], 0.5, 0.3));
  return fs;
}

function title(P, t, S) {
  const { w: W, h: H, L, time } = S;
  const u = Math.min(W, H);
  bg(P, S, C.RED, P.lg(0, 0, 0, H, [[0, 0.12], [1, 0.04]], 0.5, 0.3));
  const y0 = H * 0.5 + lerp(H * 0.14, -H * 0.1, clamp(t));
  const fs2 = Math.min(W * 0.17, H * 0.22);
  const out = ease(range(t, 0, 1));
  const R = rng(55);
  const shards = [];
  for (let i = 0; i < 12; i++) {
    const a = R() * Math.PI * 2;
    const d0 = u * (0.25 + R() * 0.3);
    const d = d0 + out * u * (0.4 + R() * 0.5);
    shards.push([W / 2 + Math.cos(a) * d * (W / u) * 0.6, y0 - fs2 * 0.3 + Math.sin(a) * d * 0.7 - out * H * 0.2,
      u * (0.03 + R() * 0.06), a + time * (R() - 0.5), 200 + i, R() < 0.8]);
  }
  for (const s of shards) if (s[5]) drawShard(P, s[0], s[1], s[2], s[3], s[4]);
  const maxW = W * 0.84;
  titleLine(P, 'THE', W / 2, y0 - fs2 * 0.95, fs2 * 0.3, maxW);
  const f2 = titleLine(P, 'VESPERO', W / 2, y0, fs2, maxW);
  titleLine(P, 'EXPERIENCE', W / 2, y0 + f2 * 0.82, fs2 * 0.72, maxW);
  for (const s of shards) if (!s[5]) drawShard(P, s[0], s[1], s[2], s[3], s[4]);
  for (let i = 0; i < 30; i++) {
    const x = R() * W, y = R() * H - out * H * 0.3;
    P.stroke(path.line(x, y, x + 6, y - 12), C.WHITE, sh(0), 2);
  }
  const rr = ease(range(t, 0.55, 1));
  if (rr > 0) P.layer(L.colonnade, 0, H - rr * H * 0.65, W, H * 0.7);
}

// ---------------------------------------------------------------- 12 · finale
function finale(P, t, S) {
  const { w: W, h: H, L, time } = S;
  bg(P, S, C.RED, P.lg(0, 0, 0, H, [[0, 0.35], [1, 0.08]], 0.5, 0.4));
  const lift = (1 - easeOut(range(t, -0.3, 0.2))) * H * 0.3;
  P.layer(L.colonnade, 0, H * 0.28 + lift, W, H * 0.7);
  const floor = path.rect(-4, H * 0.9 + lift, W + 8, H);
  P.fill(floor, C.PAPER, P.lg(0, H * 0.9, 0, H, [[0, 0.5], [1, 0.15]], 0.5, 0.9));
  P.stroke(path.line(0, H * 0.9 + lift, W, H * 0.9 + lift), C.INK, sh(1), 3);
  const p = ease(range(t, 0, 0.85));
  const fh = lerp(H * 1.15, H * 0.42, p);
  drawFlowingRobeFigure(P, W * 0.46, lerp(H * 1.2, H * 0.92, p), fh, flav(S), time);
}

// ---------------------------------------------------------------- timeline
export const SCENES = [
  { id: 'hero', len: 1.7, mode: 'move', draw: hero,
    caps: [[-1, 0.5, 'tl', 'Hesitantly, the hand reaches forward — something sleeps beneath the wood.']] },
  { id: 'window', len: 1.7, enter: 'up', draw: windowScene,
    caps: [[0.05, 0.5, 'br', 'Through the round window, a silhouette stands against the crimson wind.']] },
  { id: 'forest', len: 1.3, enter: 'iris', irisY: 0.6, draw: forest,
    caps: [[0.05, 0.55, 'tl', 'Beyond it, the forest swallows every sound.']] },
  { id: 'hall', len: 2.0, enter: 'up', draw: hall,
    caps: [[0.08, 0.32, 'br', 'The hall burns red. A thousand columns hold their breath, watching.'],
      [0.74, 1, 'tl', 'The saint walks on, towards three small lights at the end of the hall.']] },
  { id: 'approach', len: 1.5, enter: 'up', draw: approach,
    caps: [[0.12, 0.85, 'br', 'Three Vespero bottles rest on the pedestal, each humming a different evening.']] },
  { id: 'bottles', len: 1.5, enter: 'down', mode: 'choose', draw: bottles,
    caps: [[0.15, 1, 'bl', '@flavor']] },
  { id: 'pour', len: 1.8, enter: 'up', mode: 'pour', draw: pour,
    caps: [[0.08, 0.6, 'tl', 'Pour slowly. The evening begins with a single drop.'], [0, 1, 'br', '@full']] },
  { id: 'drink', len: 1.3, enter: 'left', draw: drink,
    caps: [[0.2, 0.85, 'tr', 'One sip — and the world quietly tilts.']] },
  { id: 'eyes', len: 0.9, enter: 'down', draw: eyes, caps: [] },
  { id: 'dive', len: 1.8, enter: 'up', mode: 'hold', draw: dive,
    caps: [[0.08, 0.6, 'tl', 'Weightless, the saint dives through the light.']] },
  { id: 'shatter', len: 1.6, enter: 'up', draw: shatter,
    caps: [[-0.1, 0.32, 'bc', 'The saint gently floats back to the floor, one foot after the other, the robe still trembling.'],
      [0.42, 0.95, 'br', 'A sudden roar of shattering stone fills the air. The columns break apart and lift away, revealing a deep red sky.']] },
  { id: 'title', len: 1.5, enter: 'down', draw: title, caps: [] },
  { id: 'finale', len: 1.6, enter: 'up', draw: finale,
    caps: [[0.08, 0.55, 'tl', 'And the evening opens its doors.']] },
];
