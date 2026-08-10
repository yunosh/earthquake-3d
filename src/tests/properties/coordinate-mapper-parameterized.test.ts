import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  createCoordinateMapperConfig,
  geoToScene,
  computeDepthScale,
} from '../../coordinate-mapper';
import { EarthquakeEvent } from '../../types';

/**
 * Feature: multi-region-canary-islands, Property 7: km-per-degree-longitude scales with cosine of latitude
 * Feature: multi-region-canary-islands, Property 8: Region center maps to scene origin
 *
 * Validates: Requirements 5.3, 6.2, 6.3
 */

/** Helper to create a minimal EarthquakeEvent for computing depth scale */
function makeEvent(depth: number): EarthquakeEvent {
  return {
    id: 'gen',
    timestamp: new Date('2024-01-01T00:00:00Z'),
    latitude: 40.0,
    longitude: 14.0,
    depth,
    magnitude: 2.0,
    magnitudeType: 'Md',
    locationName: 'Test',
  };
}

/** Arbitrary latitude avoiding exact poles where cos approaches 0 */
const arbLat = fc.double({ min: -89, max: 89, noNaN: true });

/** Arbitrary longitude in valid range */
const arbLon = fc.double({ min: -180, max: 180, noNaN: true });

/** Arbitrary depth in km */
const arbDepth = fc.double({ min: 0.1, max: 30.0, noNaN: true });

describe('Property 7: km-per-degree-longitude scales with cosine of latitude', () => {
  it('kmPerDegreeLon equals 111 * cos(lat_in_radians) within ±0.001', () => {
    fc.assert(
      fc.property(arbLat, arbLon, (lat, lon) => {
        const config = createCoordinateMapperConfig(lat, lon);
        const expected = 111 * Math.cos((lat * Math.PI) / 180);

        expect(config.kmPerDegreeLon).toBeCloseTo(expected, 3);
        expect(Math.abs(config.kmPerDegreeLon - expected)).toBeLessThanOrEqual(0.001);
      }),
      { numRuns: 100 }
    );
  });

  it('kmPerDegreeLat is always 111', () => {
    fc.assert(
      fc.property(arbLat, arbLon, (lat, lon) => {
        const config = createCoordinateMapperConfig(lat, lon);
        expect(config.kmPerDegreeLat).toBe(111);
      }),
      { numRuns: 100 }
    );
  });
});

describe('Property 8: Region center maps to scene origin', () => {
  it('an event at the region center produces x === 0 and z === 0', () => {
    fc.assert(
      fc.property(arbLat, arbLon, arbDepth, (centerLat, centerLon, depth) => {
        const config = createCoordinateMapperConfig(centerLat, centerLon);
        const depthScale = computeDepthScale([makeEvent(depth)]);

        const pos = geoToScene(centerLat, centerLon, depth, config, depthScale);

        expect(pos.x).toBeCloseTo(0, 10);
        expect(pos.z).toBeCloseTo(0, 10);
      }),
      { numRuns: 100 }
    );
  });

  it('depth maps independently via depthScale (y is not zero for non-zero depth)', () => {
    fc.assert(
      fc.property(arbLat, arbLon, arbDepth, (centerLat, centerLon, depth) => {
        fc.pre(depth > 0.01); // Ensure non-trivial depth

        const config = createCoordinateMapperConfig(centerLat, centerLon);
        const depthScale = computeDepthScale([makeEvent(depth)]);

        const pos = geoToScene(centerLat, centerLon, depth, config, depthScale);

        // y should be negative for positive depth
        expect(pos.y).toBeLessThan(0);
      }),
      { numRuns: 100 }
    );
  });
});
