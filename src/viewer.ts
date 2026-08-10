import * as THREE from 'three';
import { EarthquakeEvent, GeoBounds, VisibleEvent } from './types';

export interface ViewerConfig {
  container: HTMLElement;
  centerLat: number;   // 40.827
  centerLon: number;   // 14.139
  bounds: GeoBounds;
}

/**
 * 3D Viewer managing the Three.js scene, camera, renderer, and base scene elements.
 * Renders earthquake events as 3D points beneath a semi-transparent reference plane.
 */
export class Viewer {
  private config: ViewerConfig;
  private renderer!: THREE.WebGLRenderer;
  private camera!: THREE.PerspectiveCamera;
  private scene!: THREE.Scene;
  private animationFrameId: number | null = null;

  // Depth axis elements (for dynamic updates)
  private depthAxisGroup!: THREE.Group;
  private currentMaxDepth = 5; // default 5km

  // Callbacks
  private interactionStartCallbacks: Array<() => void> = [];
  private interactionEndCallbacks: Array<() => void> = [];

  // Context lost/restored handling
  private contextLostHandler: ((e: Event) => void) | null = null;
  private contextRestoredHandler: ((e: Event) => void) | null = null;
  private resizeHandler: (() => void) | null = null;

  // Tooltip element
  private tooltipEl: HTMLDivElement | null = null;

  constructor(config: ViewerConfig) {
    this.config = config;
  }

  /**
   * Initialize renderer, camera, scene, lights, reference plane, and depth axis.
   * Attaches event listeners for resize and WebGL context events.
   */
  init(): void {
    this.initRenderer();
    this.initCamera();
    this.initScene();
    this.initLights();
    this.initReferencePlane();
    this.initDepthAxis();
    this.initEventListeners();
    this.startRenderLoop();
  }

  /**
   * Clean up all resources: renderer, scene, event listeners, animation frame.
   */
  dispose(): void {
    // Stop render loop
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    // Remove event listeners
    if (this.resizeHandler) {
      window.removeEventListener('resize', this.resizeHandler);
      this.resizeHandler = null;
    }

    const canvas = this.renderer?.domElement;
    if (canvas) {
      if (this.contextLostHandler) {
        canvas.removeEventListener('webglcontextlost', this.contextLostHandler);
        this.contextLostHandler = null;
      }
      if (this.contextRestoredHandler) {
        canvas.removeEventListener('webglcontextrestored', this.contextRestoredHandler);
        this.contextRestoredHandler = null;
      }
    }

    // Remove tooltip
    if (this.tooltipEl && this.tooltipEl.parentNode) {
      this.tooltipEl.parentNode.removeChild(this.tooltipEl);
      this.tooltipEl = null;
    }

    // Dispose Three.js objects
    if (this.scene) {
      this.disposeSceneObjects(this.scene);
    }
    this.renderer?.dispose();

    // Remove canvas from container
    if (canvas && canvas.parentNode) {
      canvas.parentNode.removeChild(canvas);
    }

    // Clear callbacks
    this.interactionStartCallbacks = [];
    this.interactionEndCallbacks = [];
  }

  /**
   * Update the rendered earthquake points. (Stub — implemented in task 5.1)
   */
  updateVisibleEvents(_events: VisibleEvent[]): void {
    // Stub: will be implemented in task 5.1
  }

  /**
   * Set the depth scale range and rebuild the depth axis.
   */
  setDepthScale(_minDepth: number, maxDepth: number): void {
    this.currentMaxDepth = maxDepth;
    this.rebuildDepthAxis();
  }

  /**
   * Display a tooltip for the given earthquake event at the screen position. (Stub — implemented in task 5.6)
   */
  showTooltip(_event: EarthquakeEvent, _screenPos: { x: number; y: number }): void {
    // Stub: will be implemented in task 5.6
  }

  /**
   * Hide the tooltip. (Stub — implemented in task 5.6)
   */
  hideTooltip(): void {
    // Stub: will be implemented in task 5.6
  }

  /**
   * Get the renderer's canvas element.
   */
  getCanvas(): HTMLCanvasElement {
    return this.renderer.domElement;
  }

  /**
   * Register a callback for when user interaction starts (e.g., mouse drag).
   */
  onInteractionStart(callback: () => void): void {
    this.interactionStartCallbacks.push(callback);
  }

  /**
   * Register a callback for when user interaction ends (e.g., mouse release).
   */
  onInteractionEnd(callback: () => void): void {
    this.interactionEndCallbacks.push(callback);
  }

  /**
   * Access the Three.js scene (useful for external modules like RotationEngine).
   */
  getScene(): THREE.Scene {
    return this.scene;
  }

  /**
   * Access the camera (useful for OrbitControls setup).
   */
  getCamera(): THREE.PerspectiveCamera {
    return this.camera;
  }

  /**
   * Access the renderer (useful for OrbitControls setup).
   */
  getRenderer(): THREE.WebGLRenderer {
    return this.renderer;
  }

  // --- Private methods ---

  private initRenderer(): void {
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
    });
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.setSize(
      this.config.container.clientWidth,
      this.config.container.clientHeight
    );
    this.config.container.appendChild(this.renderer.domElement);
  }

  private initCamera(): void {
    const aspect =
      this.config.container.clientWidth / this.config.container.clientHeight;
    this.camera = new THREE.PerspectiveCamera(60, aspect, 0.1, 1000);

    // Position camera to look at the caldera center from above and slightly offset
    this.camera.position.set(5, 8, 12);
    this.camera.lookAt(0, -2, 0);
  }

  private initScene(): void {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x1a1a2e);
  }

  private initLights(): void {
    // Ambient light for overall base illumination
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    this.scene.add(ambientLight);

    // Directional light for depth and shadow cues
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(5, 10, 7);
    this.scene.add(directionalLight);
  }

  private initReferencePlane(): void {
    // Semi-transparent plane at y=0 representing the earth's surface
    const planeSize = this.computePlaneSize();
    const geometry = new THREE.PlaneGeometry(planeSize.width, planeSize.height);
    const material = new THREE.MeshStandardMaterial({
      color: 0x4a7c59,
      transparent: true,
      opacity: 0.3,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const plane = new THREE.Mesh(geometry, material);
    // PlaneGeometry is created in XY plane, rotate to lie in XZ plane (horizontal)
    plane.rotation.x = -Math.PI / 2;
    plane.position.y = 0;
    plane.name = 'referencePlane';
    this.scene.add(plane);
  }

  private initDepthAxis(): void {
    this.depthAxisGroup = new THREE.Group();
    this.depthAxisGroup.name = 'depthAxis';
    this.scene.add(this.depthAxisGroup);
    this.rebuildDepthAxis();
  }

  private rebuildDepthAxis(): void {
    // Clear existing axis objects
    while (this.depthAxisGroup.children.length > 0) {
      const child = this.depthAxisGroup.children[0]!;
      this.depthAxisGroup.remove(child);
      if (child instanceof THREE.Mesh || child instanceof THREE.Line) {
        child.geometry.dispose();
        if (Array.isArray(child.material)) {
          child.material.forEach((m) => m.dispose());
        } else {
          child.material.dispose();
        }
      }
    }

    // Determine max depth for the axis (at least 2km)
    const maxDepth = Math.max(this.currentMaxDepth, 2);
    const depthStepKm = this.computeDepthStep(maxDepth);

    // Scale factor: 1 scene unit = 0.5km → depth in km * 2 = scene units
    const scaleFactor = 2;

    // Vertical main axis line
    const axisPoints = [
      new THREE.Vector3(-5, 0, -5),
      new THREE.Vector3(-5, -maxDepth * scaleFactor, -5),
    ];
    const axisGeometry = new THREE.BufferGeometry().setFromPoints(axisPoints);
    const axisMaterial = new THREE.LineBasicMaterial({ color: 0xaaaaaa });
    const axisLine = new THREE.Line(axisGeometry, axisMaterial);
    this.depthAxisGroup.add(axisLine);

    // Tick marks and labels at each depth step
    for (let depth = depthStepKm; depth <= maxDepth; depth += depthStepKm) {
      const y = -depth * scaleFactor;

      // Horizontal tick line
      const tickPoints = [
        new THREE.Vector3(-5.3, y, -5),
        new THREE.Vector3(-4.7, y, -5),
      ];
      const tickGeometry = new THREE.BufferGeometry().setFromPoints(tickPoints);
      const tickMaterial = new THREE.LineBasicMaterial({ color: 0xaaaaaa });
      const tickLine = new THREE.Line(tickGeometry, tickMaterial);
      this.depthAxisGroup.add(tickLine);

      // Horizontal guide line extending into the scene
      const guidePoints = [
        new THREE.Vector3(-5, y, -5),
        new THREE.Vector3(5, y, -5),
      ];
      const guideGeometry = new THREE.BufferGeometry().setFromPoints(guidePoints);
      const guideMaterial = new THREE.LineBasicMaterial({
        color: 0x555555,
        transparent: true,
        opacity: 0.4,
      });
      const guideLine = new THREE.Line(guideGeometry, guideMaterial);
      this.depthAxisGroup.add(guideLine);

      // Label using sprite (always faces camera)
      const label = this.createTextSprite(`${depth}km`);
      label.position.set(-6, y, -5);
      this.depthAxisGroup.add(label);
    }

    // Surface label
    const surfaceLabel = this.createTextSprite('0km');
    surfaceLabel.position.set(-6, 0, -5);
    this.depthAxisGroup.add(surfaceLabel);
  }

  private computeDepthStep(maxDepth: number): number {
    if (maxDepth <= 3) return 1;
    if (maxDepth <= 6) return 1;
    if (maxDepth <= 12) return 2;
    return 5;
  }

  private computePlaneSize(): { width: number; height: number } {
    // Compute plane size based on geographic bounds
    // Using ~1 unit = 100m approximation, scaled to bounding box
    const latRange = this.config.bounds.maxLat - this.config.bounds.minLat;
    const lonRange = this.config.bounds.maxLon - this.config.bounds.minLon;
    // 1 degree lat ≈ 111km, 1 degree lon ≈ 85km at this latitude
    const heightKm = latRange * 111;
    const widthKm = lonRange * 85;
    // Scale: 1 unit = 0.5km → multiply by 2
    return { width: widthKm * 2, height: heightKm * 2 };
  }

  private createTextSprite(text: string): THREE.Sprite {
    const canvas = document.createElement('canvas');
    const size = 128;
    canvas.width = size;
    canvas.height = size / 2;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.font = 'bold 24px Arial';
      ctx.fillStyle = '#cccccc';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, canvas.width / 2, canvas.height / 2);
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;

    const material = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthWrite: false,
    });
    const sprite = new THREE.Sprite(material);
    sprite.scale.set(2, 1, 1);
    return sprite;
  }

  private initEventListeners(): void {
    // Window resize
    this.resizeHandler = () => this.onWindowResize();
    window.addEventListener('resize', this.resizeHandler);

    // WebGL context lost
    this.contextLostHandler = (e: Event) => {
      e.preventDefault();
      console.warn('[Viewer] WebGL context lost');
      if (this.animationFrameId !== null) {
        cancelAnimationFrame(this.animationFrameId);
        this.animationFrameId = null;
      }
    };
    this.renderer.domElement.addEventListener(
      'webglcontextlost',
      this.contextLostHandler
    );

    // WebGL context restored
    this.contextRestoredHandler = () => {
      console.info('[Viewer] WebGL context restored');
      this.startRenderLoop();
    };
    this.renderer.domElement.addEventListener(
      'webglcontextrestored',
      this.contextRestoredHandler
    );
  }

  private onWindowResize(): void {
    const width = this.config.container.clientWidth;
    const height = this.config.container.clientHeight;

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  private startRenderLoop(): void {
    const render = () => {
      this.animationFrameId = requestAnimationFrame(render);
      this.renderer.render(this.scene, this.camera);
    };
    render();
  }

  private disposeSceneObjects(obj: THREE.Object3D): void {
    while (obj.children.length > 0) {
      const child = obj.children[0]!;
      this.disposeSceneObjects(child);
      obj.remove(child);
      if (child instanceof THREE.Mesh || child instanceof THREE.Line) {
        child.geometry?.dispose();
        if (Array.isArray(child.material)) {
          child.material.forEach((m) => m.dispose());
        } else {
          child.material?.dispose();
        }
      }
      if (child instanceof THREE.Sprite) {
        child.material?.map?.dispose();
        child.material?.dispose();
      }
    }
  }
}
