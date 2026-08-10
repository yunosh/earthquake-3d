import './style.css';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { DataFetcher } from './data-fetcher';
import { Viewer } from './viewer';
import { AnimationController } from './animation-controller';
import { RotationEngine } from './rotation-engine';
import { TimeSlider } from './ui/time-slider';
import { RegionSwitcher } from './ui/region-switcher';
import { computeDepthScale, createCoordinateMapperConfig } from './coordinate-mapper';
import { registerRegion, getRegion, getAllRegions, getDefaultRegionId } from './region-registry';
import { campiFlegrei } from './regions/campi-flegrei';
import { canaryIslands } from './regions/canary-islands';
import type { RegionConfig } from './region-config';
import type { VisibleEvent, FetchResult } from './types';

// --- Constants ---

const DEFAULT_ANIMATION_DURATION_SEC = 20; // 20s full playback at 1x speed
const DEFAULT_SPEED_MULTIPLIER = 1;
const WEBGL_RECOVERY_TIMEOUT_MS = 5000;

// --- WebGL Support Check ---

function isWebGLAvailable(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return !!(
      window.WebGLRenderingContext &&
      (canvas.getContext('webgl') || canvas.getContext('webgl2'))
    );
  } catch {
    return false;
  }
}

// --- Application Bootstrap ---

async function main(): Promise<void> {
  const appContainer = document.querySelector<HTMLDivElement>('#app');
  if (!appContainer) {
    console.error('[main] #app container not found');
    return;
  }

  // 1. WebGL availability check
  if (!isWebGLAvailable()) {
    appContainer.innerHTML = `
      <div class="webgl-error">
        <h2>WebGL nicht verfügbar</h2>
        <p>Ihr Browser unterstützt kein WebGL. Bitte verwenden Sie einen aktuellen Browser 
        (Chrome, Firefox, Safari oder Edge in der aktuellen Version).</p>
      </div>
    `;
    return;
  }

  // 2. Register all regions
  registerRegion(campiFlegrei);
  registerRegion(canaryIslands);

  // 3. Load default region
  const defaultRegionId = getDefaultRegionId();
  let activeRegion: RegionConfig = getRegion(defaultRegionId) ?? campiFlegrei;

  // 4. Create UI containers
  const viewerContainer = document.createElement('div');
  viewerContainer.id = 'viewer-container';
  appContainer.appendChild(viewerContainer);

  const uiContainer = document.createElement('div');
  uiContainer.id = 'ui-container';
  appContainer.appendChild(uiContainer);

  // 5. Initialize core modules with active region values
  const dataFetcher = new DataFetcher({
    endpoint: activeRegion.apiEndpoint,
    bounds: activeRegion.bounds,
  });

  let mapperConfig = createCoordinateMapperConfig(activeRegion.center.lat, activeRegion.center.lon);

  const viewer = new Viewer({
    container: viewerContainer,
    centerLat: activeRegion.center.lat,
    centerLon: activeRegion.center.lon,
    bounds: activeRegion.bounds,
  });
  viewer.init();

  // 6. Create RegionSwitcher in UI container
  const allRegions = getAllRegions();
  const regionSwitcher = new RegionSwitcher(uiContainer, allRegions.map(r => ({ id: r.id, title: r.title })));
  regionSwitcher.setActive(activeRegion.id);

  const timeSlider = new TimeSlider({
    container: uiContainer,
    minDate: new Date('2000-01-01T00:00:00Z'),
    maxDate: new Date(),
    defaultRange: activeRegion.defaultTimeRangeDays,
  });

  // 7. Set up OrbitControls on the Viewer's camera/renderer
  const controls = new OrbitControls(viewer.getCamera(), viewer.getRenderer().domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.target.set(0, -2, 0); // Look slightly below surface (center depth area)
  controls.update();

  // 8. Set up RotationEngine
  const rotationEngine = new RotationEngine(
    {
      degreesPerSecond: 10,
      resumeDelayMs: 3000,
      easeInDurationMs: 1000,
    },
    controls
  );

  // 9. Wire Viewer interaction events → RotationEngine
  viewer.onInteractionStart(() => rotationEngine.onInteractionStart());
  viewer.onInteractionEnd(() => rotationEngine.onInteractionEnd());

  // Also hook OrbitControls events for interaction detection
  controls.addEventListener('start', () => rotationEngine.onInteractionStart());
  controls.addEventListener('end', () => rotationEngine.onInteractionEnd());

  // 10. WebGL context lost/restored handling — notify user via TimeSlider
  let webglRecoveryTimeout: ReturnType<typeof setTimeout> | null = null;

  const canvas = viewer.getCanvas();

  canvas.addEventListener('webglcontextlost', (e: Event) => {
    e.preventDefault();
    timeSlider.showError('Rendering unterbrochen, Wiederherstellung...');

    // Set a 5s timeout for recovery attempt
    if (webglRecoveryTimeout !== null) {
      clearTimeout(webglRecoveryTimeout);
    }
    webglRecoveryTimeout = setTimeout(() => {
      timeSlider.showError(
        'WebGL-Kontext konnte nicht wiederhergestellt werden. Bitte laden Sie die Seite neu.'
      );
    }, WEBGL_RECOVERY_TIMEOUT_MS);
  });

  canvas.addEventListener('webglcontextrestored', () => {
    // Clear the recovery timeout
    if (webglRecoveryTimeout !== null) {
      clearTimeout(webglRecoveryTimeout);
      webglRecoveryTimeout = null;
    }
    timeSlider.showInfo('Rendering wiederhergestellt.');
  });

  // 11. AnimationController (initialized after data fetch)
  let animationController: AnimationController | null = null;

  // Frame callback: update Viewer and TimeSlider on each animation frame
  function onAnimationFrame(visibleEvents: VisibleEvent[], virtualTime: Date): void {
    viewer.updateVisibleEvents(visibleEvents);
    if (animationController) {
      timeSlider.setProgress(animationController.getProgress());
      // Reset play button when animation reaches the end
      if (animationController.getState() === 'paused' && animationController.getProgress() >= 1.0) {
        timeSlider.setPlaying(false);
      }
    }
    timeSlider.setVirtualTime(virtualTime);
  }

  /**
   * Process a FetchResult and display appropriate messages.
   */
  function handleFetchResult(result: FetchResult): void {
    if (result.failed) {
      timeSlider.showError(
        'Daten konnten nicht geladen werden. Bitte versuchen Sie es später erneut.'
      );
      return;
    }

    if (result.warnings.length > 0) {
      timeSlider.showWarning(
        `${result.warnings.length} Einträge konnten nicht verarbeitet werden.`
      );
    } else if (result.events.length === 0) {
      timeSlider.showInfo('Keine Erdbeben im gewählten Zeitraum gefunden.');
    } else {
      timeSlider.showInfo(`${result.events.length} Erdbeben geladen.`);
    }
  }

  /**
   * Fetch data and set up AnimationController for the current region/time range.
   */
  async function fetchAndSetupAnimation(): Promise<void> {
    timeSlider.setLoading(true);
    try {
      const result = await dataFetcher.fetch();

      handleFetchResult(result);

      if (result.events.length > 0) {
        // Compute and apply depth scale
        const depthScale = computeDepthScale(result.events);
        viewer.setDepthScale(depthScale.minDepth, depthScale.maxDepth);
      }

      // Create AnimationController with fetched events
      animationController = new AnimationController({
        events: result.events,
        defaultDurationSec: DEFAULT_ANIMATION_DURATION_SEC,
        speedMultiplier: DEFAULT_SPEED_MULTIPLIER,
      });
      animationController.onFrame(onAnimationFrame);
    } catch (error) {
      timeSlider.showError('Daten konnten nicht geladen werden. Bitte versuchen Sie es später erneut.');
      console.error('[main] Data fetch failed:', error);
    } finally {
      timeSlider.setLoading(false);
    }
  }

  // 12. Wire RegionSwitcher onChange → full region switch flow
  regionSwitcher.onChange(async (regionId: string) => {
    const newRegion = getRegion(regionId);
    if (!newRegion) {
      console.error(`[main] Unknown region: ${regionId}`);
      return;
    }

    // Disable switcher during transition
    regionSwitcher.setDisabled(true);

    // Abort any in-flight requests
    dataFetcher.abort();

    // Reset AnimationController
    if (animationController) {
      animationController.reset();
      animationController = null;
    }
    viewer.updateVisibleEvents([]);
    timeSlider.setProgress(0);

    // Update active region
    activeRegion = newRegion;

    // Create new CoordinateMapperConfig for the new region
    mapperConfig = createCoordinateMapperConfig(activeRegion.center.lat, activeRegion.center.lon);

    // Setup Viewer with new region (clears old elements, rebuilds scene)
    viewer.setupRegion(activeRegion, mapperConfig);

    // Reconfigure DataFetcher with new endpoint and bounds
    dataFetcher.configure(activeRegion.apiEndpoint, activeRegion.bounds);

    // Fetch new data for the region
    await fetchAndSetupAnimation();

    // Re-enable switcher
    regionSwitcher.setDisabled(false);
  });

  // 13. Fetch initial data for the default region
  await fetchAndSetupAnimation();

  // 14. Wire TimeSlider callbacks

  // onRangeChange → fetch new data → recreate AnimationController
  timeSlider.onRangeChange(async (start: Date, end: Date) => {
    timeSlider.setLoading(true);
    try {
      const result = await dataFetcher.fetch({ startDate: start, endDate: end });

      handleFetchResult(result);

      // On failure, retain previous data in the view — don't recreate controller
      if (result.failed) {
        return;
      }

      // Update depth scale if we have events
      if (result.events.length > 0) {
        const depthScale = computeDepthScale(result.events);
        viewer.setDepthScale(depthScale.minDepth, depthScale.maxDepth);
      }

      // Recreate AnimationController with new data
      animationController = new AnimationController({
        events: result.events,
        defaultDurationSec: DEFAULT_ANIMATION_DURATION_SEC,
        speedMultiplier: DEFAULT_SPEED_MULTIPLIER,
      });
      animationController.onFrame(onAnimationFrame);

      // Reset viewer to show empty state until animation plays
      viewer.updateVisibleEvents([]);
      timeSlider.setProgress(0);
    } catch (error) {
      timeSlider.showError('Daten konnten nicht geladen werden.');
      console.error('[main] Data fetch for new range failed:', error);
    } finally {
      timeSlider.setLoading(false);
    }
  });

  // onSpeedChange → AnimationController.setSpeed()
  timeSlider.onSpeedChange((multiplier: number) => {
    if (animationController) {
      animationController.setSpeed(multiplier);
    }
  });

  // onPlayPause → AnimationController.play()/pause()
  timeSlider.onPlayPause((playing: boolean) => {
    if (!animationController) return;
    if (playing) {
      animationController.play();
    } else {
      animationController.pause();
    }
  });

  // onReset → AnimationController.reset()
  timeSlider.onReset(() => {
    if (!animationController) return;
    animationController.reset();
    // Clear visible events and reset progress
    viewer.updateVisibleEvents([]);
    timeSlider.setProgress(0);
    timeSlider.setVirtualTime(new Date(0));
  });

  // 15. Animation loop with requestAnimationFrame
  let lastTimestamp: number | null = null;

  function animationLoop(timestamp: number): void {
    requestAnimationFrame(animationLoop);

    // Compute deltaTime in seconds
    const deltaTime = lastTimestamp !== null
      ? (timestamp - lastTimestamp) / 1000
      : 0;
    lastTimestamp = timestamp;

    // Clamp deltaTime to avoid large jumps (e.g., tab in background)
    const clampedDelta = Math.min(deltaTime, 0.1);

    // Advance animation
    if (animationController) {
      animationController.tick(clampedDelta);
    }

    // Update rotation engine (ease-in logic)
    rotationEngine.update(clampedDelta);

    // Update OrbitControls (handles damping and auto-rotation)
    controls.update();
  }

  requestAnimationFrame(animationLoop);
}

// --- Entry Point ---
main().catch((error) => {
  console.error('[main] Unhandled error during initialization:', error);
  const app = document.querySelector<HTMLDivElement>('#app');
  if (app) {
    app.innerHTML = `
      <div class="webgl-error">
        <h2>Fehler beim Starten</h2>
        <p>Die Anwendung konnte nicht gestartet werden. Bitte laden Sie die Seite neu.</p>
      </div>
    `;
  }
});
