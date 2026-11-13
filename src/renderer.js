// WebGL2 "engraving" renderer: turns the colour + shade canvases into
// hand-drawn line hatching (thick lines = dark, thin lines = light).

const VERT = `#version 300 es
in vec2 aPos;
void main(){ gl_Position = vec4(aPos, 0.0, 1.0); }`;

const FRAG = `#version 300 es
precision highp float;
uniform sampler2D uColor;
uniform sampler2D uShade;
uniform vec2 uRes;
uniform float uDpr;
uniform float uTime;
uniform float uSpacing;
out vec4 outColor;

float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}

void main(){
  vec2 uv = vec2(gl_FragCoord.x / uRes.x, 1.0 - gl_FragCoord.y / uRes.y);
  vec3 base = texture(uColor, uv).rgb;
  vec3 sh = texture(uShade, uv).rgb;
  float dark = sh.r;
  float ang = sh.g * 3.14159265;
  float wob = sh.b;

  vec2 p = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y) / uDpr;
  vec2 dir = vec2(cos(ang), sin(ang));
  vec2 tng = vec2(-dir.y, dir.x);
  float c = dot(p, dir);
  float a = dot(p, tng);

  // "boiling" hand-drawn animation: noise is re-seeded 8 times a second
  float boil = floor(uTime * 8.0);
  c += wob * ((noise(vec2(a * 0.006, c * 0.004)) - 0.5) * 26.0
            + (noise(vec2(a * 0.045 + boil * 3.17, c * 0.02)) - 0.5) * 2.6);

  float idx = floor(c / uSpacing);
  float f = fract(c / uSpacing);
  float d0 = abs(f - 0.5) * 2.0;

  float jit = (noise(vec2(a * 0.035 + boil * 0.7, idx * 7.31)) - 0.5) * 0.5 * wob;
  float w = clamp(dark + jit * dark * (1.0 - dark) * 2.0, 0.0, 1.0);
  float aa = clamp(fwidth(c / uSpacing) * 2.0, 0.03, 0.5);
  float ink = smoothstep(1.0 - w - aa, 1.0 - w + aa, d0);
  if (dark < 0.012) ink = 0.0;
  if (dark > 0.985) ink = 1.0;

  vec3 inkC = vec3(0.066, 0.058, 0.058);
  vec3 col = mix(base, inkC, ink);
  col += (hash(gl_FragCoord.xy + boil) - 0.5) * 0.035;   // paper grain
  outColor = vec4(col, 1.0);
}`;

export class Renderer {
  constructor(canvas) {
    this.cv = canvas;
    const gl = canvas.getContext('webgl2', { antialias: false, premultipliedAlpha: false, alpha: false });
    if (!gl) {
      this.fallback = true;
      this.ctx = canvas.getContext('2d');
      return;
    }
    this.gl = gl;
    const prog = gl.createProgram();
    for (const [type, src] of [[gl.VERTEX_SHADER, VERT], [gl.FRAGMENT_SHADER, FRAG]]) {
      const sh = gl.createShader(type);
      gl.shaderSource(sh, src);
      gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh));
      gl.attachShader(prog, sh);
    }
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
    gl.useProgram(prog);
    this.prog = prog;

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'aPos');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    this.tex = [0, 1].map((i) => {
      const t = gl.createTexture();
      gl.activeTexture(gl.TEXTURE0 + i);
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      return t;
    });
    gl.uniform1i(gl.getUniformLocation(prog, 'uColor'), 0);
    gl.uniform1i(gl.getUniformLocation(prog, 'uShade'), 1);
    this.u = {
      res: gl.getUniformLocation(prog, 'uRes'),
      dpr: gl.getUniformLocation(prog, 'uDpr'),
      time: gl.getUniformLocation(prog, 'uTime'),
      spacing: gl.getUniformLocation(prog, 'uSpacing'),
    };
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  }

  resize(w, h, dpr) {
    this.dpr = dpr;
    this.cv.width = Math.round(w * dpr);
    this.cv.height = Math.round(h * dpr);
    this.cv.style.width = w + 'px';
    this.cv.style.height = h + 'px';
    this.spacing = w < 700 ? 3.4 : 4.2;
    if (this.gl) this.gl.viewport(0, 0, this.cv.width, this.cv.height);
  }

  draw(colorCanvas, shadeCanvas, time) {
    if (this.fallback) {
      this.ctx.drawImage(colorCanvas, 0, 0, this.cv.width, this.cv.height);
      return;
    }
    const gl = this.gl;
    [colorCanvas, shadeCanvas].forEach((src, i) => {
      gl.activeTexture(gl.TEXTURE0 + i);
      gl.bindTexture(gl.TEXTURE_2D, this.tex[i]);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
    });
    gl.uniform2f(this.u.res, this.cv.width, this.cv.height);
    gl.uniform1f(this.u.dpr, this.dpr);
    gl.uniform1f(this.u.time, time);
    gl.uniform1f(this.u.spacing, this.spacing);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
}
