import './style.css';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { DataFetcher } from './data-fetcher';
import { Viewer } from './viewer';
import { AnimationController } from './animation-controller';
import { RotationEngine } from './rotation-engine';
import { TimeSlider } from './ui/time-slider';
import { computeDepthScale } from './coordinate-mapper';
import type { GeoBounds, VisibleEvent, FetchResult } from './types';

// --- Constants ---

const CALDERA_CENTER_LAT = 40.827;
const CALDERA_CENTER_LON = 14.139;

const BOUNDS: GeoBounds = {
  minLat: 40.78,
  maxLat: 40.90,
  minLon: 14.03,
  maxLon: 14.22,
};

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

  // 2. Create UI containers
  const viewerContainer = document.createElement('div');
  viewerContainer.id = 'viewer-container';
  appContainer.appendChild(viewerContainer);

  const uiContainer = document.createElement('div');
  uiContainer.id = 'ui-container';
  appContainer.appendChild(uiContainer);

  // 3. Initialize core modules
  const dataFetcher = new DataFetcher();

  const viewer = new Viewer({
    container: viewerContainer,
    centerLat: CALDERA_CENTER_LAT,
    centerLon: CALDERA_CENTER_LON,
    bounds: BOUNDS,
  });
  viewer.init();

  const timeSlider = new TimeSlider({
    container: uiContainer,
    minDate: new Date('2000-01-01T00:00:00Z'),
    maxDate: new Date(),
    defaultRange: 7,
  });

  // 4. Set up OrbitControls on the Viewer's camera/renderer
  const controls = new OrbitControls(viewer.getCamera(), viewer.getRenderer().domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.target.set(0, -2, 0); // Look slightly below surface (caldera center depth area)
  controls.update();

  // 5. Set up RotationEngine
  const rotationEngine = new RotationEngine(
    {
      degreesPerSecond: 10,
      resumeDelayMs: 3000,
      easeInDurationMs: 1000,
    },
    controls
  );

  // 6. Wire Viewer interaction events → RotationEngine
  viewer.onInteractionStart(() => rotationEngine.onInteractionStart());
  viewer.onInteractionEnd(() => rotationEngine.onInteractionEnd());

  // Also hook OrbitControls events for interaction detection
  controls.addEventListener('start', () => rotationEngine.onInteractionStart());
  controls.addEventListener('end', () => rotationEngine.onInteractionEnd());

  // 7. WebGL context lost/restored handling — notify user via TimeSlider
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

  // 8. AnimationController (initialized after data fetch)
  let animationController: AnimationController | null = null;

  // Frame callback: update Viewer and TimeSlider on each animation frame
  function onAnimationFrame(visibleEvents: VisibleEvent[], virtualTime: Date): void {
    viewer.updateVisibleEvents(visibleEvents);
    if (animationController) {
      timeSlider.setProgress(animationController.getProgress());
    }
    timeSlider.setVirtualTime(virtualTime);
  }

  /**
   * Process a FetchResult and display appropriate messages.
   * Returns true if the result contains usable data (new or retained from previous fetch).
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
    }

    if (result.events.length === 0) {
      timeSlider.showInfo('Keine Erdbeben im gewählten Zeitraum gefunden.');
    }
  }

  // 9. Fetch initial data (last 7 days)
  timeSlider.setLoading(true);
  try {
    const result = await dataFetcher.fetch();

    handleFetchResult(result);

    if (result.events.length > 0) {
      // Compute and apply depth scale
      const depthScale = computeDepthScale(result.events);
      viewer.setDepthScale(depthScale.minDepth, depthScale.maxDepth);
    }

    // Create AnimationController with fetched events (may be empty or retained from previous)
    animationController = new AnimationController({
      events: result.events,
      defaultDurationSec: DEFAULT_ANIMATION_DURATION_SEC,
      speedMultiplier: DEFAULT_SPEED_MULTIPLIER,
    });
    animationController.onFrame(onAnimationFrame);
  } catch (error) {
    timeSlider.showError('Daten konnten nicht geladen werden. Bitte versuchen Sie es später erneut.');
    console.error('[main] Initial data fetch failed:', error);
  } finally {
    timeSlider.setLoading(false);
  }

  // 10. Wire TimeSlider callbacks

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

  // 11. Animation loop with requestAnimationFrame
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
