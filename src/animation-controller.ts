import type { EarthquakeEvent, VisibleEvent } from './types';

export interface AnimationConfig {
  events: EarthquakeEvent[];
  defaultDurationSec: number;  // 10-30s for full playback
  speedMultiplier: number;     // 0.25x to 8x
}

export type AnimationState = 'playing' | 'paused' | 'stopped';

type FrameCallback = (visibleEvents: VisibleEvent[], virtualTime: Date) => void;

export class AnimationController {
  private config: AnimationConfig;
  private state: AnimationState = 'stopped';
  private virtualTimeMs: number;
  private startTimeMs: number;
  private endTimeMs: number;
  private timeSpanMs: number;
  private frameCallbacks: FrameCallback[] = [];
  private sortedEvents: EarthquakeEvent[];

  // Track real-time appearance of each event for highlight calculation
  private appearanceRealTime: Map<string, number> = new Map();
  private realTimeElapsed: number = 0;

  // Highlight window in real-time seconds
  private readonly highlightDurationSec = 0.5;

  constructor(config: AnimationConfig) {
    this.config = { ...config };
    this.sortedEvents = [...config.events].sort(
      (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
    );

    if (this.sortedEvents.length === 0) {
      this.startTimeMs = 0;
      this.endTimeMs = 0;
      this.timeSpanMs = 0;
    } else {
      this.startTimeMs = this.sortedEvents[0].timestamp.getTime();
      this.endTimeMs = this.sortedEvents[this.sortedEvents.length - 1].timestamp.getTime();
      this.timeSpanMs = this.endTimeMs - this.startTimeMs;
    }

    // Start at the beginning
    this.virtualTimeMs = this.startTimeMs;
  }

  play(): void {
    if (this.state === 'playing') return;
    this.state = 'playing';
  }

  pause(): void {
    if (this.state === 'paused') return;
    this.state = 'paused';
  }

  reset(): void {
    this.state = 'stopped';
    this.virtualTimeMs = this.startTimeMs;
    this.realTimeElapsed = 0;
    this.appearanceRealTime.clear();
  }

  setSpeed(multiplier: number): void {
    this.config.speedMultiplier = multiplier;
  }

  getState(): AnimationState {
    return this.state;
  }

  getVirtualTime(): Date {
    return new Date(this.virtualTimeMs);
  }

  getProgress(): number {
    if (this.timeSpanMs === 0) return 0;
    return (this.virtualTimeMs - this.startTimeMs) / this.timeSpanMs;
  }

  onFrame(callback: FrameCallback): void {
    this.frameCallbacks.push(callback);
  }

  /**
   * Advance the animation by deltaTime (in seconds of real time).
   * Speed calculation: virtualTimeSpeed = timeSpanMs / (defaultDurationSec / speedMultiplier)
   * This means the entire time span plays in (defaultDurationSec / speedMultiplier) seconds.
   */
  tick(deltaTime: number): void {
    if (this.state === 'playing') {
      // Calculate how fast virtual time advances (ms of virtual time per second of real time)
      const effectiveDurationSec = this.config.defaultDurationSec / this.config.speedMultiplier;
      const virtualTimeSpeed = this.timeSpanMs / effectiveDurationSec; // ms virtual per second real

      // Advance virtual time
      this.virtualTimeMs += virtualTimeSpeed * deltaTime;

      // Clamp to end
      if (this.virtualTimeMs >= this.endTimeMs) {
        this.virtualTimeMs = this.endTimeMs;
        this.state = 'paused';
      }

      // Track real time for highlight calculations
      this.realTimeElapsed += deltaTime;
    }

    // Compute visible events
    const visibleEvents = this.computeVisibleEvents();

    // Fire callbacks
    const virtualTime = new Date(this.virtualTimeMs);
    for (const callback of this.frameCallbacks) {
      callback(visibleEvents, virtualTime);
    }
  }

  private computeVisibleEvents(): VisibleEvent[] {
    const visible: VisibleEvent[] = [];

    for (const event of this.sortedEvents) {
      const eventTimeMs = event.timestamp.getTime();
      if (eventTimeMs > this.virtualTimeMs) break; // sorted, so no more visible after this

      // Track when this event first appeared (real-time)
      if (!this.appearanceRealTime.has(event.id)) {
        this.appearanceRealTime.set(event.id, this.realTimeElapsed);
      }

      // age: normalized position within the time span
      const age = this.timeSpanMs === 0
        ? 0
        : (this.virtualTimeMs - eventTimeMs) / this.timeSpanMs;

      // Highlight: isNew for 0.5s real-time after first appearance
      const appearedAt = this.appearanceRealTime.get(event.id)!;
      const timeSinceAppearance = this.realTimeElapsed - appearedAt;
      const isNew = timeSinceAppearance < this.highlightDurationSec;
      const highlightProgress = isNew
        ? Math.min(timeSinceAppearance / this.highlightDurationSec, 1.0)
        : 1.0;

      visible.push({
        event,
        age,
        isNew,
        highlightProgress,
      });
    }

    return visible;
  }
}
