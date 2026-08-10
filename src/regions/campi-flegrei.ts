import type { RegionConfig } from '../region-config';
import { COASTLINE_POLYLINES } from '../coastline-data';

export const campiFlegrei: RegionConfig = {
  id: 'campi-flegrei',
  title: 'Campi Flegrei',
  center: { lat: 40.827, lon: 14.139 },
  bounds: { minLat: 40.78, maxLat: 40.90, minLon: 14.03, maxLon: 14.22 },
  coastlinePolylines: COASTLINE_POLYLINES,
  towns: [
    { name: 'Pozzuoli', lat: 40.822, lon: 14.122 },
    { name: 'Bacoli', lat: 40.800, lon: 14.070 },
    { name: 'Baia', lat: 40.813, lon: 14.075 },
    { name: 'Quarto', lat: 40.876, lon: 14.145 },
    { name: 'Monte di Procida', lat: 40.798, lon: 14.050 },
    { name: 'Bagnoli', lat: 40.808, lon: 14.168 },
    { name: 'Solfatara', lat: 40.828, lon: 14.139 },
  ],
  apiEndpoint: 'https://webservices.ingv.it/fdsnws/event/1/query',
  apiFormat: 'fdsn-text',
  defaultTimeRangeDays: 30,
  cameraDistance: 15,
};
