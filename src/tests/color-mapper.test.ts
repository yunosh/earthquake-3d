import { describe, it, expect } from 'vitest';
import { createColorMapping, ageToThreeColor, FRESH_HSL, FADED_HSL } from '../color-mapper';

describe('createColorMapping', () => {
  const mapping = createColorMapping();

  describe('interpolate', () => {
    it('returns fresh color HSL at age 0', () => {
      const result = mapping.interpolate(0);
      expect(result.h).toBeCloseTo(FRESH_HSL.h, 5);
      expect(result.s).toBeCloseTo(FRESH_HSL.s, 5);
      expect(result.l).toBeCloseTo(FRESH_HSL.l, 5);
    });

    it('returns faded color HSL at age 1', () => {
      const result = mapping.interpolate(1);
      expect(result.h).toBeCloseTo(FADED_HSL.h, 5);
      expect(result.s).toBeCloseTo(FADED_HSL.s, 5);
      expect(result.l).toBeCloseTo(FADED_HSL.l, 5);
    });

    it('returns midpoint HSL at age 0.5', () => {
      const result = mapping.interpolate(0.5);
      const expectedH = (FRESH_HSL.h + FADED_HSL.h) / 2;
      const expectedS = (FRESH_HSL.s + FADED_HSL.s) / 2;
      const expectedL = (FRESH_HSL.l + FADED_HSL.l) / 2;
      expect(result.h).toBeCloseTo(expectedH, 5);
      expect(result.s).toBeCloseTo(expectedS, 5);
      expect(result.l).toBeCloseTo(expectedL, 5);
    });

    it('clamps age below 0 to fresh color', () => {
      const result = mapping.interpolate(-0.5);
      expect(result.h).toBeCloseTo(FRESH_HSL.h, 5);
      expect(result.s).toBeCloseTo(FRESH_HSL.s, 5);
      expect(result.l).toBeCloseTo(FRESH_HSL.l, 5);
    });

    it('clamps age above 1 to faded color', () => {
      const result = mapping.interpolate(1.5);
      expect(result.h).toBeCloseTo(FADED_HSL.h, 5);
      expect(result.s).toBeCloseTo(FADED_HSL.s, 5);
      expect(result.l).toBeCloseTo(FADED_HSL.l, 5);
    });

    it('has decreasing saturation as age increases', () => {
      const at0 = mapping.interpolate(0);
      const at025 = mapping.interpolate(0.25);
      const at05 = mapping.interpolate(0.5);
      const at075 = mapping.interpolate(0.75);
      const at1 = mapping.interpolate(1);

      expect(at0.s).toBeGreaterThan(at025.s);
      expect(at025.s).toBeGreaterThan(at05.s);
      expect(at05.s).toBeGreaterThan(at075.s);
      expect(at075.s).toBeGreaterThan(at1.s);
    });

    it('has decreasing lightness as age increases', () => {
      const at0 = mapping.interpolate(0);
      const at025 = mapping.interpolate(0.25);
      const at05 = mapping.interpolate(0.5);
      const at075 = mapping.interpolate(0.75);
      const at1 = mapping.interpolate(1);

      expect(at0.l).toBeGreaterThan(at025.l);
      expect(at025.l).toBeGreaterThan(at05.l);
      expect(at05.l).toBeGreaterThan(at075.l);
      expect(at075.l).toBeGreaterThan(at1.l);
    });

    it('has increasing hue (orange → blue) as age increases', () => {
      const at0 = mapping.interpolate(0);
      const at05 = mapping.interpolate(0.5);
      const at1 = mapping.interpolate(1);

      // Hue goes from ~16°/360 (orange) to ~216°/360 (blue)
      expect(at0.h).toBeLessThan(at05.h);
      expect(at05.h).toBeLessThan(at1.h);
    });

    it('returns values in valid HSL ranges', () => {
      for (let age = 0; age <= 1; age += 0.1) {
        const result = mapping.interpolate(age);
        expect(result.h).toBeGreaterThanOrEqual(0);
        expect(result.h).toBeLessThanOrEqual(1);
        expect(result.s).toBeGreaterThanOrEqual(0);
        expect(result.s).toBeLessThanOrEqual(1);
        expect(result.l).toBeGreaterThanOrEqual(0);
        expect(result.l).toBeLessThanOrEqual(1);
      }
    });
  });
});

describe('ageToThreeColor', () => {
  it('returns a THREE.Color instance', () => {
    const color = ageToThreeColor(0.5);
    expect(color).toBeDefined();
    expect(typeof color.r).toBe('number');
    expect(typeof color.g).toBe('number');
    expect(typeof color.b).toBe('number');
  });

  it('uses the provided mapping if given', () => {
    const mapping = createColorMapping();
    const color = ageToThreeColor(0.5, mapping);
    const hsl = { h: 0, s: 0, l: 0 };
    color.getHSL(hsl);

    const expected = mapping.interpolate(0.5);
    expect(hsl.h).toBeCloseTo(expected.h, 2);
    expect(hsl.s).toBeCloseTo(expected.s, 2);
    expect(hsl.l).toBeCloseTo(expected.l, 2);
  });

  it('produces orange-red for age 0', () => {
    const color = ageToThreeColor(0);
    // #FF4500 → R=1.0, G≈0.27, B=0.0
    expect(color.r).toBeCloseTo(1.0, 1);
    expect(color.g).toBeCloseTo(0.27, 1);
    expect(color.b).toBeCloseTo(0.0, 1);
  });

  it('produces muted blue-grey for age 1', () => {
    const color = ageToThreeColor(1);
    // #4A6080 → R≈0.29, G≈0.376, B≈0.502
    expect(color.r).toBeCloseTo(0.29, 1);
    expect(color.g).toBeCloseTo(0.376, 1);
    expect(color.b).toBeCloseTo(0.502, 1);
  });
});
