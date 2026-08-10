import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { AnimationController } from '../../animation-controller';
import type { EarthquakeEvent, VisibleEvent } from '../../types';

/**
 * Property 7: Speed Change Preserves Position
 *
 * Feature: campi-flegrei-3d-earthquakes, Property 7: Speed Change Preserves Position
 *
 * Validates: Requirements 5.6
 */

/** Arbitrary earthquake event generator within the Campi Flegrei bounding box */
function arbEarthquakeEvent(baseTime: Date, timeSpanMs: number): fc.Arbitrary<EarthquakeEvent> {
  return fc.record({
    id: fc.uuid(),
    timestamp: fc.integer({ min: 0, max: timeSpanMs }).map(
      (offset) => new Date(baseTime.getTime() + offset)
    ),
    latitude: fc.double({ min: 40.78, max: 40.90, noNaN: true }),
    longitude: fc.double({ min: 14.03, max: 14.22, noNaN: true }),
    depth: fc.double({ min: 0.1, max: 10.0, noNaN: true }),
    magnitude: fc.double({ min: 0, max: 4, noNaN: true }),
    magnitudeType: fc.constant('Md'),
    locationName: fc.constant('Campi Flegrei'),
  });
}

/** Valid speed multiplier steps */
const arbSpeedMultiplier = fc.constantFrom(0.25, 0.5, 1, 2, 4, 8);

describe('Property 7: Speed Change Preserves Position', () => {
  it('virtualTime and visible events remain unchanged immediately after speed change', () => {
    const baseTime = new Date('2024-01-01T00:00:00Z');
    const timeSpanMs = 7 * 24 * 60 * 60 * 1000; // 7 days in ms

    fc.assert(
      fc.property(
        fc.array(arbEarthquakeEvent(baseTime, timeSpanMs), { minLength: 1, maxLength: 50 }),
        arbSpeedMultiplier,
        arbSpeedMultiplier,
        fc.double({ min: 0.01, max: 5.0, noNaN: true }), // deltaTime to tick before speed change
        (events, initialSpeed, newSpeed, tickDelta) => {
          // Ensure initial and new speed differ
          fc.pre(initialSpeed !== newSpeed);

          // Create controller with initial speed
          const controller = new AnimationController({
            events,
            defaultDurationSec: 20,
            speedMultiplier: initialSpeed,
          });

          // Play and advance time
          controller.play();
          controller.tick(tickDelta);

          // Record state before speed change
          let visibleBefore: VisibleEvent[] = [];
          let virtualTimeBefore: Date = new Date(0);

          const callbackBefore = (visibleEvents: VisibleEvent[], virtualTime: Date) => {
            visibleBefore = visibleEvents;
            virtualTimeBefore = virtualTime;
          };

          controller.onFrame(callbackBefore);
          // tick(0) triggers a frame callback without advancing time
          controller.tick(0);

          // Remove callback and record the virtual time directly
          const virtualTimeBeforeDirect = controller.getVirtualTime();

          // Apply speed change
          controller.setSpeed(newSpeed);

          // Record state after speed change via tick(0)
          let visibleAfter: VisibleEvent[] = [];
          let virtualTimeAfter: Date = new Date(0);

          // The frame callbacks are still registered; tick(0) triggers them again
          const callbackAfter = (visibleEvents: VisibleEvent[], virtualTime: Date) => {
            visibleAfter = visibleEvents;
            virtualTimeAfter = virtualTime;
          };

          // Replace callbacks by adding another one (the controller appends)
          // We'll use the last callback's result
          controller.onFrame(callbackAfter);
          controller.tick(0);

          // Verify: virtualTime unchanged
          expect(virtualTimeAfter.getTime()).toBe(virtualTimeBefore.getTime());
          expect(controller.getVirtualTime().getTime()).toBe(virtualTimeBeforeDirect.getTime());

          // Verify: visible events unchanged (same events, same ages)
          expect(visibleAfter.length).toBe(visibleBefore.length);
          for (let i = 0; i < visibleBefore.length; i++) {
            expect(visibleAfter[i].event.id).toBe(visibleBefore[i].event.id);
            expect(visibleAfter[i].age).toBe(visibleBefore[i].age);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
