// One camera model for the 2D compositor and the WebGL paper. A camera looks at world point
// (x, y) on the z = 0 plane with a zoom and a roll; points above the plane (z > 0, towards the
// viewer) grow with a pinhole perspective of focal length f (in master pixels).
import { H, W } from './tokens.js';

export function cam(x = W / 2, y = H / 2, zoom = 1, rot = 0, f = 2000) {
  return { x, y, zoom, rot, f };
}

/** Applies the camera's z = 0 transform to a 2D context. */
export function applyCam(g, c, depth = 1) {
  // depth < 1: layer further away (parallax), > 1: closer.
  const z = c.zoom * depth;
  g.translate(W / 2, H / 2);
  g.rotate(c.rot);
  g.scale(z, z);
  g.translate(-c.x, -c.y);
}

/** World (x, y, z) → screen {x, y, s} with s the perspective scale at that depth. */
export function project(c, x, y, z = 0) {
  const dx = (x - c.x) * c.zoom;
  const dy = (y - c.y) * c.zoom;
  const cs = Math.cos(c.rot);
  const sn = Math.sin(c.rot);
  const rx = dx * cs - dy * sn;
  const ry = dx * sn + dy * cs;
  const zz = z * c.zoom;
  const s = c.f / Math.max(c.f - zz, c.f * 0.05);
  return { x: W / 2 + rx * s, y: H / 2 + ry * s, s };
}

export function mixCam(a, b, k) {
  return {
    x: a.x + (b.x - a.x) * k,
    y: a.y + (b.y - a.y) * k,
    // Zoom interpolates in log space so a push feels constant in speed.
    zoom: Math.exp(Math.log(a.zoom) + (Math.log(b.zoom) - Math.log(a.zoom)) * k),
    rot: a.rot + (b.rot - a.rot) * k,
    f: a.f + (b.f - a.f) * k,
  };
}
