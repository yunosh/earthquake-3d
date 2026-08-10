import { describe, it, expect } from 'vitest';
import { createMagnitudeScale, screenPxToWorldRadius } from '../magnitude-scale';

describe('MagnitudeScale', () => {
  const scale = createMagnitudeScale();

  describe('toRadius', () => {
    it('returns minRadius (2) for magnitude 0', () => {
      expect(scale.toRadius(0)).toBe(2);
    });

    it('returns maxRadius (16) for magnitude 4', () => {
      expect(scale.toRadius(4)).toBe(16);
    });

    it('clamps magnitude below 0 to minRadius', () => {
      expect(scale.toRadius(-1)).toBe(2);
      expect(scale.toRadius(-100)).toBe(2);
    });

    it('clamps magnitude above 4 to maxRadius', () => {
      expect(scale.toRadius(5)).toBe(16);
      expect(scale.toRadius(100)).toBe(16);
    });

    it('linearly interpolates for magnitude 2 (midpoint)', () => {
      // midpoint: 2 + 0.5 * (16 - 2) = 9
      expect(scale.toRadius(2)).toBe(9);
    });

    it('linearly interpolates for magnitude 1', () => {
      // t = 0.25: 2 + 0.25 * 14 = 5.5
      expect(scale.toRadius(1)).toBe(5.5);
    });

    it('linearly interpolates for magnitude 3', () => {
      // t = 0.75: 2 + 0.75 * 14 = 12.5
      expect(scale.toRadius(3)).toBe(12.5);
    });

    it('is monotonically non-decreasing', () => {
      const magnitudes = [-1, 0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 5];
      for (let i = 1; i < magnitudes.length; i++) {
        expect(scale.toRadius(magnitudes[i])).toBeGreaterThanOrEqual(
          scale.toRadius(magnitudes[i - 1])
        );
      }
    });
  });

  describe('custom parameters', () => {
    it('supports custom min/max magnitude and radius', () => {
      const custom = createMagnitudeScale(1, 5, 4, 20);
      expect(custom.toRadius(1)).toBe(4);
      expect(custom.toRadius(5)).toBe(20);
      expect(custom.toRadius(3)).toBe(12); // midpoint: 4 + 0.5 * 16 = 12
      expect(custom.toRadius(0)).toBe(4); // clamped to minMag
      expect(custom.toRadius(6)).toBe(20); // clamped to maxMag
    });
  });
});

describe('screenPxToWorldRadius', () => {
  it('converts screen pixels to world radius correctly', () => {
    // FOV = 60° = π/3, distance = 10, viewport = 800px, screenPx = 8
    // visibleHeight = 2 * 10 * tan(π/6) = 20 * 0.5774 ≈ 11.547
    // worldRadius = (8 / 800) * 11.547 ≈ 0.1155
    const fov = Math.PI / 3;
    const result = screenPxToWorldRadius(8, 10, fov, 800);
    expect(result).toBeCloseTo(0.1155, 3);
  });

  it('returns 0 for 0 screen pixels', () => {
    const fov = Math.PI / 3;
    expect(screenPxToWorldRadius(0, 10, fov, 800)).toBe(0);
  });

  it('scales linearly with screen pixels', () => {
    const fov = Math.PI / 3;
    const r1 = screenPxToWorldRadius(4, 10, fov, 800);
    const r2 = screenPxToWorldRadius(8, 10, fov, 800);
    expect(r2).toBeCloseTo(r1 * 2, 10);
  });

  it('scales linearly with camera distance', () => {
    const fov = Math.PI / 3;
    const r1 = screenPxToWorldRadius(8, 10, fov, 800);
    const r2 = screenPxToWorldRadius(8, 20, fov, 800);
    expect(r2).toBeCloseTo(r1 * 2, 10);
  });
});
