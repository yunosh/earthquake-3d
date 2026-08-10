import { describe, it, expect } from 'vitest';
import {
  geoToScene,
  computeDepthScale,
  createCoordinateMapperConfig,
  CALDERA_CENTER_LAT,
  CALDERA_CENTER_LON,
} from '../coordinate-mapper';
import { EarthquakeEvent } from '../types';

const CAMPI_FLEGREI_CONFIG = createCoordinateMapperConfig(CALDERA_CENTER_LAT, CALDERA_CENTER_LON);

function makeEvent(overrides: Partial<EarthquakeEvent> = {}): EarthquakeEvent {
  return {
    id: 'test-1',
    timestamp: new Date('2024-01-01T00:00:00Z'),
    latitude: 40.83,
    longitude: 14.14,
    depth: 3,
    magnitude: 2.0,
    magnitudeType: 'Md',
    locationName: 'Campi Flegrei',
    ...overrides,
  };
}

describe('geoToScene', () => {
  it('maps caldera center to origin (x=0, z=0)', () => {
    const depthScale = computeDepthScale([makeEvent({ depth: 3 })]);
    const pos = geoToScene(
      CALDERA_CENTER_LAT,
      CALDERA_CENTER_LON,
      0,
      CAMPI_FLEGREI_CONFIG,
      depthScale
    );
    expect(pos.x).toBeCloseTo(0, 5);
    expect(pos.z).toBeCloseTo(0, 5);
    expect(pos.y).toBeCloseTo(0, 5); // surface
  });

  it('maps depth to negative y', () => {
    const depthScale = computeDepthScale([makeEvent({ depth: 5 })]);
    const pos = geoToScene(
      CALDERA_CENTER_LAT,
      CALDERA_CENTER_LON,
      5,
      CAMPI_FLEGREI_CONFIG,
      depthScale
    );
    expect(pos.y).toBe(-10); // 5km * 2 = -10 scene units
  });

  it('maps east of center to positive x', () => {
    const depthScale = computeDepthScale([makeEvent({ depth: 3 })]);
    const pos = geoToScene(
      CALDERA_CENTER_LAT,
      CALDERA_CENTER_LON + 0.01,
      0,
      CAMPI_FLEGREI_CONFIG,
      depthScale
    );
    expect(pos.x).toBeGreaterThan(0);
    // 0.01° lon * ~84 km/° (111*cos(40.827°)) * 10 units/km ≈ 8.4 units
    expect(pos.x).toBeCloseTo(8.4, 1);
  });

  it('maps north of center to negative z', () => {
    const depthScale = computeDepthScale([makeEvent({ depth: 3 })]);
    const pos = geoToScene(
      CALDERA_CENTER_LAT + 0.01,
      CALDERA_CENTER_LON,
      0,
      CAMPI_FLEGREI_CONFIG,
      depthScale
    );
    expect(pos.z).toBeLessThan(0);
    // 0.01° lat * 111 km/° * 10 units/km = 11.1 units (negated)
    expect(pos.z).toBeCloseTo(-11.1, 1);
  });

  it('preserves relative ordering: further east → larger x', () => {
    const depthScale = computeDepthScale([makeEvent({ depth: 3 })]);
    const posA = geoToScene(CALDERA_CENTER_LAT, 14.10, 2, CAMPI_FLEGREI_CONFIG, depthScale);
    const posB = geoToScene(CALDERA_CENTER_LAT, 14.15, 2, CAMPI_FLEGREI_CONFIG, depthScale);
    expect(posB.x).toBeGreaterThan(posA.x);
  });

  it('preserves relative ordering: further north → smaller z', () => {
    const depthScale = computeDepthScale([makeEvent({ depth: 3 })]);
    const posA = geoToScene(40.80, CALDERA_CENTER_LON, 2, CAMPI_FLEGREI_CONFIG, depthScale);
    const posB = geoToScene(40.85, CALDERA_CENTER_LON, 2, CAMPI_FLEGREI_CONFIG, depthScale);
    expect(posB.z).toBeLessThan(posA.z);
  });

  it('preserves relative ordering: deeper → lower y', () => {
    const depthScale = computeDepthScale([makeEvent({ depth: 5 })]);
    const posA = geoToScene(CALDERA_CENTER_LAT, CALDERA_CENTER_LON, 1, CAMPI_FLEGREI_CONFIG, depthScale);
    const posB = geoToScene(CALDERA_CENTER_LAT, CALDERA_CENTER_LON, 3, CAMPI_FLEGREI_CONFIG, depthScale);
    expect(posB.y).toBeLessThan(posA.y);
  });

  it('horizontal scale: 1 unit ≈ 100m', () => {
    const depthScale = computeDepthScale([makeEvent({ depth: 3 })]);
    // 1km east of center should be 10 units
    const deltaLonFor1km = 1 / 85; // degrees for 1km
    const pos = geoToScene(
      CALDERA_CENTER_LAT,
      CALDERA_CENTER_LON + deltaLonFor1km,
      0,
      CAMPI_FLEGREI_CONFIG,
      depthScale
    );
    expect(pos.x).toBeCloseTo(10, 0); // 1km = 10 units → 1 unit = 100m
  });
});

describe('computeDepthScale', () => {
  it('returns minimum axis depth of 2km for very shallow events', () => {
    const events = [
      makeEvent({ depth: 0.3 }),
      makeEvent({ depth: 0.5 }),
      makeEvent({ depth: 0.8 }),
    ];
    const scale = computeDepthScale(events);
    expect(scale.maxDepth).toBe(2);
    expect(scale.sceneMinY).toBe(-4); // -2km * 2
  });

  it('adapts to actual max depth for deeper events', () => {
    const events = [
      makeEvent({ depth: 1 }),
      makeEvent({ depth: 5 }),
      makeEvent({ depth: 8 }),
    ];
    const scale = computeDepthScale(events);
    expect(scale.maxDepth).toBe(8);
    expect(scale.sceneMinY).toBe(-16); // -8km * 2
  });

  it('correctly reports min and max depths', () => {
    const events = [
      makeEvent({ depth: 2 }),
      makeEvent({ depth: 4 }),
      makeEvent({ depth: 6 }),
    ];
    const scale = computeDepthScale(events);
    expect(scale.minDepth).toBe(2);
    expect(scale.maxDepth).toBe(6);
  });

  it('sceneMaxY is always 0 (surface)', () => {
    const events = [makeEvent({ depth: 5 })];
    const scale = computeDepthScale(events);
    expect(scale.sceneMaxY).toBe(0);
  });

  it('toSceneY converts depth correctly (depth * -2)', () => {
    const events = [makeEvent({ depth: 5 })];
    const scale = computeDepthScale(events);
    expect(scale.toSceneY(0)).toBeCloseTo(0, 5);
    expect(scale.toSceneY(1)).toBe(-2);
    expect(scale.toSceneY(3)).toBe(-6);
    expect(scale.toSceneY(5)).toBe(-10);
  });

  it('handles empty events array with sensible defaults', () => {
    const scale = computeDepthScale([]);
    expect(scale.maxDepth).toBe(2); // MIN_AXIS_DEPTH_KM
    expect(scale.sceneMaxY).toBe(0);
    expect(scale.sceneMinY).toBe(-4);
  });

  it('handles single event', () => {
    const events = [makeEvent({ depth: 3 })];
    const scale = computeDepthScale(events);
    expect(scale.minDepth).toBe(3);
    expect(scale.maxDepth).toBe(3);
    expect(scale.sceneMinY).toBe(-6);
  });

  it('applies minimum 2km depth for all shallow events under 1km', () => {
    const events = [
      makeEvent({ depth: 0.1 }),
      makeEvent({ depth: 0.2 }),
    ];
    const scale = computeDepthScale(events);
    expect(scale.maxDepth).toBe(2);
  });

  it('does not apply minimum for events at exactly 2km or deeper', () => {
    const events = [makeEvent({ depth: 2.5 })];
    const scale = computeDepthScale(events);
    expect(scale.maxDepth).toBe(2.5);
  });
});
