import type { MagnitudeScale } from './types';

/**
 * Creates a MagnitudeScale instance with clamped linear mapping
 * from magnitude to screen-projected radius in pixels.
 *
 * Magnitudes are clamped to [minMag, maxMag] before interpolation.
 * The resulting radius is in screen-projected pixels.
 */
export function createMagnitudeScale(
  minMag = 0,
  maxMag = 4,
  minRadius = 2,
  maxRadius = 16
): MagnitudeScale {
  return {
    minMag,
    maxMag,
    minRadius,
    maxRadius,
    toRadius(magnitude: number): number {
      // Clamp magnitude to [minMag, maxMag]
      const clamped = Math.max(minMag, Math.min(maxMag, magnitude));
      // Linear interpolation between minRadius and maxRadius
      const t = (clamped - minMag) / (maxMag - minMag);
      return minRadius + t * (maxRadius - minRadius);
    },
  };
}

/**
 * Converts a screen-projected pixel radius to a world-space radius,
 * given the camera's vertical FOV (in radians), the distance from the
 * camera to the object, and the viewport height in pixels.
 *
 * This allows consistent apparent size regardless of camera distance.
 *
 * Formula: worldRadius = (screenPx / viewportHeight) * 2 * distance * tan(fov/2)
 */
export function screenPxToWorldRadius(
  screenPx: number,
  cameraDistance: number,
  fovRadians: number,
  viewportHeight: number
): number {
  const visibleHeight = 2 * cameraDistance * Math.tan(fovRadians / 2);
  return (screenPx / viewportHeight) * visibleHeight;
}
