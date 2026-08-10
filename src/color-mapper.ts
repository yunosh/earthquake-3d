import * as THREE from 'three';
import type { ColorMapping } from './types';

/**
 * HSL values for the "fresh" color (#FF4500, bright orange-red).
 * RGB(255, 69, 0) → HSL(16.24°, 100%, 50%)
 */
const FRESH_HSL = { h: 16.24 / 360, s: 1.0, l: 0.5 };

/**
 * HSL values for the "faded" color (#4A6080, muted blue-grey).
 * RGB(74, 96, 128) → HSL(215.6°, 26.7%, 39.6%)
 */
const FADED_HSL = { h: 215.6 / 360, s: 0.267, l: 0.396 };

/**
 * Creates a ColorMapping that interpolates between fresh (#FF4500) and
 * faded (#4A6080) based on event age.
 *
 * - age = 0.0: fresh color (bright orange-red)
 * - age = 1.0: faded color (muted blue-grey)
 *
 * The interpolation is HSL-based:
 * - Hue transitions from orange → blue
 * - Saturation decreases
 * - Lightness decreases
 */
export function createColorMapping(): ColorMapping {
  return {
    interpolate(age: number): { h: number; s: number; l: number } {
      // Clamp age to [0, 1]
      const t = Math.max(0, Math.min(1, age));

      const h = FRESH_HSL.h + t * (FADED_HSL.h - FRESH_HSL.h);
      const s = FRESH_HSL.s + t * (FADED_HSL.s - FRESH_HSL.s);
      const l = FRESH_HSL.l + t * (FADED_HSL.l - FRESH_HSL.l);

      return { h, s, l };
    },
  };
}

/**
 * Convenience helper that returns a THREE.Color for a given age.
 * Useful in the renderer where Three.js color objects are needed.
 *
 * @param age - Event age from 0.0 (fresh) to 1.0 (faded)
 * @param mapping - Optional ColorMapping instance (creates default if not provided)
 * @returns THREE.Color set to the interpolated HSL value
 */
export function ageToThreeColor(
  age: number,
  mapping?: ColorMapping
): THREE.Color {
  const m = mapping ?? createColorMapping();
  const { h, s, l } = m.interpolate(age);
  return new THREE.Color().setHSL(h, s, l);
}

// Export the HSL constants for testing
export { FRESH_HSL, FADED_HSL };
