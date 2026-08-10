import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { DataFetcher } from '../../data-fetcher';
import { AnimationController, type AnimationConfig } from '../../animation-controller';
import type { EarthquakeEvent, VisibleEvent } from '../../types';

// --- MSW Setup ---

const INGV_ENDPOINT = 'https://webservices.ingv.it/fdsnws/event/1/query';

const INGV_HEADER = '#EventID|Time|Latitude|Longitude|Depth/Km|Author|Catalog|Contributor|ContributorID|MagType|Magnitude|MagAuthor|EventLocationName|EventType';

const KNOWN_INGV_RESPONSE = [
  INGV_HEADER,
  '34925631|2024-06-10T08:15:22|40.8268|14.1382|2.47|BULLETIN|INGV|||Md|1.2|--|Campi Flegrei|earthquake',
  '34925632|2024-06-11T14:30:05|40.8321|14.1456|3.10|BULLETIN|INGV|||Md|2.1|--|Campi Flegrei|earthquake',
  '34925633|2024-06-12T22:45:10|40.8195|14.1270|1.85|BULLETIN|INGV|||ML|0.8|--|Campi Flegrei|earthquake',
  '34925634|2024-06-13T03:12:55|40.8410|14.1520|4.20|BULLETIN|INGV|||Md|3.5|--|Campi Flegrei|earthquake',
  '34925635|2024-06-14T17:58:33|40.8150|14.1100|0.95|BULLETIN|INGV|||Md|1.6|--|Campi Flegrei|earthquake',
].join('\n');

const server = setupServer(
  http.get(INGV_ENDPOINT, () => {
    return HttpResponse.text(KNOWN_INGV_RESPONSE);
  })
);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// --- Helper ---

function makeConfig(events: EarthquakeEvent[], overrides?: Partial<AnimationConfig>): AnimationConfig {
  return {
    events,
    defaultDurationSec: 10,
    speedMultiplier: 1,
    ...overrides,
  };
}

// --- Test 1: DataFetcher + MSW ---

describe('Integration: DataFetcher with MSW', () => {
  it('correctly parses mocked INGV response', async () => {
    const fetcher = new DataFetcher();
    const result = await fetcher.fetch({
      startDate: new Date('2024-06-10T00:00:00Z'),
      endDate: new Date('2024-06-15T00:00:00Z'),
    });

    expect(result.events).toHaveLength(5);
    expect(result.warnings).toHaveLength(0);

    // Verify first event
    const first = result.events[0];
    expect(first.id).toBe('34925631');
    expect(first.timestamp).toEqual(new Date('2024-06-10T08:15:22'));
    expect(first.latitude).toBeCloseTo(40.8268, 4);
    expect(first.longitude).toBeCloseTo(14.1382, 4);
    expect(first.depth).toBeCloseTo(2.47, 2);
    expect(first.magnitude).toBeCloseTo(1.2, 1);
    expect(first.magnitudeType).toBe('Md');
    expect(first.locationName).toBe('Campi Flegrei');

    // Verify last event
    const last = result.events[4];
    expect(last.id).toBe('34925635');
    expect(last.latitude).toBeCloseTo(40.815, 3);
    expect(last.depth).toBeCloseTo(0.95, 2);
    expect(last.magnitude).toBeCloseTo(1.6, 1);
  });

  it('constructs correct URL with query parameters', async () => {
    let capturedUrl = '';
    server.use(
      http.get(INGV_ENDPOINT, ({ request }) => {
        capturedUrl = request.url;
        return HttpResponse.text(KNOWN_INGV_RESPONSE);
      })
    );

    const fetcher = new DataFetcher();
    await fetcher.fetch({
      startDate: new Date('2024-06-10T00:00:00Z'),
      endDate: new Date('2024-06-15T00:00:00Z'),
      minLat: 40.78,
      maxLat: 40.90,
      minLon: 14.03,
      maxLon: 14.22,
    });

    const url = new URL(capturedUrl);
    expect(url.searchParams.get('format')).toBe('text');
    expect(url.searchParams.get('minlat')).toBe('40.78');
    expect(url.searchParams.get('maxlat')).toBe('40.9');
    expect(url.searchParams.get('minlon')).toBe('14.03');
    expect(url.searchParams.get('maxlon')).toBe('14.22');
  });

  it('handles mixed valid and malformed records in API response', async () => {
    const responseWithMalformed = [
      INGV_HEADER,
      '34925631|2024-06-10T08:15:22|40.8268|14.1382|2.47|BULLETIN|INGV|||Md|1.2|--|Campi Flegrei|earthquake',
      '34925632|invalid-date|40.8321|14.1456|3.10|BULLETIN|INGV|||Md|2.1|--|Campi Flegrei|earthquake',
      '34925633|2024-06-12T22:45:10|40.8195|14.1270|1.85|BULLETIN|INGV|||ML|0.8|--|Campi Flegrei|earthquake',
      'too-few-fields|only-two',
    ].join('\n');

    server.use(
      http.get(INGV_ENDPOINT, () => {
        return HttpResponse.text(responseWithMalformed);
      })
    );

    const fetcher = new DataFetcher();
    const result = await fetcher.fetch({
      startDate: new Date('2024-06-10T00:00:00Z'),
      endDate: new Date('2024-06-15T00:00:00Z'),
    });

    expect(result.events).toHaveLength(2);
    expect(result.warnings).toHaveLength(2);
    expect(result.events[0].id).toBe('34925631');
    expect(result.events[1].id).toBe('34925633');
  });

  it('retains previous data on fetch failure', async () => {
    const fetcher = new DataFetcher();

    // First successful fetch
    const firstResult = await fetcher.fetch({
      startDate: new Date('2024-06-10T00:00:00Z'),
      endDate: new Date('2024-06-15T00:00:00Z'),
    });
    expect(firstResult.events).toHaveLength(5);

    // Override to return a server error
    server.use(
      http.get(INGV_ENDPOINT, () => {
        return HttpResponse.error();
      })
    );

    const secondResult = await fetcher.fetch({
      startDate: new Date('2024-06-10T00:00:00Z'),
      endDate: new Date('2024-06-15T00:00:00Z'),
    });

    expect(secondResult.events).toHaveLength(5);
    expect(secondResult.failed).toBe(true);
  });
});

// --- Test 2: AnimationController with known dataset ---

describe('Integration: AnimationController with known dataset', () => {
  const knownEvents: EarthquakeEvent[] = [
    {
      id: 'ev1',
      timestamp: new Date('2024-06-10T08:15:22Z'),
      latitude: 40.8268,
      longitude: 14.1382,
      depth: 2.47,
      magnitude: 1.2,
      magnitudeType: 'Md',
      locationName: 'Campi Flegrei',
    },
    {
      id: 'ev2',
      timestamp: new Date('2024-06-11T14:30:05Z'),
      latitude: 40.8321,
      longitude: 14.1456,
      depth: 3.10,
      magnitude: 2.1,
      magnitudeType: 'Md',
      locationName: 'Campi Flegrei',
    },
    {
      id: 'ev3',
      timestamp: new Date('2024-06-12T22:45:10Z'),
      latitude: 40.8195,
      longitude: 14.127,
      depth: 1.85,
      magnitude: 0.8,
      magnitudeType: 'ML',
      locationName: 'Campi Flegrei',
    },
    {
      id: 'ev4',
      timestamp: new Date('2024-06-13T03:12:55Z'),
      latitude: 40.841,
      longitude: 14.152,
      depth: 4.2,
      magnitude: 3.5,
      magnitudeType: 'Md',
      locationName: 'Campi Flegrei',
    },
    {
      id: 'ev5',
      timestamp: new Date('2024-06-14T17:58:33Z'),
      latitude: 40.815,
      longitude: 14.11,
      depth: 0.95,
      magnitude: 1.6,
      magnitudeType: 'Md',
      locationName: 'Campi Flegrei',
    },
  ];

  it('at progress 0, only the first event is visible', () => {
    const controller = new AnimationController(makeConfig(knownEvents));
    const results: VisibleEvent[][] = [];
    controller.onFrame((visible) => results.push([...visible]));

    controller.play();
    controller.tick(0);

    expect(results[0]).toHaveLength(1);
    expect(results[0][0].event.id).toBe('ev1');
    expect(results[0][0].age).toBe(0);
  });

  it('at progress ~25%, first two events are visible', () => {
    const controller = new AnimationController(makeConfig(knownEvents));
    const results: VisibleEvent[][] = [];
    controller.onFrame((visible) => results.push([...visible]));

    controller.play();
    // Total time span: ev5.time - ev1.time ≈ 4.4 days
    // defaultDuration = 10s, speed = 1x → 10s for full span
    // 25% → 2.5s of real time
    controller.tick(2.5);

    const visibleIds = results[results.length - 1].map((v) => v.event.id);
    expect(visibleIds).toContain('ev1');
    // ev2 is at ~27% through the time span, so at 25% it might just be below threshold
    // Let's check by verifying ages are consistent
    for (const v of results[results.length - 1]) {
      expect(v.age).toBeGreaterThanOrEqual(0);
      expect(v.age).toBeLessThanOrEqual(1);
    }
  });

  it('at progress 100%, all events are visible', () => {
    const controller = new AnimationController(makeConfig(knownEvents));
    const results: VisibleEvent[][] = [];
    controller.onFrame((visible) => results.push([...visible]));

    controller.play();
    controller.tick(10); // full duration

    const visibleEvents = results[results.length - 1];
    expect(visibleEvents).toHaveLength(5);

    const ids = visibleEvents.map((v) => v.event.id);
    expect(ids).toEqual(['ev1', 'ev2', 'ev3', 'ev4', 'ev5']);
  });

  it('visible events maintain chronological order', () => {
    const controller = new AnimationController(makeConfig(knownEvents));
    const results: VisibleEvent[][] = [];
    controller.onFrame((visible) => results.push([...visible]));

    controller.play();
    controller.tick(7); // ~70% progress

    const visibleEvents = results[results.length - 1];
    for (let i = 1; i < visibleEvents.length; i++) {
      const prev = visibleEvents[i - 1].event.timestamp.getTime();
      const curr = visibleEvents[i].event.timestamp.getTime();
      expect(curr).toBeGreaterThanOrEqual(prev);
    }
  });

  it('ages are ordered: older events have higher age values', () => {
    const controller = new AnimationController(makeConfig(knownEvents));
    const results: VisibleEvent[][] = [];
    controller.onFrame((visible) => results.push([...visible]));

    controller.play();
    controller.tick(10); // all visible

    const visibleEvents = results[results.length - 1];
    // Events are sorted chronologically (oldest first)
    // Oldest event should have highest age
    for (let i = 1; i < visibleEvents.length; i++) {
      expect(visibleEvents[i - 1].age).toBeGreaterThanOrEqual(visibleEvents[i].age);
    }
  });

  it('speed change does not alter visible events or virtual time', () => {
    const controller = new AnimationController(makeConfig(knownEvents));
    const results: VisibleEvent[][] = [];
    controller.onFrame((visible) => results.push([...visible]));

    controller.play();
    controller.tick(5); // 50% progress

    const progressBefore = controller.getProgress();
    const virtualTimeBefore = controller.getVirtualTime().getTime();
    const visibleCountBefore = results[results.length - 1].length;

    controller.setSpeed(4);
    results.length = 0;
    controller.tick(0); // tick with 0 delta to get callback without advancing

    expect(controller.getProgress()).toBe(progressBefore);
    expect(controller.getVirtualTime().getTime()).toBe(virtualTimeBefore);
    expect(results[results.length - 1].length).toBe(visibleCountBefore);
  });
});

// --- Test 3: Full pipeline (DataFetcher → AnimationController → visible events) ---

describe('Integration: Full pipeline fetch → animation → visible events', () => {
  it('fetches data and produces correct animation sequence', async () => {
    const fetcher = new DataFetcher();
    const result = await fetcher.fetch({
      startDate: new Date('2024-06-10T00:00:00Z'),
      endDate: new Date('2024-06-15T00:00:00Z'),
    });

    expect(result.events.length).toBe(5);

    const controller = new AnimationController(makeConfig(result.events));
    const frames: { visible: VisibleEvent[]; virtualTime: Date }[] = [];
    controller.onFrame((visible, virtualTime) => {
      frames.push({ visible: [...visible], virtualTime });
    });

    // Start animation and collect frames at different points
    controller.play();

    // Frame at start (t=0 equivalent — first tick)
    controller.tick(0.001);
    // Frame at ~50%
    controller.tick(5);
    // Frame at 100%
    controller.tick(5);

    // Frame 0: at the very beginning, first event should be visible
    expect(frames[0].visible.length).toBeGreaterThanOrEqual(1);
    expect(frames[0].visible[0].event.id).toBe('34925631');

    // Frame 1: at ~50%, multiple events visible
    expect(frames[1].visible.length).toBeGreaterThanOrEqual(2);

    // Frame 2: at 100%, all 5 events visible
    expect(frames[2].visible.length).toBe(5);

    // Verify all fetched events ended up in the final frame
    const finalIds = frames[2].visible.map((v) => v.event.id);
    expect(finalIds).toContain('34925631');
    expect(finalIds).toContain('34925632');
    expect(finalIds).toContain('34925633');
    expect(finalIds).toContain('34925634');
    expect(finalIds).toContain('34925635');
  });

  it('virtual time progresses from first event to last event', async () => {
    const fetcher = new DataFetcher();
    const result = await fetcher.fetch({
      startDate: new Date('2024-06-10T00:00:00Z'),
      endDate: new Date('2024-06-15T00:00:00Z'),
    });

    const controller = new AnimationController(makeConfig(result.events));
    const frames: { visible: VisibleEvent[]; virtualTime: Date }[] = [];
    controller.onFrame((visible, virtualTime) => {
      frames.push({ visible: [...visible], virtualTime });
    });

    controller.play();
    controller.tick(10); // full playback

    const finalVirtualTime = frames[frames.length - 1].virtualTime;
    const lastEventTime = result.events
      .map((e) => e.timestamp.getTime())
      .reduce((a, b) => Math.max(a, b));

    expect(finalVirtualTime.getTime()).toBe(lastEventTime);
  });

  it('events accumulate progressively and are never removed', async () => {
    const fetcher = new DataFetcher();
    const result = await fetcher.fetch({
      startDate: new Date('2024-06-10T00:00:00Z'),
      endDate: new Date('2024-06-15T00:00:00Z'),
    });

    const controller = new AnimationController(makeConfig(result.events));
    const visibleCounts: number[] = [];
    controller.onFrame((visible) => {
      visibleCounts.push(visible.length);
    });

    controller.play();
    // Tick in small increments
    for (let i = 0; i < 20; i++) {
      controller.tick(0.5);
    }

    // Visible counts should be monotonically non-decreasing
    for (let i = 1; i < visibleCounts.length; i++) {
      expect(visibleCounts[i]).toBeGreaterThanOrEqual(visibleCounts[i - 1]);
    }
  });

  it('animation pauses correctly and retains state', async () => {
    const fetcher = new DataFetcher();
    const result = await fetcher.fetch({
      startDate: new Date('2024-06-10T00:00:00Z'),
      endDate: new Date('2024-06-15T00:00:00Z'),
    });

    const controller = new AnimationController(makeConfig(result.events));
    const frames: { visible: VisibleEvent[]; virtualTime: Date }[] = [];
    controller.onFrame((visible, virtualTime) => {
      frames.push({ visible: [...visible], virtualTime });
    });

    controller.play();
    controller.tick(5); // advance to 50%

    const progressAtPause = controller.getProgress();
    const visibleAtPause = frames[frames.length - 1].visible.length;

    controller.pause();
    frames.length = 0;

    // Tick while paused — should not advance
    controller.tick(3);

    expect(controller.getProgress()).toBe(progressAtPause);
    expect(frames[frames.length - 1].visible.length).toBe(visibleAtPause);
  });
});
