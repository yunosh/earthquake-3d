import { DepthScale, EarthquakeEvent, ScenePosition } from './types';

/** Center of the Campi Flegrei caldera */
export const CALDERA_CENTER_LAT = 40.827;
export const CALDERA_CENTER_LON = 14.139;

/**
 * Horizontal scale: 1 scene unit = 100m = 0.1km
 * So km * 10 = scene units
 */
const HORIZONTAL_SCALE = 10; // 1 km → 10 scene units (i.e. 1 unit = 100m)

/**
 * Depth scale factor: 1 scene unit = 0.5km
 * So depth in km * 2 = scene units (negative y direction)
 */
const DEPTH_SCALE_FACTOR = 2;

/** Minimum axis depth for shallow datasets (km) */
const MIN_AXIS_DEPTH_KM = 2;

/**
 * Configuration for the coordinate mapper, parameterized by region center.
 */
export interface CoordinateMapperConfig {
  centerLat: number;
  centerLon: number;
  kmPerDegreeLat: number;   // ~111 (constant)
  kmPerDegreeLon: number;   // 111 * cos(centerLat)
}

/**
 * Create a CoordinateMapperConfig for a given region center.
 *
 * @param centerLat - Center latitude in degrees
 * @param centerLon - Center longitude in degrees
 * @returns CoordinateMapperConfig with computed km-per-degree factors
 */
export function createCoordinateMapperConfig(
  centerLat: number,
  centerLon: number
): CoordinateMapperConfig {
  const latRad = (centerLat * Math.PI) / 180;
  return {
    centerLat,
    centerLon,
    kmPerDegreeLat: 111,
    kmPerDegreeLon: 111 * Math.cos(latRad),
  };
}

/**
 * Convert geographic coordinates to 3D scene position.
 *
 * - Latitude → Z (north = positive Z)
 * - Longitude → X (east = positive X)
 * - Depth → Y (deeper = more negative Y)
 *
 * Centered on the region center defined in config.
 *
 * @param lat - Latitude in degrees
 * @param lon - Longitude in degrees
 * @param depth - Depth in km below surface (positive value)
 * @param config - Coordinate mapper configuration with center and scale factors
 * @param depthScale - The depth scaling configuration
 * @returns Scene position with x, y, z coordinates
 */
export function geoToScene(
  lat: number,
  lon: number,
  depth: number,
  config: CoordinateMapperConfig,
  depthScale: DepthScale
): ScenePosition {
  // Horizontal mapping: offset from region center, convert to km, then to scene units
  const deltaLat = lat - config.centerLat;
  const deltaLon = lon - config.centerLon;

  const x = deltaLon * config.kmPerDegreeLon * HORIZONTAL_SCALE;
  const z = deltaLat * config.kmPerDegreeLat * HORIZONTAL_SCALE;

  // Vertical mapping: use depth scale's toSceneY for consistent depth rendering
  const y = depthScale.toSceneY(depth);

  return { x, y, z };
}

/**
 * Compute a dynamic depth scale based on the loaded earthquake events.
 *
 * Rules:
 * - sceneMaxY is always 0 (surface)
 * - For shallow datasets (all events < 1km): use minimum axis depth of 2km
 * - scaleFactor: 1 scene unit = 0.5km (multiply depth by 2)
 * - sceneMinY = -maxDepth * DEPTH_SCALE_FACTOR
 *
 * @param events - Array of earthquake events with depth values
 * @returns DepthScale object with min/max depths and toSceneY conversion function
 */
export function computeDepthScale(events: EarthquakeEvent[]): DepthScale {
  if (events.length === 0) {
    // No events: use a sensible default
    const maxDepth = MIN_AXIS_DEPTH_KM;
    return createDepthScale(0, maxDepth);
  }

  let minDepth = Infinity;
  let maxDepth = -Infinity;

  for (const event of events) {
    if (event.depth < minDepth) minDepth = event.depth;
    if (event.depth > maxDepth) maxDepth = event.depth;
  }

  // Ensure minimum axis depth for shallow datasets
  if (maxDepth < MIN_AXIS_DEPTH_KM) {
    maxDepth = MIN_AXIS_DEPTH_KM;
  }

  return createDepthScale(minDepth, maxDepth);
}

/**
 * Create a DepthScale object with the given min/max depths.
 */
function createDepthScale(minDepth: number, maxDepth: number): DepthScale {
  const sceneMaxY = 0; // Surface is always at y=0
  const sceneMinY = -maxDepth * DEPTH_SCALE_FACTOR;

  return {
    minDepth,
    maxDepth,
    sceneMinY,
    sceneMaxY,
    toSceneY(depth: number): number {
      // Depth is positive in km, scene Y is negative (downward)
      return -depth * DEPTH_SCALE_FACTOR;
    },
  };
}
