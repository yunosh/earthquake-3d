import type { RegionConfig } from '../region-config';
import { CANARY_COASTLINE_POLYLINES } from '../canary-coastline-data';

export const canaryIslands: RegionConfig = {
  id: 'canary-islands',
  title: 'Kanarische Inseln',
  center: { lat: 28.1, lon: -15.4 },
  bounds: { minLat: 27.5, maxLat: 29.5, minLon: -18.5, maxLon: -13.3 },
  coastlinePolylines: CANARY_COASTLINE_POLYLINES,
  towns: [
    { name: 'Santa Cruz de Tenerife', lat: 28.4697, lon: -16.2546 },
    { name: 'Las Palmas de Gran Canaria', lat: 28.1235, lon: -15.4363 },
    { name: 'Los Llanos de Aridane', lat: 28.6585, lon: -17.9182 },
    { name: 'Valverde', lat: 27.8089, lon: -17.9153 },
    { name: 'Arrecife', lat: 28.9630, lon: -13.5477 },
    { name: 'Puerto del Rosario', lat: 28.5004, lon: -13.8627 },
  ],
  apiEndpoint: 'https://earthquake.usgs.gov/fdsnws/event/1/query',
  apiFormat: 'fdsn-text',
  defaultTimeRangeDays: 365,
  cameraDistance: 60,
};
