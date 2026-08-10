import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { AnimationController, type AnimationConfig } from '../../animation-controller';
import type { EarthquakeEvent } from '../../types';

/**
 * Property 6: Animation Progress Monotonicity
 *
 * For any sequence of animation ticks while the animation is in 'playing' state,
 * the virtual time SHALL be strictly non-decreasing. The progress value SHALL move
 * from 0.0 toward 1.0 monotonically.
 *
 * Validates: Requirements 4.2, 4.3
 */
describe('Feature: campi-flegrei-3d-earthquakes, Property 6: Animation Progress Monotonicity', () => {
  /** Helper to create a minimal EarthquakeEvent */
  function makeEvent(id: string, timestamp: Date): EarthquakeEvent {
    return {
      id,
      timestamp,
      latitude: 40.83,
      longitude: 14.14,
      depth: 3.0,
      magnitude: 2.0,
      magnitudeType: 'Md',
      locationName: 'Campi Flegrei',
    };
  }

  /** Arbitrary for positive deltaTimes (small enough to be realistic frame times) */
  const arbDeltaTime = fc.double({ min: 0.001, max: 2.0, noNaN: true, noDefaultInfinity: true });

  /** Arbitrary for a sequence of positive deltaTimes */
  const arbDeltaTimeSequence = fc.array(arbDeltaTime, { minLength: 2, maxLength: 50 });

  /** Arbitrary for defaultDurationSec (realistic range) */
  const arbDuration = fc.double({ min: 5, max: 30, noNaN: true, noDefaultInfinity: true });

  /** Arbitrary for speedMultiplier (valid range per spec) */
  const arbSpeed = fc.double({ min: 0.25, max: 8.0, noNaN: true, noDefaultInfinity: true });

  /**
   * Generate a pair of event timestamps where start < end with at least 1 hour gap.
   * This ensures a non-zero timeSpan for the animation.
   * We use integer-based timestamps to avoid fc.date() generating invalid Date values.
   */
  const arbEventTimestamps = fc.tuple(
    fc.integer({ min: new Date('2020-01-01T00:00:00Z').getTime(), max: new Date('2024-06-01T00:00:00Z').getTime() }),
    fc.integer({ min: 3600000, max: 7 * 86400000 }) // gap between 1h and 7 days in ms
  ).map(([startMs, gapMs]) => ({
    start: new Date(startMs),
    end: new Date(startMs + gapMs),
  }));

  it('each successive getProgress() is >= previous while playing', () => {
    fc.assert(
      fc.property(
        arbEventTimestamps,
        arbDeltaTimeSequence,
        arbDuration,
        arbSpeed,
        (timestamps, deltaTimes, duration, speed) => {
          const events = [
            makeEvent('start', timestamps.start),
            makeEvent('end', timestamps.end),
          ];

          const config: AnimationConfig = {
            events,
            defaultDurationSec: duration,
            speedMultiplier: speed,
          };

          const controller = new AnimationController(config);
          controller.play();

          let previousProgress = controller.getProgress();

          for (const dt of deltaTimes) {
            controller.tick(dt);
            const currentProgress = controller.getProgress();
            expect(currentProgress).toBeGreaterThanOrEqual(previousProgress);
            previousProgress = currentProgress;
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('each successive getVirtualTime() is >= previous while playing', () => {
    fc.assert(
      fc.property(
        arbEventTimestamps,
        arbDeltaTimeSequence,
        arbDuration,
        arbSpeed,
        (timestamps, deltaTimes, duration, speed) => {
          const events = [
            makeEvent('start', timestamps.start),
            makeEvent('end', timestamps.end),
          ];

          const config: AnimationConfig = {
            events,
            defaultDurationSec: duration,
            speedMultiplier: speed,
          };

          const controller = new AnimationController(config);
          controller.play();

          let previousTime = controller.getVirtualTime().getTime();

          for (const dt of deltaTimes) {
            controller.tick(dt);
            const currentTime = controller.getVirtualTime().getTime();
            expect(currentTime).toBeGreaterThanOrEqual(previousTime);
            previousTime = currentTime;
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('progress starts at 0 and moves toward 1.0', () => {
    fc.assert(
      fc.property(
        arbEventTimestamps,
        arbDeltaTimeSequence,
        arbDuration,
        arbSpeed,
        (timestamps, deltaTimes, duration, speed) => {
          const events = [
            makeEvent('start', timestamps.start),
            makeEvent('end', timestamps.end),
          ];

          const config: AnimationConfig = {
            events,
            defaultDurationSec: duration,
            speedMultiplier: speed,
          };

          const controller = new AnimationController(config);

          // Progress starts at 0
          expect(controller.getProgress()).toBe(0);

          controller.play();

          // After ticking with positive deltas, progress must be > 0
          for (const dt of deltaTimes) {
            controller.tick(dt);
          }

          const finalProgress = controller.getProgress();
          // After positive ticks while playing, progress must have advanced above 0
          expect(finalProgress).toBeGreaterThan(0);
          // Progress is always in [0, 1]
          expect(finalProgress).toBeLessThanOrEqual(1.0);
        }
      ),
      { numRuns: 100 }
    );
  });
});
