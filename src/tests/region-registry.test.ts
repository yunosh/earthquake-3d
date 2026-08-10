import { describe, it, expect } from 'vitest';
import { registerRegion, getRegion, getAllRegions, getDefaultRegionId } from '../region-registry';
import type { RegionConfig } from '../region-config';

// We need to reset the registry between tests since it's module-level state.
// We'll re-import or use a fresh approach per test.

const mockConfig: RegionConfig = {
  id: 'test-region',
  title: 'Test Region',
  center: { lat: 40.0, lon: 14.0 },
  bounds: { minLat: 39.5, maxLat: 40.5, minLon: 13.5, maxLon: 14.5 },
  coastlinePolylines: [[[40.0, 14.0], [40.1, 14.1]]],
  towns: [{ name: 'TestTown', lat: 40.0, lon: 14.0 }],
  apiEndpoint: 'https://example.com/fdsnws/event/1/query',
  apiFormat: 'fdsn-text',
  defaultTimeRangeDays: 30,
  cameraDistance: 15,
};

describe('RegionRegistry', () => {
  it('registerRegion and getRegion round-trip', () => {
    registerRegion(mockConfig);
    const result = getRegion('test-region');
    expect(result).toBe(mockConfig);
  });

  it('getRegion returns undefined for unknown id', () => {
    expect(getRegion('non-existent-region')).toBeUndefined();
  });

  it('getAllRegions includes registered regions', () => {
    registerRegion(mockConfig);
    const all = getAllRegions();
    expect(all.some(r => r.id === 'test-region')).toBe(true);
  });

  it('getDefaultRegionId returns campi-flegrei', () => {
    expect(getDefaultRegionId()).toBe('campi-flegrei');
  });

  it('registering a region with the same id overwrites', () => {
    const updated: RegionConfig = { ...mockConfig, title: 'Updated' };
    registerRegion(mockConfig);
    registerRegion(updated);
    expect(getRegion('test-region')?.title).toBe('Updated');
  });
});
