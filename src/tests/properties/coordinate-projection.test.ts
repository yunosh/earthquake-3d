import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { geoToScene, computeDepthScale } from '../../coordinate-mapper';
import { EarthquakeEvent, GeoBounds } from '../../types';

/**
 * Property 9: Coordinate Projection Bijectivity and Ordering
 *
 * Feature: campi-flegrei-3d-earthquakes, Property 9: Coordinate Projection Bijectivity and Ordering
 *
 * Validates: Requirements 2.1
 */

const BOUNDS: GeoBounds = {
  minLat: 40.78,
  maxLat: 40.90,
  minLon: 14.03,
  maxLon: 14.22,
};

/** Arbitrary latitude within bounding box */
const arbLat = fc.double({ min: 40.78, max: 40.90, noNaN: true });

/** Arbitrary longitude within bounding box */
const arbLon = fc.double({ min: 14.03, max: 14.22, noNaN: true });

/** Arbitrary depth in km (positive, reasonable range for Campi Flegrei) */
const arbDepth = fc.double({ min: 0.1, max: 15.0, noNaN: true });

/** Helper to create a minimal EarthquakeEvent for computing depth scale */
function makeEvent(depth: number): EarthquakeEvent {
  return {
    id: 'gen',
    timestamp: new Date('2024-01-01T00:00:00Z'),
    latitude: 40.83,
    longitude: 14.14,
    depth,
    magnitude: 2.0,
    magnitudeType: 'Md',
    locationName: 'Campi Flegrei',
  };
}

describe('Property 9: Coordinate Projection Bijectivity and Ordering', () => {
  // Use a depth scale that covers the full range for all property tests
  const depthScale = computeDepthScale([makeEvent(0.1), makeEvent(15.0)]);

  it('injective: distinct (lat, lon, depth) triples produce distinct (x, y, z) positions', () => {
    fc.assert(
      fc.property(
        arbLat,
        arbLon,
        arbDepth,
        arbLat,
        arbLon,
        arbDepth,
        (lat1, lon1, depth1, lat2, lon2, depth2) => {
          // Only test when inputs are actually distinct
          if (lat1 === lat2 && lon1 === lon2 && depth1 === depth2) return;

          const pos1 = geoToScene(lat1, lon1, depth1, BOUNDS, depthScale);
          const pos2 = geoToScene(lat2, lon2, depth2, BOUNDS, depthScale);

          // At least one coordinate must differ
          const isDistinct =
            pos1.x !== pos2.x || pos1.y !== pos2.y || pos1.z !== pos2.z;
          expect(isDistinct).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('east ordering: lon_a > lon_b implies scene_a.x > scene_b.x', () => {
    fc.assert(
      fc.property(
        arbLat,
        arbLon,
        arbLon,
        arbDepth,
        (lat, lonA, lonB, depth) => {
          // Only test when lonA is strictly greater
          fc.pre(lonA > lonB);

          const posA = geoToScene(lat, lonA, depth, BOUNDS, depthScale);
          const posB = geoToScene(lat, lonB, depth, BOUNDS, depthScale);

          expect(posA.x).toBeGreaterThan(posB.x);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('north ordering: lat_a > lat_b implies scene_a.z > scene_b.z', () => {
    fc.assert(
      fc.property(
        arbLat,
        arbLat,
        arbLon,
        arbDepth,
        (latA, latB, lon, depth) => {
          // Only test when latA is strictly greater
          fc.pre(latA > latB);

          const posA = geoToScene(latA, lon, depth, BOUNDS, depthScale);
          const posB = geoToScene(latB, lon, depth, BOUNDS, depthScale);

          expect(posA.z).toBeGreaterThan(posB.z);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('depth ordering: depth_a > depth_b implies scene_a.y < scene_b.y', () => {
    fc.assert(
      fc.property(
        arbLat,
        arbLon,
        arbDepth,
        arbDepth,
        (lat, lon, depthA, depthB) => {
          // Only test when depthA is strictly greater
          fc.pre(depthA > depthB);

          const posA = geoToScene(lat, lon, depthA, BOUNDS, depthScale);
          const posB = geoToScene(lat, lon, depthB, BOUNDS, depthScale);

          expect(posA.y).toBeLessThan(posB.y);
        }
      ),
      { numRuns: 100 }
    );
  });
});
