// Replacement animation needs discrete choices per frame. While a motion-blurred frame averages
// sub-frames spread over the shutter, poses (and other on/off decisions) are taken at the frame's
// own time, so a pose swap is a clean cut instead of two poses ghosted on top of each other.
let frameTime = null;

/** Set by the render contract before drawing the sub-frames of frame t (and by seek). */
export function setFrameTime(t) {
  frameTime = t;
}

/** Time to use for discrete decisions (which pose): the frame's time when known. */
export function poseT(t) {
  return frameTime ?? t;
}
