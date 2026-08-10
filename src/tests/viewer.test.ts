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

  it('should add semi-transparent reference plane at y=0', () => {
    const config = createViewerConfig(container);
    viewer = new Viewer(config);
    viewer.init();

    const scene = viewer.getScene();
    const plane = scene.getObjectByName('referencePlane') as THREE.Mesh;
    expect(plane).toBeDefined();
    expect(plane.position.y).toBe(0);

    const material = plane.material as THREE.MeshStandardMaterial;
    expect(material.transparent).toBe(true);
    expect(material.opacity).toBeLessThan(1);
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
});
