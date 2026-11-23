/** A single earthquake event from the INGV API */
export interface EarthquakeEvent {
  id: string;           // INGV EventID
  timestamp: Date;      // UTC, second precision
  latitude: number;     // degrees North (40.78 - 40.90)
  longitude: number;    // degrees East (14.03 - 14.22)
  depth: number;        // km below sea level (positive value)
  magnitude: number;    // local magnitude / Md
  magnitudeType: string; // e.g. "Md", "ML"
  locationName: string;  // e.g. "Campi Flegrei"
}

/** Display state of an event in 3D space */
export interface VisibleEvent {
  event: EarthquakeEvent;
  age: number;              // 0.0 = just appeared, 1.0 = oldest event
  isNew: boolean;           // highlight effect active
  highlightProgress: number; // 0.0 (start) to 1.0 (highlight finished)
}

/** 3D position of an event in the scene (computed values) */
export interface ScenePosition {
  x: number;  // longitude → x (centered on caldera center)
  y: number;  // depth → y (negative, downward)
  z: number;  // latitude → z (centered on caldera center)
}

/** Color coding based on age */
export interface ColorMapping {
  interpolate(age: number): { h: number; s: number; l: number };
}

/** Dynamic depth scaling */
export interface DepthScale {
  minDepth: number;     // minimum from loaded data (km)
  maxDepth: number;     // maximum from loaded data (km)
  sceneMinY: number;    // lower bound of the scene (world units)
  sceneMaxY: number;    // upper bound (0 = surface)
  toSceneY(depth: number): number;  // depth → y coordinate
}

/** Size mapping based on magnitude */
export interface MagnitudeScale {
  minMag: number;       // 0
  maxMag: number;       // 4
  minRadius: number;    // 2px (screen-projected)
  maxRadius: number;    // 16px (screen-projected)
  toRadius(magnitude: number): number;  // clamped linear mapping
}

/** Raw INGV API data row */
export interface RawINGVRecord {
  EventID: string;
  Time: string;
  Latitude: string;
  Longitude: string;
  'Depth/Km': string;
  Author: string;
  Catalog: string;
  Contributor: string;
  ContributorID: string;
  MagType: string;
  Magnitude: string;
  MagAuthor: string;
  EventLocationName: string;
  EventType: string;
}

export interface FetchOptions {
  startDate: Date;
  endDate: Date;
  minLat?: number;  // default: 40.78
  maxLat?: number;  // default: 40.90
  minLon?: number;  // default: 14.03
  maxLon?: number;  // default: 14.22
  timeoutMs?: number; // default: 15000
}

export interface FetchResult {
  events: EarthquakeEvent[];
  warnings: string[];
  /** Indicates a fetch failure occurred (network error, timeout, HTTP error). Previous data is retained in `events`. */
  failed?: boolean;
}

export interface GeoBounds {
  minLat: number;
  maxLat: number;
  minLon: number;
  maxLon: number;
}
