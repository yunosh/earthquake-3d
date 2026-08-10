import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export interface RotationConfig {
  degreesPerSecond: number;    // default: 10
  resumeDelayMs: number;       // default: 3000
  easeInDurationMs: number;    // default: 1000
}

type RotationState = 'rotating' | 'paused' | 'waiting' | 'easing-in';

/**
 * Manages automatic camera rotation around the caldera's vertical axis.
 * Pauses immediately on user interaction and resumes with a smooth ease-in
 * after a configurable delay.
 *
 * Three.js OrbitControls autoRotateSpeed: 2.0 means one full revolution in ~30s at 60fps.
 * For 10°/s → one full revolution in 36s → autoRotateSpeed = 30/36 ≈ 0.833.
 * General formula: autoRotateSpeed = (degreesPerSecond / 360) * 30 * 2 = degreesPerSecond / 6
 * Actually from Three.js source: getAutoRotationAngle() = (2 * PI / 60 / 60) * autoRotateSpeed
 * per call, with one call per frame at 60fps → per second: (2*PI/60) * autoRotateSpeed
 * → degrees/s = (360/60) * autoRotateSpeed = 6 * autoRotateSpeed
 * → autoRotateSpeed = degreesPerSecond / 6
 */
export class RotationEngine {
  private config: RotationConfig;
  private controls: OrbitControls;
  private targetAutoRotateSpeed: number;
  private state: RotationState = 'rotating';
  private resumeTimerId: ReturnType<typeof setTimeout> | null = null;
  private easeInElapsed = 0;

  constructor(config: RotationConfig, controls: OrbitControls) {
    this.config = config;
    this.controls = controls;

    // Calculate target autoRotateSpeed from degreesPerSecond
    // Three.js: degrees/s = 6 * autoRotateSpeed → autoRotateSpeed = degreesPerSecond / 6
    this.targetAutoRotateSpeed = config.degreesPerSecond / 6;

    // Initialize controls for auto-rotation
    this.controls.autoRotate = true;
    this.controls.autoRotateSpeed = this.targetAutoRotateSpeed;
  }

  /**
   * Pause rotation manually (e.g., from external control).
   */
  pause(): void {
    this.clearResumeTimer();
    this.controls.autoRotate = false;
    this.controls.autoRotateSpeed = 0;
    this.state = 'paused';
    this.easeInElapsed = 0;
  }

  /**
   * Resume rotation manually (e.g., from external control).
   * Immediately starts ease-in from current speed to target.
   */
  resume(): void {
    this.clearResumeTimer();
    this.controls.autoRotate = true;
    this.controls.autoRotateSpeed = 0;
    this.state = 'easing-in';
    this.easeInElapsed = 0;
  }

  /**
   * Called when user begins interacting with the 3D viewer (mouse drag / touch).
   * Immediately stops auto-rotation.
   */
  onInteractionStart(): void {
    this.clearResumeTimer();
    this.controls.autoRotate = false;
    this.controls.autoRotateSpeed = 0;
    this.state = 'paused';
    this.easeInElapsed = 0;
  }

  /**
   * Called when user releases interaction (mouse up / touch end).
   * Starts the resume delay timer, after which ease-in begins.
   */
  onInteractionEnd(): void {
    this.clearResumeTimer();
    this.state = 'waiting';

    this.resumeTimerId = setTimeout(() => {
      this.resumeTimerId = null;
      // Begin ease-in
      this.controls.autoRotate = true;
      this.controls.autoRotateSpeed = 0;
      this.state = 'easing-in';
      this.easeInElapsed = 0;
    }, this.config.resumeDelayMs);
  }

  /**
   * Called each frame from the animation loop.
   * @param deltaTime Time elapsed since last frame in seconds.
   */
  update(deltaTime: number): void {
    if (this.state !== 'easing-in') {
      return;
    }

    this.easeInElapsed += deltaTime * 1000; // convert to ms

    if (this.easeInElapsed >= this.config.easeInDurationMs) {
      // Ease-in complete
      this.controls.autoRotateSpeed = this.targetAutoRotateSpeed;
      this.state = 'rotating';
    } else {
      // Ease-in interpolation (quadratic ease-in: t^2)
      const t = this.easeInElapsed / this.config.easeInDurationMs;
      const easedT = t * t; // quadratic ease-in
      this.controls.autoRotateSpeed = this.targetAutoRotateSpeed * easedT;
    }
  }

  /**
   * Get the current rotation state (useful for testing/debugging).
   */
  getState(): RotationState {
    return this.state;
  }

  /**
   * Get the current auto-rotate speed being applied to the controls.
   */
  getCurrentSpeed(): number {
    return this.controls.autoRotateSpeed;
  }

  /**
   * Get the target auto-rotate speed.
   */
  getTargetSpeed(): number {
    return this.targetAutoRotateSpeed;
  }

  /**
   * Clean up timers.
   */
  dispose(): void {
    this.clearResumeTimer();
  }

  private clearResumeTimer(): void {
    if (this.resumeTimerId !== null) {
      clearTimeout(this.resumeTimerId);
      this.resumeTimerId = null;
    }
  }
}
