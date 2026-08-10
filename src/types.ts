/** Ein einzelnes Erdbeben-Event vom INGV API */
export interface EarthquakeEvent {
  id: string;           // INGV EventID
  timestamp: Date;      // UTC, Sekundenpräzision
  latitude: number;     // Grad Nord (40.78 - 40.90)
  longitude: number;    // Grad Ost (14.03 - 14.22)
  depth: number;        // km unter Meeresspiegel (positiver Wert)
  magnitude: number;    // Lokale Magnitude / Md
  magnitudeType: string; // z.B. "Md", "ML"
  locationName: string;  // z.B. "Campi Flegrei"
}

/** Darstellungszustand eines Events im 3D-Raum */
export interface VisibleEvent {
  event: EarthquakeEvent;
  age: number;              // 0.0 = gerade erschienen, 1.0 = ältestes Event
  isNew: boolean;           // Highlight-Effekt aktiv
  highlightProgress: number; // 0.0 (Start) bis 1.0 (Highlight beendet)
}

/** 3D-Position eines Events in der Szene (berechnete Werte) */
export interface ScenePosition {
  x: number;  // longitude → x (zentriert auf Caldera-Mitte)
  y: number;  // depth → y (negativ, nach unten)
  z: number;  // latitude → z (zentriert auf Caldera-Mitte)
}

/** Farbkodierung basierend auf Alter */
export interface ColorMapping {
  interpolate(age: number): { h: number; s: number; l: number };
}

/** Dynamische Tiefenskalierung */
export interface DepthScale {
  minDepth: number;     // Minimum aus geladenen Daten (km)
  maxDepth: number;     // Maximum aus geladenen Daten (km)
  sceneMinY: number;    // Untere Grenze der Szene (World Units)
  sceneMaxY: number;    // Obere Grenze (0 = Oberfläche)
  toSceneY(depth: number): number;  // depth → y-Koordinate
}

/** Größen-Mapping basierend auf Magnitude */
export interface MagnitudeScale {
  minMag: number;       // 0
  maxMag: number;       // 4
  minRadius: number;    // 2px (screen-projected)
  maxRadius: number;    // 16px (screen-projected)
  toRadius(magnitude: number): number;  // Clamped linear mapping
}

/** INGV API Roh-Datenzeile */
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
