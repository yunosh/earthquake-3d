import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Viewer, ViewerConfig } from '../viewer';
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

describe('Viewer', () => {
  let container: HTMLElement;
  let viewer: Viewer | undefined;

  beforeEach(() => {
    container = createMockContainer();
  });

  afterEach(() => {
    if (viewer) {
      viewer.dispose();
      viewer = undefined;
    }
    if (container && container.parentNode) {
      container.parentNode.removeChild(container);
    }
  });

  it('should create a Viewer instance without errors', () => {
    const config = createViewerConfig(container);
    viewer = new Viewer(config);
    expect(viewer).toBeDefined();
  });

  it('should initialize and attach canvas to container', () => {
    const config = createViewerConfig(container);
    viewer = new Viewer(config);
    viewer.init();

    const canvas = viewer.getCanvas();
    expect(canvas).toBeInstanceOf(HTMLCanvasElement);
    expect(container.contains(canvas)).toBe(true);
  });

  it('should set up PerspectiveCamera with FOV 60', () => {
    const config = createViewerConfig(container);
    viewer = new Viewer(config);
    viewer.init();

    const camera = viewer.getCamera();
    expect(camera).toBeInstanceOf(THREE.PerspectiveCamera);
    expect(camera.fov).toBe(60);
    expect(camera.aspect).toBeCloseTo(800 / 600);
  });

  it('should create scene with dark background', () => {
    const config = createViewerConfig(container);
    viewer = new Viewer(config);
    viewer.init();

    const scene = viewer.getScene();
    expect(scene).toBeInstanceOf(THREE.Scene);
    expect(scene.background).toBeInstanceOf(THREE.Color);
  });

  it('should add AmbientLight and DirectionalLight to scene', () => {
    const config = createViewerConfig(container);
    viewer = new Viewer(config);
    viewer.init();

    const scene = viewer.getScene();
    const lights = scene.children.filter(
      (c) => c instanceof THREE.AmbientLight || c instanceof THREE.DirectionalLight
    );
    expect(lights.length).toBe(2);

    const ambient = scene.children.find((c) => c instanceof THREE.AmbientLight);
    const directional = scene.children.find((c) => c instanceof THREE.DirectionalLight);
    expect(ambient).toBeDefined();
    expect(directional).toBeDefined();
  });

  it('should add depth axis group with guide lines and labels', () => {
    const config = createViewerConfig(container);
    viewer = new Viewer(config);
    viewer.init();

    const scene = viewer.getScene();
    const depthAxis = scene.getObjectByName('depthAxis') as THREE.Group;
    expect(depthAxis).toBeDefined();
    // Should have at least: main axis line + ticks + guides + labels
    expect(depthAxis.children.length).toBeGreaterThan(0);
  });

  it('should rebuild depth axis when setDepthScale is called', () => {
    const config = createViewerConfig(container);
    viewer = new Viewer(config);
    viewer.init();

    const scene = viewer.getScene();
    const depthAxis = scene.getObjectByName('depthAxis') as THREE.Group;

    // Set a different depth range and verify it still has content
    viewer.setDepthScale(0, 15);
    const childCount = depthAxis.children.length;
    expect(childCount).toBeGreaterThan(0);

    // Rebuild again with a smaller range
    viewer.setDepthScale(0, 2);
    const smallerCount = depthAxis.children.length;
    expect(smallerCount).toBeGreaterThan(0);
    // 2km with step 1 produces fewer elements than 15km with step 5
    expect(smallerCount).not.toBe(childCount);
  });

  it('should register interaction callbacks', () => {
    const config = createViewerConfig(container);
    viewer = new Viewer(config);
    viewer.init();

    const startCb = vi.fn();
    const endCb = vi.fn();
    viewer.onInteractionStart(startCb);
    viewer.onInteractionEnd(endCb);

    // Callbacks are registered (not called until interaction)
    expect(startCb).not.toHaveBeenCalled();
    expect(endCb).not.toHaveBeenCalled();
  });

  it('should clean up on dispose without errors', () => {
    const config = createViewerConfig(container);
    viewer = new Viewer(config);
    viewer.init();

    expect(() => viewer!.dispose()).not.toThrow();

    // Canvas should be removed from container
    expect(container.querySelector('canvas')).toBeNull();
  });

  it('should handle dispose called multiple times gracefully', () => {
    const config = createViewerConfig(container);
    viewer = new Viewer(config);
    viewer.init();

    viewer.dispose();
    expect(() => viewer!.dispose()).not.toThrow();
  });

  describe('Tooltip', () => {
    it('should show tooltip with formatted event data', () => {
      const config = createViewerConfig(container);
      viewer = new Viewer(config);
      viewer.init();

      const event = {
        id: 'test-1',
        timestamp: new Date('2024-03-15T10:30:00Z'),
        latitude: 40.83,
        longitude: 14.15,
        depth: 2.567,
        magnitude: 3.2,
        magnitudeType: 'Md',
        locationName: 'Campi Flegrei',
      };

      viewer.showTooltip(event, { x: 100, y: 200 });

      const tooltip = container.querySelector('.earthquake-tooltip') as HTMLDivElement;
      expect(tooltip).toBeDefined();
      expect(tooltip.style.display).toBe('block');
      expect(tooltip.innerHTML).toContain('3.2');      // magnitude 1 decimal
      expect(tooltip.innerHTML).toContain('2.57');     // depth 2 decimals
      expect(tooltip.innerHTML).toContain('2024-03-15T10:30:00.000Z'); // ISO 8601
    });

    it('should position tooltip near cursor with offset', () => {
      const config = createViewerConfig(container);
      viewer = new Viewer(config);
      viewer.init();

      const event = {
        id: 'test-1',
        timestamp: new Date('2024-03-15T10:30:00Z'),
        latitude: 40.83,
        longitude: 14.15,
        depth: 2.0,
        magnitude: 1.5,
        magnitudeType: 'Md',
        locationName: 'Campi Flegrei',
      };

      viewer.showTooltip(event, { x: 150, y: 250 });

      const tooltip = container.querySelector('.earthquake-tooltip') as HTMLDivElement;
      expect(tooltip.style.left).toBe('165px'); // 150 + 15 offset
      expect(tooltip.style.top).toBe('265px');  // 250 + 15 offset
    });

    it('should hide tooltip', () => {
      const config = createViewerConfig(container);
      viewer = new Viewer(config);
      viewer.init();

      const event = {
        id: 'test-1',
        timestamp: new Date('2024-03-15T10:30:00Z'),
        latitude: 40.83,
        longitude: 14.15,
        depth: 2.0,
        magnitude: 1.5,
        magnitudeType: 'Md',
        locationName: 'Campi Flegrei',
      };

      // Show and then hide
      viewer.showTooltip(event, { x: 100, y: 200 });
      viewer.hideTooltip();

      const tooltip = container.querySelector('.earthquake-tooltip') as HTMLDivElement;
      expect(tooltip.style.display).toBe('none');
    });

    it('should reuse existing tooltip element on subsequent calls', () => {
      const config = createViewerConfig(container);
      viewer = new Viewer(config);
      viewer.init();

      const event = {
        id: 'test-1',
        timestamp: new Date('2024-03-15T10:30:00Z'),
        latitude: 40.83,
        longitude: 14.15,
        depth: 2.0,
        magnitude: 1.5,
        magnitudeType: 'Md',
        locationName: 'Campi Flegrei',
      };

      viewer.showTooltip(event, { x: 100, y: 200 });
      viewer.showTooltip(event, { x: 200, y: 300 });

      const tooltips = container.querySelectorAll('.earthquake-tooltip');
      expect(tooltips.length).toBe(1);
    });

    it('should display original magnitude in tooltip even if clamped for rendering', () => {
      const config = createViewerConfig(container);
      viewer = new Viewer(config);
      viewer.init();

      const event = {
        id: 'test-1',
        timestamp: new Date('2024-03-15T10:30:00Z'),
        latitude: 40.83,
        longitude: 14.15,
        depth: 5.0,
        magnitude: 5.7, // Outside 0-4 range (clamped for rendering, original in tooltip)
        magnitudeType: 'Md',
        locationName: 'Campi Flegrei',
      };

      viewer.showTooltip(event, { x: 100, y: 200 });

      const tooltip = container.querySelector('.earthquake-tooltip') as HTMLDivElement;
      expect(tooltip.innerHTML).toContain('5.7'); // Original value shown
    });

    it('should remove tooltip on dispose', () => {
      const config = createViewerConfig(container);
      viewer = new Viewer(config);
      viewer.init();

      const event = {
        id: 'test-1',
        timestamp: new Date('2024-03-15T10:30:00Z'),
        latitude: 40.83,
        longitude: 14.15,
        depth: 2.0,
        magnitude: 1.5,
        magnitudeType: 'Md',
        locationName: 'Campi Flegrei',
      };

      viewer.showTooltip(event, { x: 100, y: 200 });
      viewer.dispose();

      const tooltip = container.querySelector('.earthquake-tooltip');
      expect(tooltip).toBeNull();
    });

    it('should attach pointermove listener on init', () => {
      const config = createViewerConfig(container);
      viewer = new Viewer(config);

      const addEventListenerSpy = vi.spyOn(HTMLCanvasElement.prototype, 'addEventListener');
      viewer.init();

      const pointerMoveCall = addEventListenerSpy.mock.calls.find(
        (call) => call[0] === 'pointermove'
      );
      expect(pointerMoveCall).toBeDefined();

      addEventListenerSpy.mockRestore();
    });
  });
});

describe('Viewer.updateVisibleEvents', () => {
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

  function makeVisibleEvent(overrides?: Partial<{
    id: string;
    lat: number;
    lon: number;
    depth: number;
    magnitude: number;
    age: number;
    isNew: boolean;
    highlightProgress: number;
  }>) {
    return {
      event: {
        id: overrides?.id ?? 'ev1',
        timestamp: new Date('2024-01-01T12:00:00Z'),
        latitude: overrides?.lat ?? 40.84,
        longitude: overrides?.lon ?? 14.15,
        depth: overrides?.depth ?? 3.0,
        magnitude: overrides?.magnitude ?? 2.0,
        magnitudeType: 'Md',
        locationName: 'Campi Flegrei',
      },
      age: overrides?.age ?? 0.5,
      isNew: overrides?.isNew ?? false,
      highlightProgress: overrides?.highlightProgress ?? 1.0,
    };
  }

  it('should create InstancedMesh on first call', () => {
    const scene = viewer.getScene();
    const meshBefore = scene.getObjectByName('earthquakePoints');
    expect(meshBefore).toBeUndefined();

    viewer.updateVisibleEvents([makeVisibleEvent()]);

    const meshAfter = scene.getObjectByName('earthquakePoints');
    expect(meshAfter).toBeDefined();
    expect(meshAfter).toBeInstanceOf(THREE.InstancedMesh);
  });

  it('should set instance count to the number of visible events', () => {
    const events = [
      makeVisibleEvent({ id: 'ev1', lat: 40.83 }),
      makeVisibleEvent({ id: 'ev2', lat: 40.84 }),
      makeVisibleEvent({ id: 'ev3', lat: 40.85 }),
    ];

    viewer.updateVisibleEvents(events);

    const scene = viewer.getScene();
    const mesh = scene.getObjectByName('earthquakePoints') as THREE.InstancedMesh;
    expect(mesh.count).toBe(3);
  });

  it('should set instance count to 0 when no events provided', () => {
    // First call creates the mesh
    viewer.updateVisibleEvents([makeVisibleEvent()]);
    // Second call with empty array
    viewer.updateVisibleEvents([]);

    const scene = viewer.getScene();
    const mesh = scene.getObjectByName('earthquakePoints') as THREE.InstancedMesh;
    expect(mesh.count).toBe(0);
  });

  it('should cap instances at MAX_INSTANCES (1000)', () => {
    const events = Array.from({ length: 1200 }, (_, i) =>
      makeVisibleEvent({ id: `ev${i}`, lat: 40.78 + (i % 120) * 0.001 })
    );

    viewer.updateVisibleEvents(events);

    const scene = viewer.getScene();
    const mesh = scene.getObjectByName('earthquakePoints') as THREE.InstancedMesh;
    expect(mesh.count).toBe(1000);
  });

  it('should apply highlight scale for new events', () => {
    const normalEvent = makeVisibleEvent({ id: 'normal', isNew: false, highlightProgress: 1.0 });
    const newEvent = makeVisibleEvent({ id: 'new', isNew: true, highlightProgress: 0.0 });

    viewer.updateVisibleEvents([normalEvent, newEvent]);

    const scene = viewer.getScene();
    const mesh = scene.getObjectByName('earthquakePoints') as THREE.InstancedMesh;

    // Extract matrices and compare scales
    const matrixNormal = new THREE.Matrix4();
    const matrixNew = new THREE.Matrix4();
    mesh.getMatrixAt(0, matrixNormal);
    mesh.getMatrixAt(1, matrixNew);

    const scaleNormal = new THREE.Vector3();
    const scaleNew = new THREE.Vector3();
    matrixNormal.decompose(new THREE.Vector3(), new THREE.Quaternion(), scaleNormal);
    matrixNew.decompose(new THREE.Vector3(), new THREE.Quaternion(), scaleNew);

    // New event at highlightProgress=0 should be 1.5x scaled compared to normal
    // (same magnitude, same base scale)
    expect(scaleNew.x / scaleNormal.x).toBeCloseTo(1.5, 1);
  });

  it('should reuse InstancedMesh across multiple calls', () => {
    viewer.updateVisibleEvents([makeVisibleEvent()]);
    const scene = viewer.getScene();
    const mesh1 = scene.getObjectByName('earthquakePoints');

    viewer.updateVisibleEvents([makeVisibleEvent(), makeVisibleEvent({ id: 'ev2', lat: 40.85 })]);
    const mesh2 = scene.getObjectByName('earthquakePoints');

    expect(mesh1).toBe(mesh2);
  });

  it('should set per-instance color', () => {
    viewer.updateVisibleEvents([makeVisibleEvent({ age: 0.0 })]);

    const scene = viewer.getScene();
    const mesh = scene.getObjectByName('earthquakePoints') as THREE.InstancedMesh;
    expect(mesh.instanceColor).toBeDefined();

    const color = new THREE.Color();
    mesh.getColorAt(0, color);
    // Fresh event (age=0) should have color close to #FF4500 (hue ~16°/360 ≈ 0.045)
    const hsl = { h: 0, s: 0, l: 0 };
    color.getHSL(hsl);
    expect(hsl.h).toBeCloseTo(16.24 / 360, 1);
    expect(hsl.s).toBeCloseTo(1.0, 1);
  });
});
