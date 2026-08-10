import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { AnimationController } from '../../animation-controller';
import type { EarthquakeEvent } from '../../types';

/**
 * Property 5: Chronological Visibility Order
 *
 * For any set of earthquake events and any virtual animation time T,
 * the set of visible events SHALL consist exactly of those events whose
 * timestamp is ≤ T. No event with timestamp > T SHALL be visible,
 * and no event with timestamp ≤ T SHALL be invisible.
 *
 * Validates: Requirements 4.1, 4.2, 4.5
 */
describe('Feature: campi-flegrei-3d-earthquakes, Property 5: Chronological Visibility Order', () => {

  // Arbitrary for generating a unique earthquake event with a given timestamp
  const earthquakeEventArb = (index: number, timestamp: Date): fc.Arbitrary<EarthquakeEvent> =>
    fc.constant({
      id: `event-${index}`,
      timestamp,
      latitude: 40.84,
      longitude: 14.14,
      depth: 2.5,
      magnitude: 1.5,
      magnitudeType: 'Md',
      locationName: 'Campi Flegrei',
    });

  // Generate a set of events with random timestamps within a reasonable range
  // Using integer-based ms timestamps to avoid fc.date() generating NaN values
  const eventSetArb = fc
    .array(
      fc.integer({
        min: new Date('2024-01-01T00:00:00Z').getTime(),
        max: new Date('2024-12-31T23:59:59Z').getTime(),
      }),
      { minLength: 2, maxLength: 50 }
    )
    .chain(timestampMs => {
      // Round to second precision (as per INGV data)
      const cleanTimestamps = timestampMs.map(ms => new Date(Math.floor(ms / 1000) * 1000));

      // Ensure at least 2 distinct timestamps for meaningful animation
      const distinctTimestamps = [...new Set(cleanTimestamps.map(d => d.getTime()))].map(ms => new Date(ms));
      if (distinctTimestamps.length < 2) {
        // Add a second distinct timestamp
        const extra = new Date(cleanTimestamps[0].getTime() + 3600000); // +1 hour
        distinctTimestamps.push(extra);
      }

      const events: fc.Arbitrary<EarthquakeEvent>[] = distinctTimestamps.map((ts, i) =>
        earthquakeEventArb(i, ts)
      );

      return fc.tuple(...events as [fc.Arbitrary<EarthquakeEvent>, ...fc.Arbitrary<EarthquakeEvent>[]]);
    })
    .map(events => events as EarthquakeEvent[]);

  // Generate a progress value between 0 and 1 representing how far to tick
  const progressArb = fc.double({ min: 0.0, max: 1.0, noNaN: true, noDefaultInfinity: true });

  it('visible set contains exactly events with timestamp <= virtualTime', () => {
    fc.assert(
      fc.property(
        eventSetArb,
        progressArb,
        (events, progress) => {
          // Create animation controller
          const controller = new AnimationController({
            events,
            defaultDurationSec: 20,
            speedMultiplier: 1.0,
          });

          // Start playing and tick to advance to an arbitrary point
          controller.play();

          // Tick with enough time to reach the desired progress point
          // effectiveDuration = defaultDurationSec / speedMultiplier = 20s
          // To reach progress p, we need to tick p * 20 seconds of real time
          const deltaTime = progress * 20;
          controller.tick(deltaTime);

          // Collect visible events from the last tick's frame callback
          // We need to capture the visible events — tick fires frame callbacks.
          // Instead, let's re-construct what should be visible by examining the controller.
          // The controller computes visible events internally in tick(), so let's use a callback.

          // Re-create the controller with a callback to capture visible events
          const controller2 = new AnimationController({
            events,
            defaultDurationSec: 20,
            speedMultiplier: 1.0,
          });

          let capturedVisibleEvents: EarthquakeEvent[] = [];
          controller2.onFrame((visibleEvents) => {
            capturedVisibleEvents = visibleEvents.map(ve => ve.event);
          });

          controller2.play();
          controller2.tick(deltaTime);

          const actualVirtualTimeMs = controller2.getVirtualTime().getTime();

          // Expected: all events with timestamp <= virtualTime
          const expectedVisible = events.filter(e => e.timestamp.getTime() <= actualVirtualTimeMs);
          const expectedNotVisible = events.filter(e => e.timestamp.getTime() > actualVirtualTimeMs);

          // Verify: all events that should be visible ARE visible
          const capturedIds = new Set(capturedVisibleEvents.map(e => e.id));
          for (const event of expectedVisible) {
            expect(capturedIds.has(event.id)).toBe(true);
          }

          // Verify: no event with timestamp > T is visible
          for (const event of expectedNotVisible) {
            expect(capturedIds.has(event.id)).toBe(false);
          }

          // Verify: counts match (exact equality of visible set)
          expect(capturedVisibleEvents.length).toBe(expectedVisible.length);
        }
      ),
      { numRuns: 100 }
    );
  });
});
