import { describe, it, expect, vi } from 'vitest';
import { AnimationController, type AnimationConfig } from '../animation-controller';
import type { EarthquakeEvent, VisibleEvent } from '../types';

function makeEvent(id: string, timestamp: Date, magnitude = 2.0): EarthquakeEvent {
  return {
    id,
    timestamp,
    latitude: 40.83,
    longitude: 14.14,
    depth: 3.0,
    magnitude,
    magnitudeType: 'Md',
    locationName: 'Campi Flegrei',
  };
}

function makeConfig(events: EarthquakeEvent[], overrides?: Partial<AnimationConfig>): AnimationConfig {
  return {
    events,
    defaultDurationSec: 10,
    speedMultiplier: 1,
    ...overrides,
  };
}

describe('AnimationController', () => {
  describe('initial state', () => {
    it('starts in stopped state', () => {
      const controller = new AnimationController(makeConfig([]));
      expect(controller.getState()).toBe('stopped');
    });

    it('starts with progress 0', () => {
      const events = [
        makeEvent('1', new Date('2024-01-01T00:00:00Z')),
        makeEvent('2', new Date('2024-01-02T00:00:00Z')),
      ];
      const controller = new AnimationController(makeConfig(events));
      expect(controller.getProgress()).toBe(0);
    });

    it('virtual time starts at earliest event timestamp', () => {
      const events = [
        makeEvent('1', new Date('2024-01-01T00:00:00Z')),
        makeEvent('2', new Date('2024-01-02T00:00:00Z')),
      ];
      const controller = new AnimationController(makeConfig(events));
      expect(controller.getVirtualTime().getTime()).toBe(new Date('2024-01-01T00:00:00Z').getTime());
    });

    it('handles empty events gracefully', () => {
      const controller = new AnimationController(makeConfig([]));
      expect(controller.getProgress()).toBe(0);
      expect(controller.getState()).toBe('stopped');
    });
  });

  describe('play/pause/reset', () => {
    it('play transitions to playing state', () => {
      const controller = new AnimationController(makeConfig([
        makeEvent('1', new Date('2024-01-01T00:00:00Z')),
      ]));
      controller.play();
      expect(controller.getState()).toBe('playing');
    });

    it('pause transitions to paused state', () => {
      const controller = new AnimationController(makeConfig([
        makeEvent('1', new Date('2024-01-01T00:00:00Z')),
      ]));
      controller.play();
      controller.pause();
      expect(controller.getState()).toBe('paused');
    });

    it('reset returns to stopped state and beginning', () => {
      const events = [
        makeEvent('1', new Date('2024-01-01T00:00:00Z')),
        makeEvent('2', new Date('2024-01-02T00:00:00Z')),
      ];
      const controller = new AnimationController(makeConfig(events));
      controller.play();
      controller.tick(5); // advance halfway
      controller.reset();
      expect(controller.getState()).toBe('stopped');
      expect(controller.getProgress()).toBe(0);
      expect(controller.getVirtualTime().getTime()).toBe(new Date('2024-01-01T00:00:00Z').getTime());
    });

    it('pause retains virtual time position', () => {
      const events = [
        makeEvent('1', new Date('2024-01-01T00:00:00Z')),
        makeEvent('2', new Date('2024-01-02T00:00:00Z')),
      ];
      const controller = new AnimationController(makeConfig(events));
      controller.play();
      controller.tick(5); // advance halfway (10s default duration, 5s = 50%)
      const timeBeforePause = controller.getVirtualTime().getTime();
      controller.pause();
      controller.tick(5); // should not advance while paused
      expect(controller.getVirtualTime().getTime()).toBe(timeBeforePause);
    });
  });

  describe('tick and virtual time advancement', () => {
    it('advances virtual time when playing', () => {
      const events = [
        makeEvent('1', new Date('2024-01-01T00:00:00Z')),
        makeEvent('2', new Date('2024-01-02T00:00:00Z')),
      ];
      const controller = new AnimationController(makeConfig(events));
      controller.play();
      controller.tick(5); // 5s of 10s default = 50%
      expect(controller.getProgress()).toBeCloseTo(0.5, 5);
    });

    it('does not advance virtual time when paused', () => {
      const events = [
        makeEvent('1', new Date('2024-01-01T00:00:00Z')),
        makeEvent('2', new Date('2024-01-02T00:00:00Z')),
      ];
      const controller = new AnimationController(makeConfig(events));
      controller.pause();
      controller.tick(5);
      expect(controller.getProgress()).toBe(0);
    });

    it('does not advance virtual time when stopped', () => {
      const events = [
        makeEvent('1', new Date('2024-01-01T00:00:00Z')),
        makeEvent('2', new Date('2024-01-02T00:00:00Z')),
      ];
      const controller = new AnimationController(makeConfig(events));
      controller.tick(5);
      expect(controller.getProgress()).toBe(0);
    });

    it('clamps progress to 1.0 at the end', () => {
      const events = [
        makeEvent('1', new Date('2024-01-01T00:00:00Z')),
        makeEvent('2', new Date('2024-01-02T00:00:00Z')),
      ];
      const controller = new AnimationController(makeConfig(events));
      controller.play();
      controller.tick(20); // overshoot
      expect(controller.getProgress()).toBe(1.0);
    });

    it('pauses automatically at the end of the animation', () => {
      const events = [
        makeEvent('1', new Date('2024-01-01T00:00:00Z')),
        makeEvent('2', new Date('2024-01-02T00:00:00Z')),
      ];
      const controller = new AnimationController(makeConfig(events));
      controller.play();
      controller.tick(20); // overshoot
      expect(controller.getState()).toBe('paused');
    });
  });

  describe('speed multiplier', () => {
    it('2x speed completes in half the time', () => {
      const events = [
        makeEvent('1', new Date('2024-01-01T00:00:00Z')),
        makeEvent('2', new Date('2024-01-02T00:00:00Z')),
      ];
      const controller = new AnimationController(makeConfig(events, { speedMultiplier: 2 }));
      controller.play();
      controller.tick(5); // 5s with 2x speed → effective duration = 5s → full progress
      expect(controller.getProgress()).toBe(1.0);
    });

    it('0.5x speed takes twice as long', () => {
      const events = [
        makeEvent('1', new Date('2024-01-01T00:00:00Z')),
        makeEvent('2', new Date('2024-01-02T00:00:00Z')),
      ];
      const controller = new AnimationController(makeConfig(events, { speedMultiplier: 0.5 }));
      controller.play();
      controller.tick(10); // 10s with 0.5x → effective duration = 20s → 50%
      expect(controller.getProgress()).toBeCloseTo(0.5, 5);
    });

    it('setSpeed changes speed without resetting position', () => {
      const events = [
        makeEvent('1', new Date('2024-01-01T00:00:00Z')),
        makeEvent('2', new Date('2024-01-02T00:00:00Z')),
      ];
      const controller = new AnimationController(makeConfig(events));
      controller.play();
      controller.tick(5); // 50% at 1x
      const progressBefore = controller.getProgress();
      const timeBefore = controller.getVirtualTime().getTime();
      controller.setSpeed(4);
      // Progress and virtual time should not change after setSpeed
      expect(controller.getProgress()).toBe(progressBefore);
      expect(controller.getVirtualTime().getTime()).toBe(timeBefore);
    });
  });

  describe('visible events computation', () => {
    it('shows only events with timestamp <= virtualTime', () => {
      const events = [
        makeEvent('1', new Date('2024-01-01T00:00:00Z')),
        makeEvent('2', new Date('2024-01-01T12:00:00Z')),
        makeEvent('3', new Date('2024-01-02T00:00:00Z')),
      ];
      const controller = new AnimationController(makeConfig(events));
      const results: VisibleEvent[][] = [];
      controller.onFrame((visible) => results.push(visible));

      controller.play();
      controller.tick(5); // 50% progress → virtualTime at midpoint = Jan 1 12:00
      // At 50%, virtualTime = startTime + 0.5 * timeSpan
      // startTime = Jan 1 00:00, endTime = Jan 2 00:00, span = 24h
      // virtualTime = Jan 1 12:00 → events 1 and 2 are visible
      expect(results[0].length).toBe(2);
      expect(results[0].map(v => v.event.id)).toContain('1');
      expect(results[0].map(v => v.event.id)).toContain('2');
    });

    it('shows all events when progress reaches 1.0', () => {
      const events = [
        makeEvent('1', new Date('2024-01-01T00:00:00Z')),
        makeEvent('2', new Date('2024-01-01T12:00:00Z')),
        makeEvent('3', new Date('2024-01-02T00:00:00Z')),
      ];
      const controller = new AnimationController(makeConfig(events));
      const results: VisibleEvent[][] = [];
      controller.onFrame((visible) => results.push(visible));

      controller.play();
      controller.tick(10); // 100%
      expect(results[0].length).toBe(3);
    });

    it('shows first event immediately at start', () => {
      const events = [
        makeEvent('1', new Date('2024-01-01T00:00:00Z')),
        makeEvent('2', new Date('2024-01-02T00:00:00Z')),
      ];
      const controller = new AnimationController(makeConfig(events));
      const results: VisibleEvent[][] = [];
      controller.onFrame((visible) => results.push(visible));

      // Even without playing, tick should compute visible events at current position
      controller.tick(0);
      expect(results[0].length).toBe(1);
      expect(results[0][0].event.id).toBe('1');
    });
  });

  describe('age calculation', () => {
    it('first event at start has age 0', () => {
      const events = [
        makeEvent('1', new Date('2024-01-01T00:00:00Z')),
        makeEvent('2', new Date('2024-01-02T00:00:00Z')),
      ];
      const controller = new AnimationController(makeConfig(events));
      const results: VisibleEvent[][] = [];
      controller.onFrame((visible) => results.push(visible));

      controller.tick(0);
      expect(results[0][0].age).toBe(0);
    });

    it('first event age increases over time', () => {
      const events = [
        makeEvent('1', new Date('2024-01-01T00:00:00Z')),
        makeEvent('2', new Date('2024-01-02T00:00:00Z')),
      ];
      const controller = new AnimationController(makeConfig(events));
      const results: VisibleEvent[][] = [];
      controller.onFrame((visible) => results.push(visible));

      controller.play();
      controller.tick(5); // 50%
      // age of event 1 = (virtualTime - event1.time) / timeSpan = 0.5
      expect(results[0][0].age).toBeCloseTo(0.5, 5);
    });

    it('newest event has age 0 or close to 0', () => {
      const events = [
        makeEvent('1', new Date('2024-01-01T00:00:00Z')),
        makeEvent('2', new Date('2024-01-02T00:00:00Z')),
      ];
      const controller = new AnimationController(makeConfig(events));
      const results: VisibleEvent[][] = [];
      controller.onFrame((visible) => results.push(visible));

      controller.play();
      controller.tick(10); // 100% → event 2 just appeared
      const event2 = results[0].find(v => v.event.id === '2');
      expect(event2!.age).toBe(0);
    });
  });

  describe('highlight (isNew and highlightProgress)', () => {
    it('newly appeared event has isNew = true', () => {
      const events = [
        makeEvent('1', new Date('2024-01-01T00:00:00Z')),
        makeEvent('2', new Date('2024-01-02T00:00:00Z')),
      ];
      const controller = new AnimationController(makeConfig(events));
      const results: VisibleEvent[][] = [];
      controller.onFrame((visible) => results.push(visible));

      controller.tick(0); // first tick, event 1 just appeared
      expect(results[0][0].isNew).toBe(true);
      expect(results[0][0].highlightProgress).toBe(0);
    });

    it('event loses isNew after 0.5s real time since appearance', () => {
      const events = [
        makeEvent('1', new Date('2024-01-01T00:00:00Z')),
        makeEvent('2', new Date('2024-01-02T00:00:00Z')),
      ];
      const controller = new AnimationController(makeConfig(events));
      const results: VisibleEvent[][] = [];
      controller.onFrame((visible) => results.push([...visible]));

      controller.play();
      // First tick: event appears, its appearance real-time is recorded
      controller.tick(0.1); // event appears at realTimeElapsed = 0.1
      results.length = 0;
      // Need 0.5s MORE real time after appearance → total realTimeElapsed = 0.6
      controller.tick(0.5); // realTimeElapsed = 0.6, timeSinceAppearance = 0.5
      results.length = 0;
      controller.tick(0.01); // realTimeElapsed = 0.61, timeSinceAppearance = 0.51 > 0.5
      expect(results[0][0].isNew).toBe(false);
      expect(results[0][0].highlightProgress).toBe(1.0);
    });

    it('highlightProgress increases from 0 to 1 over 0.5s', () => {
      const events = [
        makeEvent('1', new Date('2024-01-01T00:00:00Z')),
        makeEvent('2', new Date('2024-01-02T00:00:00Z')),
      ];
      const controller = new AnimationController(makeConfig(events));
      const results: VisibleEvent[][] = [];
      controller.onFrame((visible) => results.push([...visible]));

      controller.play();
      // First tick: event appears at realTimeElapsed after this tick
      controller.tick(0.01); // event appears at ~0.01
      results.length = 0;
      // After 0.25s more → timeSinceAppearance ≈ 0.25 → highlightProgress ≈ 0.5
      controller.tick(0.25);
      expect(results[0][0].isNew).toBe(true);
      expect(results[0][0].highlightProgress).toBeCloseTo(0.5, 1);
    });
  });

  describe('onFrame callback', () => {
    it('fires callback on every tick', () => {
      const events = [
        makeEvent('1', new Date('2024-01-01T00:00:00Z')),
        makeEvent('2', new Date('2024-01-02T00:00:00Z')),
      ];
      const controller = new AnimationController(makeConfig(events));
      const callback = vi.fn();
      controller.onFrame(callback);

      controller.tick(0);
      controller.tick(0.1);
      controller.tick(0.1);
      expect(callback).toHaveBeenCalledTimes(3);
    });

    it('passes virtual time as second argument', () => {
      const events = [
        makeEvent('1', new Date('2024-01-01T00:00:00Z')),
        makeEvent('2', new Date('2024-01-02T00:00:00Z')),
      ];
      const controller = new AnimationController(makeConfig(events));
      const callback = vi.fn();
      controller.onFrame(callback);

      controller.play();
      controller.tick(5);
      const [, virtualTime] = callback.mock.calls[0];
      expect(virtualTime).toBeInstanceOf(Date);
    });

    it('supports multiple callbacks', () => {
      const events = [
        makeEvent('1', new Date('2024-01-01T00:00:00Z')),
      ];
      const controller = new AnimationController(makeConfig(events));
      const cb1 = vi.fn();
      const cb2 = vi.fn();
      controller.onFrame(cb1);
      controller.onFrame(cb2);

      controller.tick(0);
      expect(cb1).toHaveBeenCalledTimes(1);
      expect(cb2).toHaveBeenCalledTimes(1);
    });
  });

  describe('events sorted chronologically', () => {
    it('handles unsorted input events correctly', () => {
      const events = [
        makeEvent('3', new Date('2024-01-03T00:00:00Z')),
        makeEvent('1', new Date('2024-01-01T00:00:00Z')),
        makeEvent('2', new Date('2024-01-02T00:00:00Z')),
      ];
      const controller = new AnimationController(makeConfig(events));
      const results: VisibleEvent[][] = [];
      controller.onFrame((visible) => results.push([...visible]));

      controller.play();
      controller.tick(10); // complete
      // All 3 events visible, sorted
      expect(results[0].length).toBe(3);
      expect(results[0][0].event.id).toBe('1');
      expect(results[0][1].event.id).toBe('2');
      expect(results[0][2].event.id).toBe('3');
    });
  });
});
