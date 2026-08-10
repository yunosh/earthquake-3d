import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { createMagnitudeScale } from '../../magnitude-scale';

/**
 * Property 3: Magnitude-to-Radius Monotonicity and Clamping
 *
 * Feature: campi-flegrei-3d-earthquakes, Property 3: Magnitude-to-Radius Monotonicity and Clamping
 *
 * Validates: Requirements 2.3, 2.6
 */

describe('Property 3: Magnitude-to-Radius Monotonicity and Clamping', () => {
  const scale = createMagnitudeScale();

  /** Arbitrary magnitude value covering a wide range (well beyond [0, 4]) */
  const arbMagnitude = fc.double({ min: -10, max: 10, noNaN: true, noDefaultInfinity: true });

  /** Arbitrary magnitude in the valid interpolation range [0, 4] */
  const arbMagnitudeInRange = fc.double({ min: 0, max: 4, noNaN: true, noDefaultInfinity: true });

  /** Arbitrary magnitude at or below zero */
  const arbMagnitudeBelowZero = fc.double({ min: -100, max: 0, noNaN: true, noDefaultInfinity: true });

  /** Arbitrary magnitude at or above four */
  const arbMagnitudeAboveFour = fc.double({ min: 4, max: 100, noNaN: true, noDefaultInfinity: true });

  it('monotonically non-decreasing: mag_a > mag_b implies toRadius(mag_a) >= toRadius(mag_b)', () => {
    fc.assert(
      fc.property(arbMagnitude, arbMagnitude, (magA, magB) => {
        fc.pre(magA > magB);

        const radiusA = scale.toRadius(magA);
        const radiusB = scale.toRadius(magB);

        expect(radiusA).toBeGreaterThanOrEqual(radiusB);
      }),
      { numRuns: 100 }
    );
  });

  it('clamped at lower bound: mag <= 0 implies toRadius(mag) === 2', () => {
    fc.assert(
      fc.property(arbMagnitudeBelowZero, (mag) => {
        expect(scale.toRadius(mag)).toBe(2);
      }),
      { numRuns: 100 }
    );
  });

  it('clamped at upper bound: mag >= 4 implies toRadius(mag) === 16', () => {
    fc.assert(
      fc.property(arbMagnitudeAboveFour, (mag) => {
        expect(scale.toRadius(mag)).toBe(16);
      }),
      { numRuns: 100 }
    );
  });

  it('linear interpolation in [0, 4]: toRadius(mag) === 2 + (mag/4) * 14', () => {
    fc.assert(
      fc.property(arbMagnitudeInRange, (mag) => {
        const expected = 2 + (mag / 4) * 14;
        const actual = scale.toRadius(mag);

        expect(actual).toBeCloseTo(expected, 10);
      }),
      { numRuns: 100 }
    );
  });
});
