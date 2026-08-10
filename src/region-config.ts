import type { GeoBounds } from './types';

export type { CoordinateMapperConfig } from './coordinate-mapper';

export interface RegionConfig {
  id: string;                        // z.B. "campi-flegrei", "canary-islands"
  title: string;                     // z.B. "Campi Flegrei", "Kanarische Inseln"
  center: { lat: number; lon: number };
  bounds: GeoBounds;
  coastlinePolylines: [number, number][][];  // Array of polylines
  towns: { name: string; lat: number; lon: number }[];
  apiEndpoint: string;               // FDSN event query base URL
  apiFormat: 'fdsn-text';            // Response format identifier
  defaultTimeRangeDays: number;      // Default fetch window
  cameraDistance: number;            // Initial camera distance for framing
}
