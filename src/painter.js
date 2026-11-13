// Painter draws every shape twice:
//  - into a COLOR canvas (flat base colours)
//  - into a SHADE canvas whose channels drive the engraving shader:
//      R = ink darkness (0 = no lines, 1 = solid ink)
//      G = line angle   (0 = vertical lines, 0.5 = horizontal)
//      B = wobble       (0 = ruler straight, 1 = hand-drawn wavy)

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

export class Painter {
  constructor(k = 0.5) {
    this.k = k;
    this.cc = document.createElement('canvas');
    this.sc = document.createElement('canvas');
    this.c = this.cc.getContext('2d');
    this.s = this.sc.getContext('2d');
    this.w = 1;
    this.h = 1;
  }

  static sh(d, a = 0, b = 0.5) {
    return `rgb(${Math.round(clamp01(d) * 255)},${Math.round(clamp01(a) * 255)},${Math.round(clamp01(b) * 255)})`;
  }

  resize(w, h, k = this.k) {
    this.k = k;
    this.w = w;
    this.h = h;
    this.cc.width = this.sc.width = Math.max(1, Math.round(w * k));
    this.cc.height = this.sc.height = Math.max(1, Math.round(h * k));
  }

  // bg === null -> transparent layer
  begin(bg = '#ffffff', shade = Painter.sh(0)) {
    for (const x of [this.c, this.s]) {
      x.setTransform(1, 0, 0, 1, 0, 0);
      x.globalAlpha = 1;
      x.globalCompositeOperation = 'source-over';
      x.clearRect(0, 0, this.cc.width, this.cc.height);
    }
    if (bg !== null) {
      this.c.fillStyle = bg;
      this.c.fillRect(0, 0, this.cc.width, this.cc.height);
      this.s.fillStyle = shade;
      this.s.fillRect(0, 0, this.sc.width, this.sc.height);
    }
    this.c.setTransform(this.k, 0, 0, this.k, 0, 0);
    this.s.setTransform(this.k, 0, 0, this.k, 0, 0);
  }

  save() { this.c.save(); this.s.save(); }
  restore() { this.c.restore(); this.s.restore(); }
  translate(x, y) { this.c.translate(x, y); this.s.translate(x, y); }
  rotate(r) { this.c.rotate(r); this.s.rotate(r); }
  scale(x, y = x) { this.c.scale(x, y); this.s.scale(x, y); }
  alpha(a) { this.c.globalAlpha = a; this.s.globalAlpha = a; }
  clip(path) { this.c.clip(path); this.s.clip(path); }

  fill(path, color, shade) {
    this.c.fillStyle = color;
    this.c.fill(path);
    this.s.fillStyle = shade;
    this.s.fill(path);
  }

  fillShade(path, shade) {
    this.s.fillStyle = shade;
    this.s.fill(path);
  }

  rect(x, y, w, h, color, shade) {
    const p = new Path2D();
    p.rect(x, y, w, h);
    this.fill(p, color, shade);
    return p;
  }

  stroke(path, color, shade, width, cap = 'round') {
    for (const [x, st] of [[this.c, color], [this.s, shade]]) {
      x.lineWidth = width;
      x.lineCap = cap;
      x.lineJoin = 'round';
      x.strokeStyle = st;
      x.stroke(path);
    }
  }

  // shade gradients (created on the shade context)
  lg(x0, y0, x1, y1, stops, a = 0, b = 0.5) {
    const g = this.s.createLinearGradient(x0, y0, x1, y1);
    for (const [t, d] of stops) g.addColorStop(t, Painter.sh(d, a, b));
    return g;
  }

  rg(x, y, r0, r1, stops, a = 0, b = 0.5) {
    const g = this.s.createRadialGradient(x, y, r0, x, y, r1);
    for (const [t, d] of stops) g.addColorStop(t, Painter.sh(d, a, b));
    return g;
  }

  // colour gradients (created on the colour context)
  clg(x0, y0, x1, y1, stops) {
    const g = this.c.createLinearGradient(x0, y0, x1, y1);
    for (const [t, col] of stops) g.addColorStop(t, col);
    return g;
  }

  text(str, x, y, font, color, align = 'center') {
    this.c.font = font;
    this.c.textAlign = align;
    this.c.textBaseline = 'alphabetic';
    this.c.fillStyle = color;
    this.c.fillText(str, x, y);
  }

  // draw another painter (layer) in CSS coordinates
  layer(L, x = 0, y = 0, w = L.w, h = L.h) {
    this.c.drawImage(L.cc, x, y, w, h);
    this.s.drawImage(L.sc, x, y, w, h);
  }

  // blend a full-size painter on top with opacity a
  composite(other, a) {
    for (const [x, src] of [[this.c, other.cc], [this.s, other.sc]]) {
      x.save();
      x.setTransform(1, 0, 0, 1, 0, 0);
      x.globalAlpha = a;
      x.drawImage(src, 0, 0);
      x.restore();
    }
  }
}

// ---- Path helpers ----
export const path = {
  rect(x, y, w, h) { const p = new Path2D(); p.rect(x, y, w, h); return p; },
  circle(x, y, r) { const p = new Path2D(); p.arc(x, y, Math.max(0.01, r), 0, Math.PI * 2); return p; },
  ellipse(x, y, rx, ry, rot = 0) {
    const p = new Path2D();
    p.ellipse(x, y, Math.max(0.01, rx), Math.max(0.01, ry), rot, 0, Math.PI * 2);
    return p;
  },
  poly(pts, close = true) {
    const p = new Path2D();
    p.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) p.lineTo(pts[i][0], pts[i][1]);
    if (close) p.closePath();
    return p;
  },
  line(x0, y0, x1, y1) { const p = new Path2D(); p.moveTo(x0, y0); p.lineTo(x1, y1); return p; },
  rr(x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    const p = new Path2D();
    p.moveTo(x + r, y);
    p.arcTo(x + w, y, x + w, y + h, r);
    p.arcTo(x + w, y + h, x, y + h, r);
    p.arcTo(x, y + h, x, y, r);
    p.arcTo(x, y, x + w, y, r);
    p.closePath();
    return p;
  },
  // smooth curve through points (Catmull-Rom -> Bezier)
  smooth(pts, close = false) {
    const p = new Path2D();
    const n = pts.length;
    if (n < 2) return p;
    const get = (i) => (close ? pts[(i + n) % n] : pts[Math.max(0, Math.min(n - 1, i))]);
    p.moveTo(pts[0][0], pts[0][1]);
    const last = close ? n : n - 1;
    for (let i = 0; i < last; i++) {
      const p0 = get(i - 1), p1 = get(i), p2 = get(i + 1), p3 = get(i + 2);
      p.bezierCurveTo(
        p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6,
        p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6,
        p2[0], p2[1]
      );
    }
    if (close) p.closePath();
    return p;
  },
};
