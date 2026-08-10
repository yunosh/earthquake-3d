import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { createColorMapping } from '../../color-mapper';

/**
 * Property 4: Temporal Color Age Ordering
 *
 * Feature: campi-flegrei-3d-earthquakes, Property 4: Temporal Color Age Ordering
 *
 * For any two visible events A and B where A appeared before B (A.age > B.age),
 * the color of A SHALL be at least as faded (equal or lower saturation/lightness)
 * as the color of B. The color mapping SHALL be monotonically fading with increasing age.
 *
 * Validates: Requirements 2.4
 */

describe('Property 4: Temporal Color Age Ordering', () => {
  const mapping = createColorMapping();

  /** Arbitrary age value in [0, 1] */
  const arbAge = fc.double({ min: 0, max: 1, noNaN: true, noDefaultInfinity: true });

  it('saturation is monotonically non-increasing with age: ageA > ageB implies s(A) <= s(B)', () => {
    fc.assert(
      fc.property(arbAge, arbAge, (ageA, ageB) => {
        // Only test when ageA is strictly greater than ageB
        fc.pre(ageA > ageB);

        const colorA = mapping.interpolate(ageA);
        const colorB = mapping.interpolate(ageB);

        expect(colorA.s).toBeLessThanOrEqual(colorB.s);
      }),
      { numRuns: 100 }
    );
  });

  it('lightness is monotonically non-increasing with age: ageA > ageB implies l(A) <= l(B)', () => {
    fc.assert(
      fc.property(arbAge, arbAge, (ageA, ageB) => {
        // Only test when ageA is strictly greater than ageB
        fc.pre(ageA > ageB);

        const colorA = mapping.interpolate(ageA);
        const colorB = mapping.interpolate(ageB);

        expect(colorA.l).toBeLessThanOrEqual(colorB.l);
      }),
      { numRuns: 100 }
    );
  });
});
