import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { RotationEngine, RotationConfig } from '../rotation-engine';

// Mock OrbitControls since we can't instantiate a real one without a WebGL context
function createMockControls() {
  return {
    autoRotate: false,
    autoRotateSpeed: 0,
    update: vi.fn(),
  };
}

function createDefaultConfig(): RotationConfig {
  return {
    degreesPerSecond: 10,
    resumeDelayMs: 3000,
    easeInDurationMs: 1000,
  };
}

describe('RotationEngine', () => {
  let controls: ReturnType<typeof createMockControls>;
  let engine: RotationEngine;
  let config: RotationConfig;

  beforeEach(() => {
    vi.useFakeTimers();
    controls = createMockControls();
    config = createDefaultConfig();
    engine = new RotationEngine(config, controls as any);
  });

  afterEach(() => {
    engine.dispose();
    vi.useRealTimers();
  });

  describe('initialization', () => {
    it('should enable autoRotate on construction', () => {
      expect(controls.autoRotate).toBe(true);
    });

    it('should set autoRotateSpeed for 10°/s', () => {
      // degreesPerSecond / 6 = 10 / 6 ≈ 1.667
      expect(controls.autoRotateSpeed).toBeCloseTo(10 / 6);
    });

    it('should start in rotating state', () => {
      expect(engine.getState()).toBe('rotating');
    });

    it('should compute target speed from config', () => {
      expect(engine.getTargetSpeed()).toBeCloseTo(10 / 6);
    });

    it('should respect custom degreesPerSecond', () => {
      const customConfig: RotationConfig = { degreesPerSecond: 30, resumeDelayMs: 3000, easeInDurationMs: 1000 };
      const customControls = createMockControls();
      const customEngine = new RotationEngine(customConfig, customControls as any);
      expect(customControls.autoRotateSpeed).toBeCloseTo(30 / 6);
      customEngine.dispose();
    });
  });

  describe('onInteractionStart', () => {
    it('should immediately disable autoRotate', () => {
      engine.onInteractionStart();
      expect(controls.autoRotate).toBe(false);
    });

    it('should set autoRotateSpeed to 0', () => {
      engine.onInteractionStart();
      expect(controls.autoRotateSpeed).toBe(0);
    });

    it('should transition to paused state', () => {
      engine.onInteractionStart();
      expect(engine.getState()).toBe('paused');
    });

    it('should cancel any pending resume timer', () => {
      engine.onInteractionEnd(); // starts 3s timer
      engine.onInteractionStart(); // should cancel it
      vi.advanceTimersByTime(5000);
      expect(engine.getState()).toBe('paused');
      expect(controls.autoRotate).toBe(false);
    });
  });

  describe('onInteractionEnd', () => {
    it('should transition to waiting state', () => {
      engine.onInteractionStart();
      engine.onInteractionEnd();
      expect(engine.getState()).toBe('waiting');
    });

    it('should not enable autoRotate immediately', () => {
      engine.onInteractionStart();
      engine.onInteractionEnd();
      expect(controls.autoRotate).toBe(false);
    });

    it('should enable autoRotate after resumeDelayMs (3s)', () => {
      engine.onInteractionStart();
      engine.onInteractionEnd();

      vi.advanceTimersByTime(3000);
      expect(controls.autoRotate).toBe(true);
    });

    it('should start ease-in after resume delay', () => {
      engine.onInteractionStart();
      engine.onInteractionEnd();

      vi.advanceTimersByTime(3000);
      expect(engine.getState()).toBe('easing-in');
      expect(controls.autoRotateSpeed).toBe(0);
    });

    it('should not resume before delay has elapsed', () => {
      engine.onInteractionStart();
      engine.onInteractionEnd();

      vi.advanceTimersByTime(2999);
      expect(engine.getState()).toBe('waiting');
      expect(controls.autoRotate).toBe(false);
    });
  });

  describe('update (ease-in interpolation)', () => {
    beforeEach(() => {
      engine.onInteractionStart();
      engine.onInteractionEnd();
      vi.advanceTimersByTime(3000); // trigger ease-in
    });

    it('should start with speed 0 at beginning of ease-in', () => {
      expect(controls.autoRotateSpeed).toBe(0);
    });

    it('should interpolate speed during ease-in', () => {
      // At t=0.5 (500ms), quadratic ease: (0.5)^2 = 0.25 of target
      engine.update(0.5); // 500ms in seconds
      expect(controls.autoRotateSpeed).toBeCloseTo((10 / 6) * 0.25);
    });

    it('should reach target speed after easeInDurationMs', () => {
      engine.update(1.0); // 1000ms = full duration
      expect(controls.autoRotateSpeed).toBeCloseTo(10 / 6);
    });

    it('should transition to rotating state after ease-in completes', () => {
      engine.update(1.0);
      expect(engine.getState()).toBe('rotating');
    });

    it('should handle ease-in over multiple frames', () => {
      // Frame 1: 200ms
      engine.update(0.2);
      const t1 = 200 / 1000;
      expect(controls.autoRotateSpeed).toBeCloseTo((10 / 6) * t1 * t1);
      expect(engine.getState()).toBe('easing-in');

      // Frame 2: another 300ms (total 500ms)
      engine.update(0.3);
      const t2 = 500 / 1000;
      expect(controls.autoRotateSpeed).toBeCloseTo((10 / 6) * t2 * t2);
      expect(engine.getState()).toBe('easing-in');

      // Frame 3: another 600ms (total 1100ms, beyond duration)
      engine.update(0.6);
      expect(controls.autoRotateSpeed).toBeCloseTo(10 / 6);
      expect(engine.getState()).toBe('rotating');
    });

    it('should use quadratic ease-in (not linear)', () => {
      // At 50% time, speed should be 25% of target (quadratic), not 50% (linear)
      engine.update(0.5);
      const linearExpected = (10 / 6) * 0.5;
      const quadraticExpected = (10 / 6) * 0.25;
      expect(controls.autoRotateSpeed).toBeCloseTo(quadraticExpected);
      expect(controls.autoRotateSpeed).not.toBeCloseTo(linearExpected);
    });
  });

  describe('pause', () => {
    it('should disable autoRotate', () => {
      engine.pause();
      expect(controls.autoRotate).toBe(false);
    });

    it('should set speed to 0', () => {
      engine.pause();
      expect(controls.autoRotateSpeed).toBe(0);
    });

    it('should transition to paused state', () => {
      engine.pause();
      expect(engine.getState()).toBe('paused');
    });

    it('should cancel any pending resume timer', () => {
      engine.onInteractionStart();
      engine.onInteractionEnd(); // starts timer
      engine.pause();
      vi.advanceTimersByTime(5000);
      expect(engine.getState()).toBe('paused');
    });
  });

  describe('resume', () => {
    it('should enable autoRotate', () => {
      engine.pause();
      engine.resume();
      expect(controls.autoRotate).toBe(true);
    });

    it('should start speed at 0 for ease-in', () => {
      engine.pause();
      engine.resume();
      expect(controls.autoRotateSpeed).toBe(0);
    });

    it('should transition to easing-in state', () => {
      engine.pause();
      engine.resume();
      expect(engine.getState()).toBe('easing-in');
    });

    it('should reach target speed after update with full ease-in duration', () => {
      engine.pause();
      engine.resume();
      engine.update(1.0); // 1s ease-in
      expect(controls.autoRotateSpeed).toBeCloseTo(10 / 6);
      expect(engine.getState()).toBe('rotating');
    });
  });

  describe('update does nothing when not easing', () => {
    it('should not change speed in rotating state', () => {
      const speedBefore = controls.autoRotateSpeed;
      engine.update(0.016); // one frame
      expect(controls.autoRotateSpeed).toBe(speedBefore);
    });

    it('should not change speed in paused state', () => {
      engine.pause();
      engine.update(0.016);
      expect(controls.autoRotateSpeed).toBe(0);
    });

    it('should not change speed in waiting state', () => {
      engine.onInteractionStart();
      engine.onInteractionEnd();
      expect(engine.getState()).toBe('waiting');
      engine.update(0.016);
      expect(controls.autoRotateSpeed).toBe(0);
    });
  });

  describe('interaction during ease-in', () => {
    it('should cancel ease-in on new interaction', () => {
      engine.onInteractionStart();
      engine.onInteractionEnd();
      vi.advanceTimersByTime(3000); // start ease-in
      engine.update(0.3); // partially ease in

      // New interaction interrupts
      engine.onInteractionStart();
      expect(controls.autoRotate).toBe(false);
      expect(controls.autoRotateSpeed).toBe(0);
      expect(engine.getState()).toBe('paused');
    });
  });

  describe('dispose', () => {
    it('should clear pending timers', () => {
      engine.onInteractionStart();
      engine.onInteractionEnd(); // starts timer
      engine.dispose();
      vi.advanceTimersByTime(5000);
      // Should not have transitioned to easing-in
      expect(engine.getState()).toBe('waiting');
    });
  });

  describe('custom config values', () => {
    it('should respect custom resumeDelayMs', () => {
      const customConfig: RotationConfig = { degreesPerSecond: 10, resumeDelayMs: 5000, easeInDurationMs: 1000 };
      const customControls = createMockControls();
      const customEngine = new RotationEngine(customConfig, customControls as any);

      customEngine.onInteractionStart();
      customEngine.onInteractionEnd();

      vi.advanceTimersByTime(3000);
      expect(customEngine.getState()).toBe('waiting'); // still waiting

      vi.advanceTimersByTime(2000); // total 5000ms
      expect(customEngine.getState()).toBe('easing-in');

      customEngine.dispose();
    });

    it('should respect custom easeInDurationMs', () => {
      const customConfig: RotationConfig = { degreesPerSecond: 10, resumeDelayMs: 3000, easeInDurationMs: 2000 };
      const customControls = createMockControls();
      const customEngine = new RotationEngine(customConfig, customControls as any);

      customEngine.onInteractionStart();
      customEngine.onInteractionEnd();
      vi.advanceTimersByTime(3000); // start ease-in

      // At 1s (50% of 2000ms), quadratic = 0.25
      customEngine.update(1.0);
      expect(customControls.autoRotateSpeed).toBeCloseTo((10 / 6) * 0.25);
      expect(customEngine.getState()).toBe('easing-in');

      // At 2s (100%), should complete
      customEngine.update(1.0);
      expect(customControls.autoRotateSpeed).toBeCloseTo(10 / 6);
      expect(customEngine.getState()).toBe('rotating');

      customEngine.dispose();
    });
  });
});
