// Physical paper: a WebGL2 mesh renderer for sheets that bend around a hinge (book covers,
// pages, pad sheets). Geometry is computed on the CPU every frame as a pure function of the
// sheet's parameters, projected with the shared camera, and shaded on the GPU with grazing
// light, a paper sheen along the bend and a darker crease. The 2D compositor draws the result.
import { project } from './camera.js';
import { H, W } from './tokens.js';

const VS = `#version 300 es
in vec3 aPos;
in vec3 aNrm;
in vec2 aUv;
in float aAo;
out vec2 vUv;
out vec3 vN;
out float vAo;
void main() {
  gl_Position = vec4(aPos, 1.0);
  vUv = aUv;
  vN = aNrm;
  vAo = aAo;
}`;

const FS = `#version 300 es
precision highp float;
uniform sampler2D uFront;
uniform sampler2D uBack;
uniform vec3 uLight;
uniform float uDiffuse;
uniform float uSpec;
uniform float uAo;
uniform float uAlpha;
uniform float uFrontSign;
uniform float uMirrorV;
in vec2 vUv;
in vec3 vN;
in float vAo;
out vec4 o;
void main() {
  vec3 n = normalize(vN);
  bool front = gl_FrontFacing == (uFrontSign > 0.0);
  vec4 c;
  if (front) {
    c = texture(uFront, vUv);
  } else {
    c = texture(uBack, uMirrorV > 0.5 ? vec2(vUv.x, 1.0 - vUv.y) : vec2(1.0 - vUv.x, vUv.y));
    n = -n;
  }
  vec3 l = normalize(uLight);
  float flatD = l.z;
  float d = dot(n, l);
  float shade = 1.0 + uDiffuse * (d - flatD);
  vec3 h = normalize(l + vec3(0.0, 0.0, 1.0));
  float sp = pow(max(dot(n, h), 0.0), 36.0) - pow(max(h.z, 0.0), 36.0);
  shade = clamp(shade, 0.58, 1.12);
  shade *= 1.0 - uAo * vAo;
  vec3 rgb = c.rgb * shade + uSpec * max(sp, 0.0) * c.a;
  o = vec4(rgb, c.a) * uAlpha;
}`;

function compile(gl, type, src) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
  return s;
}

export class Paper {
  constructor(width = W, height = H) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = width;
    this.canvas.height = height;
    const gl = this.canvas.getContext('webgl2', {
      antialias: true,
      alpha: true,
      premultipliedAlpha: true,
      preserveDrawingBuffer: true,
      depth: true,
    });
    if (!gl) throw new Error('WebGL2 unavailable');
    this.gl = gl;
    const prog = gl.createProgram();
    gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VS));
    gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FS));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
    this.prog = prog;
    this.loc = {
      aPos: gl.getAttribLocation(prog, 'aPos'),
      aNrm: gl.getAttribLocation(prog, 'aNrm'),
      aUv: gl.getAttribLocation(prog, 'aUv'),
      aAo: gl.getAttribLocation(prog, 'aAo'),
      uFront: gl.getUniformLocation(prog, 'uFront'),
      uBack: gl.getUniformLocation(prog, 'uBack'),
      uLight: gl.getUniformLocation(prog, 'uLight'),
      uDiffuse: gl.getUniformLocation(prog, 'uDiffuse'),
      uSpec: gl.getUniformLocation(prog, 'uSpec'),
      uAo: gl.getUniformLocation(prog, 'uAo'),
      uAlpha: gl.getUniformLocation(prog, 'uAlpha'),
      uFrontSign: gl.getUniformLocation(prog, 'uFrontSign'),
      uMirrorV: gl.getUniformLocation(prog, 'uMirrorV'),
    };
    this.buf = {
      pos: gl.createBuffer(),
      nrm: gl.createBuffer(),
      uv: gl.createBuffer(),
      ao: gl.createBuffer(),
      idx: gl.createBuffer(),
    };
    this.textures = new Map();
    this.indexFor = null;
    const aniso = gl.getExtension('EXT_texture_filter_anisotropic');
    this.aniso = aniso;
  }

  /** Uploads (or refreshes) a texture from a canvas. Premultiplied, mipmapped. */
  texture(id, source) {
    const gl = this.gl;
    let tex = this.textures.get(id);
    if (!tex) {
      tex = gl.createTexture();
      this.textures.set(id, tex);
    }
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    if (this.aniso) gl.texParameterf(gl.TEXTURE_2D, this.aniso.TEXTURE_MAX_ANISOTROPY_EXT, 8);
    return tex;
  }

  clear() {
    const gl = this.gl;
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clearDepth(1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  }

  ensureIndex(nx, ny) {
    const key = `${nx}x${ny}`;
    if (this.indexFor === key) return;
    const gl = this.gl;
    const idx = new Uint32Array((nx - 1) * (ny - 1) * 6);
    let k = 0;
    for (let j = 0; j < ny - 1; j++)
      for (let i = 0; i < nx - 1; i++) {
        const a = j * nx + i;
        const b = a + 1;
        const c = a + nx;
        const d = c + 1;
        idx[k++] = a;
        idx[k++] = c;
        idx[k++] = b;
        idx[k++] = b;
        idx[k++] = c;
        idx[k++] = d;
      }
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.buf.idx);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx, gl.STATIC_DRAW);
    this.indexFor = key;
    this.indexCount = idx.length;
  }

  /**
   * Draws a mesh produced by `hingeSheet`. `front`/`back` are texture ids.
   * Options: light [x,y,z], diffuse, spec, ao, alpha.
   */
  draw(
    mesh,
    { front, back, light = [-0.45, -0.7, 1], diffuse = 0.9, spec = 0.28, ao = 0.35, alpha = 1 },
  ) {
    const gl = this.gl;
    const L = this.loc;
    this.ensureIndex(mesh.nx, mesh.ny);
    gl.useProgram(this.prog);
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    const bind = (buffer, data, loc, size) => {
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW);
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0);
    };
    bind(this.buf.pos, mesh.clip, L.aPos, 3);
    bind(this.buf.nrm, mesh.nrm, L.aNrm, 3);
    bind(this.buf.uv, mesh.uv, L.aUv, 2);
    bind(this.buf.ao, mesh.ao, L.aAo, 1);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.textures.get(front));
    gl.uniform1i(L.uFront, 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.textures.get(back ?? front));
    gl.uniform1i(L.uBack, 1);
    gl.uniform3fv(L.uLight, light);
    gl.uniform1f(L.uDiffuse, diffuse);
    gl.uniform1f(L.uSpec, spec);
    gl.uniform1f(L.uAo, ao);
    gl.uniform1f(L.uAlpha, alpha);
    gl.uniform1f(L.uFrontSign, mesh.frontSign);
    gl.uniform1f(L.uMirrorV, mesh.mirrorV ? 1 : 0);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.buf.idx);
    gl.drawElements(gl.TRIANGLES, this.indexCount, gl.UNSIGNED_INT, 0);
  }
}

/**
 * A rectangular sheet hinged along one of its edges.
 *
 *   rect:   {x, y, w, h} rest rectangle on the z = 0 plane (world px)
 *   hinge:  'top' | 'left' | 'bottom' | 'right' — the bound edge
 *   angle:  (s, q) => radians. s = distance from the hinge as a fraction of the sheet depth
 *           (0 at the hinge, 1 at the free edge), q = position along the hinge (0..1).
 *           0 = lying flat, PI = folded over onto the other side, negative = away from viewer.
 *   cam:    camera used to project
 *
 * The angle field lets the free edge lag or lead and the corners curl at different speeds,
 * the non-linear bend that makes paper read as paper. Arc length along s is preserved.
 */
export function hingeSheet({ rect, hinge = 'top', angle, cam, nx = 48, ny = 72, lift = 0 }) {
  const count = nx * ny;
  const world = new Float32Array(count * 3);
  const nrm = new Float32Array(count * 3);
  const uv = new Float32Array(count * 2);
  const ao = new Float32Array(count);
  const clip = new Float32Array(count * 3);
  // Unit vectors: along the hinge (q) and into the sheet (s), in world xy.
  let origin;
  let qv;
  let sv;
  let depth;
  let span;
  if (hinge === 'top') {
    origin = [rect.x, rect.y];
    qv = [1, 0];
    sv = [0, 1];
    depth = rect.h;
    span = rect.w;
  } else if (hinge === 'bottom') {
    origin = [rect.x, rect.y + rect.h];
    qv = [1, 0];
    sv = [0, -1];
    depth = rect.h;
    span = rect.w;
  } else if (hinge === 'left') {
    origin = [rect.x, rect.y];
    qv = [0, 1];
    sv = [1, 0];
    depth = rect.w;
    span = rect.h;
  } else {
    origin = [rect.x + rect.w, rect.y];
    qv = [0, 1];
    sv = [-1, 0];
    depth = rect.w;
    span = rect.h;
  }
  // Grid: i runs along q (hinge), j runs along s (depth). Integrate the bend along s.
  const steps = (hinge === 'top' || hinge === 'bottom' ? ny : nx) - 1;
  const along = hinge === 'top' || hinge === 'bottom' ? nx : ny;
  const ds = depth / steps;
  for (let a = 0; a < along; a++) {
    const q = a / (along - 1);
    let ys = 0;
    let zs = lift;
    let prev = angle(0, q);
    for (let b = 0; b <= steps; b++) {
      const s = b / steps;
      const ang = angle(s, q);
      if (b > 0) {
        // Midpoint rule keeps the arc length exact enough at 70+ steps.
        const mid = (prev + ang) / 2;
        ys += Math.cos(mid) * ds;
        zs += Math.sin(mid) * ds;
      }
      prev = ang;
      const px = origin[0] + qv[0] * q * span + sv[0] * ys;
      const py = origin[1] + qv[1] * q * span + sv[1] * ys;
      // Map (a, b) back to grid (i, j) in texture space.
      let i;
      let j;
      if (hinge === 'top') {
        i = a;
        j = b;
      } else if (hinge === 'bottom') {
        i = a;
        j = ny - 1 - b;
      } else if (hinge === 'left') {
        i = b;
        j = a;
      } else {
        i = nx - 1 - b;
        j = a;
      }
      const k = j * nx + i;
      world[k * 3] = px;
      world[k * 3 + 1] = py;
      world[k * 3 + 2] = zs;
      // Normal of the face that pointed at the viewer at rest.
      const n0 = -Math.sin(ang);
      const nz = Math.cos(ang);
      nrm[k * 3] = sv[0] * n0;
      nrm[k * 3 + 1] = sv[1] * n0;
      nrm[k * 3 + 2] = nz;
      uv[k * 2] = i / (nx - 1);
      uv[k * 2 + 1] = j / (ny - 1);
      // Crease darkness grows near the hinge as the sheet closes.
      ao[k] = Math.max(0, Math.sin(Math.min(Math.abs(ang), Math.PI))) * Math.exp(-s * 6);
    }
  }
  let zmax = 0;
  for (let k = 0; k < count; k++) {
    const p = project(cam, world[k * 3], world[k * 3 + 1], world[k * 3 + 2]);
    clip[k * 3] = (p.x / W) * 2 - 1;
    clip[k * 3 + 1] = 1 - (p.y / H) * 2;
    clip[k * 3 + 2] = Math.max(-1, Math.min(1, -world[k * 3 + 2] / 6000));
    if (world[k * 3 + 2] > zmax) zmax = world[k * 3 + 2];
  }
  // At rest every grid is counter-clockwise on screen, so the front face is GL's front face.
  // Sheets turning over a horizontal hinge show their back upside down: mirror v, else u.
  const mirrorV = hinge === 'top' || hinge === 'bottom';
  return { nx, ny, world, nrm, uv, ao, clip, cam, zmax, frontSign: 1, mirrorV };
}

/**
 * Soft shadow of a sheet on the z = 0 plane, drawn into a 2D context (screen space).
 * Light comes from `light` (towards the light); higher parts cast longer, softer shadows.
 */
export function drawSheetShadow(
  g,
  mesh,
  { light = [-0.45, -0.7, 1], color = 'rgba(33,21,47,', strength = 0.32, blur = 26 } = {},
) {
  const { nx, ny, world, cam, zmax } = mesh;
  if (zmax < 1) return;
  const lx = light[0] / light[2];
  const ly = light[1] / light[2];
  const ring = [];
  for (let i = 0; i < nx; i++) ring.push(i);
  for (let j = 1; j < ny; j++) ring.push(j * nx + nx - 1);
  for (let i = nx - 2; i >= 0; i--) ring.push((ny - 1) * nx + i);
  for (let j = ny - 2; j > 0; j--) ring.push(j * nx);
  g.save();
  g.filter = `blur(${Math.round(blur + Math.min(zmax, 900) * 0.05)}px)`;
  g.fillStyle = `${color}${Math.min(strength, strength * (0.4 + zmax / 400))})`;
  g.beginPath();
  ring.forEach((k, n) => {
    const z = world[k * 3 + 2];
    const p = project(cam, world[k * 3] - lx * z, world[k * 3 + 1] - ly * z, 0);
    if (n === 0) g.moveTo(p.x, p.y);
    else g.lineTo(p.x, p.y);
  });
  g.closePath();
  g.fill();
  g.restore();
}
