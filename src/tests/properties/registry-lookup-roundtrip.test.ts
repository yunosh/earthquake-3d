import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { registerRegion, getRegion } from '../../region-registry';
import type { RegionConfig } from '../../region-config';

/**
 * Property 1: Registry lookup round-trip
 *
 * For any RegionConfig that is registered in the RegionRegistry, looking it up
 * by its id shall return the identical config object with all fields preserved.
 *
 * **Validates: Requirements 1.2**
 */

/**
 * Arbitrary that generates valid RegionConfig objects with unique IDs
 * to avoid collisions between test runs.
 */
const regionConfigArb = fc
  .record({
    id: fc.uuid(),
    title: fc.string({ minLength: 1, maxLength: 50 }),
    centerLat: fc.double({ min: -90, max: 90, noNaN: true, noDefaultInfinity: true }),
    centerLon: fc.double({ min: -180, max: 180, noNaN: true, noDefaultInfinity: true }),
    minLat: fc.double({ min: -90, max: 89, noNaN: true, noDefaultInfinity: true }),
    maxLat: fc.double({ min: -89, max: 90, noNaN: true, noDefaultInfinity: true }),
    minLon: fc.double({ min: -180, max: 179, noNaN: true, noDefaultInfinity: true }),
    maxLon: fc.double({ min: -179, max: 180, noNaN: true, noDefaultInfinity: true }),
    apiEndpoint: fc.webUrl(),
    defaultTimeRangeDays: fc.integer({ min: 1, max: 365 }),
    cameraDistance: fc.double({ min: 1, max: 200, noNaN: true, noDefaultInfinity: true }),
    townCount: fc.integer({ min: 0, max: 5 }),
    polylineCount: fc.integer({ min: 0, max: 3 }),
  })
  .map((r): RegionConfig => ({
    id: r.id,
    title: r.title,
    center: { lat: r.centerLat, lon: r.centerLon },
    bounds: {
      minLat: Math.min(r.minLat, r.maxLat),
      maxLat: Math.max(r.minLat, r.maxLat),
      minLon: Math.min(r.minLon, r.maxLon),
      maxLon: Math.max(r.minLon, r.maxLon),
    },
    coastlinePolylines: Array.from({ length: r.polylineCount }, () => [[0, 0] as [number, number]]),
    towns: Array.from({ length: r.townCount }, (_, i) => ({
      name: `Town${i}`,
      lat: r.centerLat,
      lon: r.centerLon,
    })),
    apiEndpoint: r.apiEndpoint,
    apiFormat: 'fdsn-text',
    defaultTimeRangeDays: r.defaultTimeRangeDays,
    cameraDistance: r.cameraDistance,
  }));

describe('Feature: multi-region-canary-islands, Property 1: Registry lookup round-trip', () => {
  it('getRegion(config.id) returns the exact same object reference after registration', () => {
    fc.assert(
      fc.property(regionConfigArb, (config) => {
        registerRegion(config);
        const retrieved = getRegion(config.id);
        expect(retrieved).toBe(config);
      }),
      { numRuns: 100 }
    );
  });
});
