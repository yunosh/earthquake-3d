import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Viewer, ViewerConfig } from '../viewer';
import { createCoordinateMapperConfig } from '../coordinate-mapper';
import type { RegionConfig } from '../region-config';
import * as THREE from 'three';

// Mock minimal DOM environment for Three.js WebGLRenderer
function createMockContainer(): HTMLElement {
  const container = document.createElement('div');
  Object.defineProperty(container, 'clientWidth', { value: 800, configurable: true });
  Object.defineProperty(container, 'clientHeight', { value: 600, configurable: true });
  document.body.appendChild(container);
  return container;
}

function createViewerConfig(container: HTMLElement): ViewerConfig {
  return {
    container,
    centerLat: 40.827,
    centerLon: 14.139,
    bounds: {
      minLat: 40.78,
      maxLat: 40.90,
      minLon: 14.03,
      maxLon: 14.22,
    },
  };
}

// Mock WebGLRenderer since jsdom doesn't support WebGL
vi.mock('three', async () => {
  const actual = await vi.importActual<typeof THREE>('three');

  class MockWebGLRenderer {
    domElement: HTMLCanvasElement;

    constructor() {
      this.domElement = document.createElement('canvas');
    }

    setPixelRatio(_ratio: number) {}
    setSize(_w: number, _h: number) {}
    render(_scene: THREE.Scene, _camera: THREE.Camera) {}
    dispose() {}
  }

  return {
    ...actual,
    WebGLRenderer: MockWebGLRenderer,
  };
});

// A mock RegionConfig for the Canary Islands (simplified coastline for testing)
const mockCanaryConfig: RegionConfig = {
  id: 'canary-islands',
  title: 'Kanarische Inseln',
  center: { lat: 28.1, lon: -15.4 },
  bounds: { minLat: 27.5, maxLat: 29.5, minLon: -18.5, maxLon: -13.3 },
  coastlinePolylines: [
    // Simplified single island outline for testing
    [
      [28.0, -15.5],
      [28.2, -15.3],
      [28.1, -15.2],
      [28.0, -15.5],
    ],
    [
      [28.5, -16.3],
      [28.6, -16.1],
      [28.4, -16.0],
      [28.5, -16.3],
    ],
  ],
  towns: [
    { name: 'Las Palmas', lat: 28.1235, lon: -15.4363 },
    { name: 'Santa Cruz', lat: 28.4697, lon: -16.2546 },
  ],
  apiEndpoint: 'http://www.seismicportal.eu/fdsnws/event/1/query',
  apiFormat: 'fdsn-text',
  defaultTimeRangeDays: 90,
  cameraDistance: 60,
};

describe('Viewer.clearRegionElements', () => {
  let container: HTMLElement;
  let viewer: Viewer;

  beforeEach(() => {
    container = createMockContainer();
    const config = createViewerConfig(container);
    viewer = new Viewer(config);
    viewer.init();
  });

  afterEach(() => {
    viewer.dispose();
    if (container.parentNode) {
      container.parentNode.removeChild(container);
    }
  });

  it('should remove coastline objects from the scene', () => {
    const scene = viewer.getScene();

    // Verify coastline elements exist after init
    const coastlinesBefore = scene.children.filter((c) => c.name.startsWith('coastline'));
    expect(coastlinesBefore.length).toBeGreaterThan(0);

    viewer.clearRegionElements();

    const coastlinesAfter = scene.children.filter((c) => c.name.startsWith('coastline'));
    expect(coastlinesAfter.length).toBe(0);
  });

  it('should remove town dot and label objects from the scene', () => {
    const scene = viewer.getScene();

    // Verify town elements exist after init
    const townsBefore = scene.children.filter((c) => c.name.startsWith('town-'));
    expect(townsBefore.length).toBeGreaterThan(0);

    viewer.clearRegionElements();

    const townsAfter = scene.children.filter((c) => c.name.startsWith('town-'));
    expect(townsAfter.length).toBe(0);
  });

  it('should remove waterPlane from the scene', () => {
    const scene = viewer.getScene();

    expect(scene.getObjectByName('waterPlane')).toBeDefined();

    viewer.clearRegionElements();

    expect(scene.getObjectByName('waterPlane')).toBeUndefined();
  });

  it('should remove landPlane from the scene', () => {
    const scene = viewer.getScene();

    expect(scene.getObjectByName('landPlane')).toBeDefined();

    viewer.clearRegionElements();

    expect(scene.getObjectByName('landPlane')).toBeUndefined();
  });

  it('should remove earthquakePoints instanced mesh if present', () => {
    const scene = viewer.getScene();

    // Create earthquake points by calling updateVisibleEvents
    viewer.updateVisibleEvents([
      {
        event: {
          id: 'ev1',
          timestamp: new Date('2024-01-01T00:00:00Z'),
          latitude: 40.83,
          longitude: 14.15,
          depth: 2.0,
          magnitude: 2.0,
          magnitudeType: 'Md',
          locationName: 'Test',
        },
        age: 0.5,
        isNew: false,
        highlightProgress: 1.0,
      },
    ]);

    expect(scene.getObjectByName('earthquakePoints')).toBeDefined();

    viewer.clearRegionElements();

    expect(scene.getObjectByName('earthquakePoints')).toBeUndefined();
  });

  it('should not remove non-region elements like depthAxis and lights', () => {
    const scene = viewer.getScene();

    const depthAxisBefore = scene.getObjectByName('depthAxis');
    expect(depthAxisBefore).toBeDefined();

    const lightsBefore = scene.children.filter(
      (c) => c instanceof THREE.AmbientLight || c instanceof THREE.DirectionalLight
    );
    expect(lightsBefore.length).toBe(2);

    viewer.clearRegionElements();

    const depthAxisAfter = scene.getObjectByName('depthAxis');
    expect(depthAxisAfter).toBeDefined();

    const lightsAfter = scene.children.filter(
      (c) => c instanceof THREE.AmbientLight || c instanceof THREE.DirectionalLight
    );
    expect(lightsAfter.length).toBe(2);
  });
});

describe('Viewer.setupRegion', () => {
  let container: HTMLElement;
  let viewer: Viewer;

  beforeEach(() => {
    container = createMockContainer();
    const config = createViewerConfig(container);
    viewer = new Viewer(config);
    viewer.init();
  });

  afterEach(() => {
    viewer.dispose();
    if (container.parentNode) {
      container.parentNode.removeChild(container);
    }
  });

  it('should create new coastline elements from the provided config', () => {
    const scene = viewer.getScene();
    const mapperConfig = createCoordinateMapperConfig(
      mockCanaryConfig.center.lat,
      mockCanaryConfig.center.lon
    );

    viewer.setupRegion(mockCanaryConfig, mapperConfig);

    const coastlines = scene.children.filter((c) => c.name.startsWith('coastline'));
    // Should have one coastline line per polyline in the config
    expect(coastlines.length).toBe(mockCanaryConfig.coastlinePolylines.length);
  });

  it('should create new town elements from the provided config', () => {
    const scene = viewer.getScene();
    const mapperConfig = createCoordinateMapperConfig(
      mockCanaryConfig.center.lat,
      mockCanaryConfig.center.lon
    );

    viewer.setupRegion(mockCanaryConfig, mapperConfig);

    // Each town produces a dot and a label
    for (const town of mockCanaryConfig.towns) {
      const dot = scene.getObjectByName(`town-dot-${town.name}`);
      const label = scene.getObjectByName(`town-label-${town.name}`);
      expect(dot).toBeDefined();
      expect(label).toBeDefined();
    }
  });

  it('should create new surface planes (waterPlane and landPlane)', () => {
    const scene = viewer.getScene();
    const mapperConfig = createCoordinateMapperConfig(
      mockCanaryConfig.center.lat,
      mockCanaryConfig.center.lon
    );

    viewer.setupRegion(mockCanaryConfig, mapperConfig);

    expect(scene.getObjectByName('waterPlane')).toBeDefined();
    expect(scene.getObjectByName('landPlane')).toBeDefined();
  });

  it('should remove old region elements before creating new ones', () => {
    const scene = viewer.getScene();

    // Verify initial Campi Flegrei town elements exist
    const campiFlegeriTowns = scene.children.filter((c) => c.name === 'town-dot-Pozzuoli');
    expect(campiFlegeriTowns.length).toBe(1);

    const mapperConfig = createCoordinateMapperConfig(
      mockCanaryConfig.center.lat,
      mockCanaryConfig.center.lon
    );

    viewer.setupRegion(mockCanaryConfig, mapperConfig);

    // Old town elements should be gone
    expect(scene.getObjectByName('town-dot-Pozzuoli')).toBeUndefined();
    // New town elements should exist
    expect(scene.getObjectByName('town-dot-Las Palmas')).toBeDefined();
  });

  it('should update the camera position based on cameraDistance', () => {
    const camera = viewer.getCamera();
    const mapperConfig = createCoordinateMapperConfig(
      mockCanaryConfig.center.lat,
      mockCanaryConfig.center.lon
    );

    viewer.setupRegion(mockCanaryConfig, mapperConfig);

    // Camera should be repositioned using the config's cameraDistance (60)
    const d = mockCanaryConfig.cameraDistance;
    expect(camera.position.x).toBeCloseTo(d * 0.33, 1);
    expect(camera.position.y).toBeCloseTo(d * 0.53, 1);
    expect(camera.position.z).toBeCloseTo(d * 0.8, 1);
  });

  it('should preserve non-region elements (lights, depthAxis)', () => {
    const scene = viewer.getScene();
    const mapperConfig = createCoordinateMapperConfig(
      mockCanaryConfig.center.lat,
      mockCanaryConfig.center.lon
    );

    viewer.setupRegion(mockCanaryConfig, mapperConfig);

    expect(scene.getObjectByName('depthAxis')).toBeDefined();
    const lights = scene.children.filter(
      (c) => c instanceof THREE.AmbientLight || c instanceof THREE.DirectionalLight
    );
    expect(lights.length).toBe(2);
  });
});
