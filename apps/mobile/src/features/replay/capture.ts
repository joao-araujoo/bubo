/** Draw at full export resolution before snapshotting, even on a 1x/2x device. */
export function storyCaptureGeometry(density: number) {
  const ratio = Number.isFinite(density) && density > 0 ? density : 1;
  return { sourceWidth: 1080 / ratio, sourceHeight: 1920 / ratio, artScale: 3 / ratio };
}

/** iOS uses points followed by the renderer's device scale; Android expects output pixels. */
export function storyCaptureOptions(platform: string, density: number) {
  const geometry = storyCaptureGeometry(density);
  return {
    format: 'png' as const,
    result: 'tmpfile' as const,
    width: platform === 'ios' ? geometry.sourceWidth : 1080,
    height: platform === 'ios' ? geometry.sourceHeight : 1920,
  };
}
