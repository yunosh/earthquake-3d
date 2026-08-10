import * as THREE from 'three';
import { EarthquakeEvent, GeoBounds, VisibleEvent, DepthScale } from './types';
import { geoToScene, computeDepthScale } from './coordinate-mapper';
import { createMagnitudeScale } from './magnitude-scale';
import { ageToThreeColor } from './color-mapper';
import { COASTLINE_POLYLINES } from './coastline-data';

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

  // InstancedMesh for earthquake points
  private static readonly MAX_INSTANCES = 1000;
  private instancedMesh: THREE.InstancedMesh | null = null;
  private sphereGeometry: THREE.SphereGeometry | null = null;
  private instanceMaterial: THREE.MeshStandardMaterial | null = null;
  private depthScale: DepthScale | null = null;

  // Callbacks
  private interactionStartCallbacks: Array<() => void> = [];
  private interactionEndCallbacks: Array<() => void> = [];

  // Context lost/restored handling
  private contextLostHandler: ((e: Event) => void) | null = null;
  private contextRestoredHandler: ((e: Event) => void) | null = null;
  private resizeHandler: (() => void) | null = null;

  // Tooltip element
  private tooltipEl: HTMLDivElement | null = null;

  // Raycasting for tooltip hover
  private raycaster = new THREE.Raycaster();
  private pointer = new THREE.Vector2();
  private currentVisibleEvents: EarthquakeEvent[] = [];
  private pointerMoveHandler: ((e: PointerEvent) => void) | null = null;
  private clickHandler: ((e: PointerEvent) => void) | null = null;

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
    this.initSurfacePlanes();
    this.initCoastline();
    this.initTownLabels();
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
      if (this.pointerMoveHandler) {
        canvas.removeEventListener('pointermove', this.pointerMoveHandler);
        this.pointerMoveHandler = null;
      }
      if (this.clickHandler) {
        canvas.removeEventListener('pointerdown', this.clickHandler);
        this.clickHandler = null;
      }
    }

    // Remove tooltip
    if (this.tooltipEl && this.tooltipEl.parentNode) {
      this.tooltipEl.parentNode.removeChild(this.tooltipEl);
      this.tooltipEl = null;
    }

    // Dispose InstancedMesh resources
    if (this.instancedMesh) {
      this.scene.remove(this.instancedMesh);
      this.instancedMesh.dispose();
      this.instancedMesh = null;
    }
    if (this.sphereGeometry) {
      this.sphereGeometry.dispose();
      this.sphereGeometry = null;
    }
    if (this.instanceMaterial) {
      this.instanceMaterial.dispose();
      this.instanceMaterial = null;
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
   * Update the rendered earthquake points using InstancedMesh for performance.
   * Computes per-instance position, scale (magnitude + highlight), and color (age).
   */
  updateVisibleEvents(events: VisibleEvent[]): void {
    // Store events for tooltip raycasting (instance index → earthquake event)
    this.currentVisibleEvents = events.map((ve) => ve.event);

    // Lazily create the InstancedMesh on first call
    if (!this.instancedMesh) {
      this.initInstancedMesh();
    }

    const mesh = this.instancedMesh!;
    const magnitudeScale = createMagnitudeScale();

    // Compute depth scale from visible events if not set yet
    if (!this.depthScale || events.length > 0) {
      this.depthScale = computeDepthScale(events.map((ve) => ve.event));
    }

    const count = Math.min(events.length, Viewer.MAX_INSTANCES);
    const dummy = new THREE.Object3D();

    for (let i = 0; i < count; i++) {
      const ve = events[i]!;
      const ev = ve.event;

      // Compute scene position from geo coordinates
      const pos = geoToScene(
        ev.latitude,
        ev.longitude,
        ev.depth,
        this.config.bounds,
        this.depthScale
      );

      // Compute fixed world-space radius from magnitude
      // magnitudeScale.toRadius gives 2-16px range, map to 0.05-0.4 world units
      const screenPx = magnitudeScale.toRadius(ev.magnitude);
      const worldRadius = screenPx * 0.06; // 2px→0.12, 16px→0.96 world units

      // Apply highlight scale pulse: if isNew, scale = 1.5 - 0.5 * highlightProgress
      let scale = worldRadius;
      if (ve.isNew) {
        const highlightMultiplier = 1.5 - 0.5 * ve.highlightProgress;
        scale *= highlightMultiplier;
      }

      // Set transform matrix
      dummy.position.set(pos.x, pos.y, pos.z);
      dummy.scale.set(scale, scale, scale);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);

      // Set per-instance color from age
      const threeColor = ageToThreeColor(ve.age);
      mesh.setColorAt(i, threeColor);
    }

    // Update instance count and flag buffers for GPU upload
    mesh.count = count;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) {
      mesh.instanceColor.needsUpdate = true;
    }
  }

  /**
   * Initialize the InstancedMesh for earthquake point rendering.
   */
  private initInstancedMesh(): void {
    // SphereGeometry with unit radius (scaled per-instance)
    this.sphereGeometry = new THREE.SphereGeometry(1, 16, 12);

    // MeshStandardMaterial to interact with scene lighting
    this.instanceMaterial = new THREE.MeshStandardMaterial({
      roughness: 0.5,
      metalness: 0.1,
    });

    this.instancedMesh = new THREE.InstancedMesh(
      this.sphereGeometry,
      this.instanceMaterial,
      Viewer.MAX_INSTANCES
    );
    this.instancedMesh.count = 0; // Start with no visible instances
    this.instancedMesh.name = 'earthquakePoints';

    // Enable per-instance color
    this.instancedMesh.instanceColor = new THREE.InstancedBufferAttribute(
      new Float32Array(Viewer.MAX_INSTANCES * 3),
      3
    );

    this.scene.add(this.instancedMesh);
  }

  /**
   * Set the depth scale range and rebuild the depth axis.
   */
  setDepthScale(_minDepth: number, maxDepth: number): void {
    this.currentMaxDepth = maxDepth;
    this.rebuildDepthAxis();
  }

  /**
   * Display a tooltip for the given earthquake event at the screen position.
   */
  showTooltip(event: EarthquakeEvent, screenPos: { x: number; y: number }): void {
    if (!this.tooltipEl) {
      this.tooltipEl = document.createElement('div');
      this.tooltipEl.className = 'earthquake-tooltip';
      this.tooltipEl.style.position = 'absolute';
      this.tooltipEl.style.pointerEvents = 'none';
      this.tooltipEl.style.background = 'rgba(0, 0, 0, 0.85)';
      this.tooltipEl.style.color = '#ffffff';
      this.tooltipEl.style.padding = '8px 12px';
      this.tooltipEl.style.borderRadius = '4px';
      this.tooltipEl.style.fontSize = '13px';
      this.tooltipEl.style.lineHeight = '1.4';
      this.tooltipEl.style.whiteSpace = 'nowrap';
      this.tooltipEl.style.zIndex = '1000';
      this.config.container.appendChild(this.tooltipEl);
    }

    // Format tooltip content
    const magnitude = event.magnitude.toFixed(1);
    const depth = event.depth.toFixed(2);
    const timestamp = event.timestamp.toISOString();

    this.tooltipEl.innerHTML = `
      <strong>Magnitude:</strong> ${magnitude}<br>
      <strong>Depth:</strong> ${depth} km<br>
      <strong>Time:</strong> ${timestamp}
    `.trim();

    // Position near the cursor with a small offset
    const offsetX = 15;
    const offsetY = 15;
    this.tooltipEl.style.left = `${screenPos.x + offsetX}px`;
    this.tooltipEl.style.top = `${screenPos.y + offsetY}px`;
    this.tooltipEl.style.display = 'block';
  }

  /**
   * Hide the tooltip.
   */
  hideTooltip(): void {
    if (this.tooltipEl) {
      this.tooltipEl.style.display = 'none';
    }
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

  private initSurfacePlanes(): void {
    const surfaceDepthScale: DepthScale = {
      minDepth: 0,
      maxDepth: 2,
      sceneMinY: -4,
      sceneMaxY: 0,
      toSceneY: (_d: number) => 0,
    };

    // Get bounds corners in scene coordinates
    const nw = geoToScene(this.config.bounds.maxLat, this.config.bounds.minLon, 0, this.config.bounds, surfaceDepthScale);
    const ne = geoToScene(this.config.bounds.maxLat, this.config.bounds.maxLon, 0, this.config.bounds, surfaceDepthScale);
    const se = geoToScene(this.config.bounds.minLat, this.config.bounds.maxLon, 0, this.config.bounds, surfaceDepthScale);
    const sw = geoToScene(this.config.bounds.minLat, this.config.bounds.minLon, 0, this.config.bounds, surfaceDepthScale);

    // Water plane (covers entire bounds)
    const waterShape = new THREE.Shape();
    waterShape.moveTo(nw.x, -nw.z);
    waterShape.lineTo(ne.x, -ne.z);
    waterShape.lineTo(se.x, -se.z);
    waterShape.lineTo(sw.x, -sw.z);
    waterShape.closePath();

    const waterGeometry = new THREE.ShapeGeometry(waterShape);
    const waterMaterial = new THREE.MeshBasicMaterial({
      color: 0x1a3a5c,
      transparent: true,
      opacity: 0.4,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const waterMesh = new THREE.Mesh(waterGeometry, waterMaterial);
    waterMesh.rotation.x = -Math.PI / 2;
    waterMesh.position.y = -0.01;
    waterMesh.name = 'waterPlane';
    this.scene.add(waterMesh);

    // Land shape (north of coastline)
    const mainCoast = COASTLINE_POLYLINES[0];
    const coastScenePoints = mainCoast.map(([lat, lon]) => {
      const p = geoToScene(lat, lon, 0, this.config.bounds, surfaceDepthScale);
      return { x: p.x, z: p.z };
    });

    // Build land polygon: westernmost coast point → NW corner → NE corner → easternmost coast point → follow coast back
    const landShape = new THREE.Shape();
    const firstCoast = coastScenePoints[0];
    const lastCoast = coastScenePoints[coastScenePoints.length - 1];

    landShape.moveTo(firstCoast.x, -firstCoast.z);
    // Up to northwest corner (same x as first coast point, max z)
    landShape.lineTo(nw.x, -nw.z);
    // Along top to northeast
    landShape.lineTo(ne.x, -ne.z);
    // Down to last coast point
    landShape.lineTo(lastCoast.x, -lastCoast.z);
    // Follow coastline from east to west (reverse order)
    for (let i = coastScenePoints.length - 1; i >= 0; i--) {
      landShape.lineTo(coastScenePoints[i].x, -coastScenePoints[i].z);
    }
    landShape.closePath();

    const landGeometry = new THREE.ShapeGeometry(landShape);
    const landMaterial = new THREE.MeshBasicMaterial({
      color: 0x2d5a3a,
      transparent: true,
      opacity: 0.35,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const landMesh = new THREE.Mesh(landGeometry, landMaterial);
    landMesh.rotation.x = -Math.PI / 2;
    landMesh.position.y = 0.005;
    landMesh.name = 'landPlane';
    this.scene.add(landMesh);
  }

  private initCoastline(): void {
    // Use a surface depth scale (coastline is at the surface)
    const surfaceDepthScale: DepthScale = {
      minDepth: 0,
      maxDepth: 2,
      sceneMinY: -4,
      sceneMaxY: 0,
      toSceneY: (_d: number) => 0,
    };

    const material = new THREE.LineBasicMaterial({
      color: 0x4dc9c9, // teal
      transparent: true,
      opacity: 0.6,
    });

    for (const polyline of COASTLINE_POLYLINES) {
      const points: THREE.Vector3[] = [];
      for (const [lat, lon] of polyline) {
        const pos = geoToScene(lat, lon, 0, this.config.bounds, surfaceDepthScale);
        points.push(new THREE.Vector3(pos.x, 0.01, pos.z)); // slightly above reference plane
      }
      const geometry = new THREE.BufferGeometry().setFromPoints(points);
      const line = new THREE.Line(geometry, material);
      line.name = 'coastline';
      this.scene.add(line);
    }
  }

  private initTownLabels(): void {
    const surfaceDepthScale: DepthScale = {
      minDepth: 0,
      maxDepth: 2,
      sceneMinY: -4,
      sceneMaxY: 0,
      toSceneY: (_d: number) => 0,
    };

    const towns: { name: string; lat: number; lon: number }[] = [
      { name: 'Pozzuoli', lat: 40.822, lon: 14.122 },
      { name: 'Bacoli', lat: 40.800, lon: 14.070 },
      { name: 'Baia', lat: 40.813, lon: 14.075 },
      { name: 'Quarto', lat: 40.876, lon: 14.145 },
      { name: 'Monte di Procida', lat: 40.798, lon: 14.050 },
      { name: 'Bagnoli', lat: 40.808, lon: 14.168 },
      { name: 'Solfatara', lat: 40.828, lon: 14.139 },
    ];

    const dotGeometry = new THREE.SphereGeometry(0.12, 8, 6);
    const dotMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });

    for (const town of towns) {
      const pos = geoToScene(town.lat, town.lon, 0, this.config.bounds, surfaceDepthScale);

      // Small white dot
      const dot = new THREE.Mesh(dotGeometry, dotMaterial);
      dot.position.set(pos.x, 0.05, pos.z);
      dot.name = `town-dot-${town.name}`;
      this.scene.add(dot);

      // Text label above the dot
      const label = this.createTownLabel(town.name);
      label.position.set(pos.x, 0.6, pos.z);
      label.name = `town-label-${town.name}`;
      this.scene.add(label);
    }
  }

  private createTownLabel(text: string): THREE.Sprite {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.font = '20px Arial';
      ctx.fillStyle = '#e0e0e0';
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
      depthTest: false,
    });
    const sprite = new THREE.Sprite(material);
    sprite.scale.set(3, 0.75, 1);
    return sprite;
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

    // Pointermove for tooltip raycasting
    this.pointerMoveHandler = (e: PointerEvent) => this.onPointerMove(e);
    this.renderer.domElement.addEventListener(
      'pointermove',
      this.pointerMoveHandler
    );

    // Click for persistent tooltip on earthquake points
    this.clickHandler = (e: PointerEvent) => this.onPointerClick(e);
    this.renderer.domElement.addEventListener('pointerdown', this.clickHandler);
  }

  private onPointerMove(e: PointerEvent): void {
    if (!this.instancedMesh || this.currentVisibleEvents.length === 0) {
      this.hideTooltip();
      return;
    }

    const canvas = this.renderer.domElement;
    const rect = canvas.getBoundingClientRect();

    // Convert pointer position to normalized device coordinates (-1 to +1)
    this.pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    // Perform raycasting
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const intersects = this.raycaster.intersectObject(this.instancedMesh);

    if (intersects.length > 0) {
      const hit = intersects[0]!;
      const instanceId = hit.instanceId;

      if (instanceId !== undefined && instanceId < this.currentVisibleEvents.length) {
        const event = this.currentVisibleEvents[instanceId]!;
        // Screen position relative to container
        const screenPos = {
          x: e.clientX - rect.left,
          y: e.clientY - rect.top,
        };
        this.showTooltip(event, screenPos);
        return;
      }
    }

    this.hideTooltip();
  }

  private onPointerClick(e: PointerEvent): void {
    if (!this.instancedMesh || this.currentVisibleEvents.length === 0) {
      this.hideTooltip();
      return;
    }

    const canvas = this.renderer.domElement;
    const rect = canvas.getBoundingClientRect();

    this.pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.pointer, this.camera);
    const intersects = this.raycaster.intersectObject(this.instancedMesh);

    if (intersects.length > 0) {
      const hit = intersects[0]!;
      const instanceId = hit.instanceId;

      if (instanceId !== undefined && instanceId < this.currentVisibleEvents.length) {
        const event = this.currentVisibleEvents[instanceId]!;
        const screenPos = {
          x: e.clientX - rect.left,
          y: e.clientY - rect.top,
        };
        this.showTooltip(event, screenPos);
        return;
      }
    }

    this.hideTooltip();
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
