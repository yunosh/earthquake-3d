import { describe, it, expect, vi, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { DataFetcher } from '../../data-fetcher';
import type { GeoBounds } from '../../types';

/**
 * Property 2: Activated region drives fetch URL construction
 *
 * For any RegionConfig with a given apiEndpoint and bounds, after configuring
 * the DataFetcher with that config, the constructed fetch URL shall use that
 * config's endpoint as base URL and include the bounding box parameters
 * (minlat, maxlat, minlon, maxlon) from that config.
 *
 * Validates: Requirements 3.1
 */
describe('Feature: multi-region-canary-islands, Property 2: Activated region drives fetch URL construction', () => {
  // Generate valid HTTP(S) endpoint URLs
  const endpointArb = fc.record({
    protocol: fc.constantFrom('https://', 'http://'),
    host: fc.stringMatching(/^[a-z]{3,12}\.[a-z]{2,6}$/),
    path: fc.stringMatching(/^\/[a-z]{1,10}(\/[a-z]{1,10}){0,3}$/),
  }).map(({ protocol, host, path }) => `${protocol}${host}${path}`);

  // Generate valid geographic bounds
  const boundsArb = fc.record({
    minLat: fc.double({ min: -90, max: 89, noNaN: true, noDefaultInfinity: true }),
    maxLat: fc.double({ min: -89, max: 90, noNaN: true, noDefaultInfinity: true }),
    minLon: fc.double({ min: -180, max: 179, noNaN: true, noDefaultInfinity: true }),
    maxLon: fc.double({ min: -179, max: 180, noNaN: true, noDefaultInfinity: true }),
  }).filter(b => b.minLat < b.maxLat && b.minLon < b.maxLon) as fc.Arbitrary<GeoBounds>;

  it('buildUrl uses the configured endpoint and includes bounding box parameters', () => {
    fc.assert(
      fc.property(
        endpointArb,
        boundsArb,
        (endpoint, bounds) => {
          const fetcher = new DataFetcher();
          fetcher.configure(endpoint, bounds);

          const now = new Date();
          const url = fetcher.buildUrl({
            startDate: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
            endDate: now,
            minLat: bounds.minLat,
            maxLat: bounds.maxLat,
            minLon: bounds.minLon,
            maxLon: bounds.maxLon,
            timeoutMs: 15000,
          });

          // URL starts with the configured endpoint
          expect(url.startsWith(endpoint)).toBe(true);

          // URL contains the bounding box parameters from the config
          const urlObj = new URL(url);
          expect(urlObj.searchParams.get('minlat')).toBe(String(bounds.minLat));
          expect(urlObj.searchParams.get('maxlat')).toBe(String(bounds.maxLat));
          expect(urlObj.searchParams.get('minlon')).toBe(String(bounds.minLon));
          expect(urlObj.searchParams.get('maxlon')).toBe(String(bounds.maxLon));
          expect(urlObj.searchParams.get('format')).toBe('text');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('buildUrl uses default bounds from configure when options do not override', () => {
    fc.assert(
      fc.property(
        endpointArb,
        boundsArb,
        (endpoint, bounds) => {
          const fetcher = new DataFetcher();
          fetcher.configure(endpoint, bounds);

          const now = new Date();
          // Call buildUrl without explicit bounds in options (use undefined)
          const url = fetcher.buildUrl({
            startDate: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
            endDate: now,
            timeoutMs: 15000,
          });

          // URL starts with the configured endpoint
          expect(url.startsWith(endpoint)).toBe(true);

          // URL contains the default bounds from configure()
          const urlObj = new URL(url);
          expect(urlObj.searchParams.get('minlat')).toBe(String(bounds.minLat));
          expect(urlObj.searchParams.get('maxlat')).toBe(String(bounds.maxLat));
          expect(urlObj.searchParams.get('minlon')).toBe(String(bounds.minLon));
          expect(urlObj.searchParams.get('maxlon')).toBe(String(bounds.maxLon));
        }
      ),
      { numRuns: 100 }
    );
  });
});

/**
 * Property 3: FDSN text parsing round-trip
 *
 * For any valid EarthquakeEvent, formatting it as an FDSN pipe-delimited text
 * line and parsing it back with parseTextResponse shall produce an event with
 * equivalent id, timestamp, latitude, longitude, depth, magnitude, and
 * magnitudeType fields.
 *
 * Validates: Requirements 3.2
 */
describe('Feature: multi-region-canary-islands, Property 3: FDSN text parsing round-trip', () => {
  const fetcher = new DataFetcher();

  // Arbitrary for valid EventIDs (non-empty alphanumeric strings, no pipes)
  const eventIdArb = fc.stringMatching(/^[a-zA-Z0-9]{1,20}$/);

  // Arbitrary for valid timestamps
  const timestampArb = fc.record({
    year: fc.integer({ min: 2000, max: 2025 }),
    month: fc.integer({ min: 1, max: 12 }),
    day: fc.integer({ min: 1, max: 28 }),
    hour: fc.integer({ min: 0, max: 23 }),
    minute: fc.integer({ min: 0, max: 59 }),
    second: fc.integer({ min: 0, max: 59 }),
  }).map(({ year, month, day, hour, minute, second }) => {
    const pad = (n: number, len = 2) => n.toString().padStart(len, '0');
    const formatted = `${year}-${pad(month)}-${pad(day)}T${pad(hour)}:${pad(minute)}:${pad(second)}`;
    const expectedDate = new Date(formatted);
    return { formatted, expectedDate };
  });

  // Arbitrary for geographic coordinates (full range for multi-region)
  const latitudeArb = fc.double({ min: -90, max: 90, noNaN: true, noDefaultInfinity: true });
  const longitudeArb = fc.double({ min: -180, max: 180, noNaN: true, noDefaultInfinity: true });
  const depthArb = fc.double({ min: 0.01, max: 700, noNaN: true, noDefaultInfinity: true });
  const magnitudeArb = fc.double({ min: -2.0, max: 9.5, noNaN: true, noDefaultInfinity: true });
  const magTypeArb = fc.constantFrom('Md', 'ML', 'Mw', 'Mb', 'Ms', 'mb', 'mB');
  const locationNameArb = fc.stringMatching(/^[a-zA-Z0-9][a-zA-Z0-9 ]{0,28}[a-zA-Z0-9]$/).filter(s => s.length >= 1);

  function buildFDSNLine(params: {
    eventId: string;
    timestampStr: string;
    latitude: number;
    longitude: number;
    depth: number;
    magType: string;
    magnitude: number;
    locationName: string;
  }): string {
    return [
      params.eventId,
      params.timestampStr,
      params.latitude.toString(),
      params.longitude.toString(),
      params.depth.toString(),
      'AUTHOR',       // Author
      'CATALOG',      // Catalog
      '',             // Contributor
      '',             // ContributorID
      params.magType,
      params.magnitude.toString(),
      'MAGAUTHOR',    // MagAuthor
      params.locationName,
      'earthquake',   // EventType
    ].join('|');
  }

  it('parsing a formatted FDSN line produces equivalent event fields', () => {
    fc.assert(
      fc.property(
        eventIdArb,
        timestampArb,
        latitudeArb,
        longitudeArb,
        depthArb,
        magnitudeArb,
        magTypeArb,
        locationNameArb,
        (eventId, timestamp, latitude, longitude, depth, magnitude, magType, locationName) => {
          const line = buildFDSNLine({
            eventId,
            timestampStr: timestamp.formatted,
            latitude,
            longitude,
            depth,
            magType,
            magnitude,
            locationName,
          });

          const header = '#EventID|Time|Latitude|Longitude|Depth/Km|Author|Catalog|Contributor|ContributorID|MagType|Magnitude|MagAuthor|EventLocationName|EventType';
          const text = `${header}\n${line}`;

          const result = fetcher.parseTextResponse(text);

          expect(result.events).toHaveLength(1);
          expect(result.warnings).toHaveLength(0);

          const parsed = result.events[0]!;

          // ID round-trip
          expect(parsed.id).toBe(eventId);

          // Timestamp round-trip
          expect(parsed.timestamp.getTime()).toBe(timestamp.expectedDate.getTime());

          // Latitude round-trip
          expect(parsed.latitude).toBeCloseTo(latitude, 10);

          // Longitude round-trip
          expect(parsed.longitude).toBeCloseTo(longitude, 10);

          // Depth round-trip
          expect(parsed.depth).toBeCloseTo(depth, 10);

          // Magnitude round-trip
          expect(parsed.magnitude).toBeCloseTo(magnitude, 10);

          // MagnitudeType round-trip
          expect(parsed.magnitudeType).toBe(magType);

          // LocationName round-trip
          expect(parsed.locationName).toBe(locationName);
        }
      ),
      { numRuns: 100 }
    );
  });
});

/**
 * Property 4: Error retains previous data
 *
 * For any previously stored FetchResult with events, when a fetch fails
 * (network error, HTTP error, timeout), the returned FetchResult shall have
 * failed === true and contain the same events as the previous successful result.
 *
 * Validates: Requirements 3.3
 */
describe('Feature: multi-region-canary-islands, Property 4: Error retains previous data', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  // Generate random earthquake events
  const earthquakeEventArb = fc.record({
    id: fc.stringMatching(/^[a-zA-Z0-9]{1,15}$/),
    latitude: fc.double({ min: -90, max: 90, noNaN: true, noDefaultInfinity: true }),
    longitude: fc.double({ min: -180, max: 180, noNaN: true, noDefaultInfinity: true }),
    depth: fc.double({ min: 0.1, max: 300, noNaN: true, noDefaultInfinity: true }),
    magnitude: fc.double({ min: -1.0, max: 8.0, noNaN: true, noDefaultInfinity: true }),
    magType: fc.constantFrom('Md', 'ML', 'Mw'),
    locationName: fc.stringMatching(/^[a-zA-Z]{3,15}$/),
    year: fc.integer({ min: 2000, max: 2025 }),
    month: fc.integer({ min: 1, max: 12 }),
    day: fc.integer({ min: 1, max: 28 }),
    hour: fc.integer({ min: 0, max: 23 }),
    minute: fc.integer({ min: 0, max: 59 }),
    second: fc.integer({ min: 0, max: 59 }),
  });

  const eventsArb = fc.array(earthquakeEventArb, { minLength: 1, maxLength: 10 });

  function buildFDSNResponse(events: Array<{
    id: string;
    latitude: number;
    longitude: number;
    depth: number;
    magnitude: number;
    magType: string;
    locationName: string;
    year: number;
    month: number;
    day: number;
    hour: number;
    minute: number;
    second: number;
  }>): string {
    const header = '#EventID|Time|Latitude|Longitude|Depth/Km|Author|Catalog|Contributor|ContributorID|MagType|Magnitude|MagAuthor|EventLocationName|EventType';
    const pad = (n: number, len = 2) => n.toString().padStart(len, '0');
    const lines = events.map(e => {
      const timeStr = `${e.year}-${pad(e.month)}-${pad(e.day)}T${pad(e.hour)}:${pad(e.minute)}:${pad(e.second)}`;
      return [
        e.id,
        timeStr,
        e.latitude.toString(),
        e.longitude.toString(),
        e.depth.toString(),
        'AUTHOR',
        'CATALOG',
        '',
        '',
        e.magType,
        e.magnitude.toString(),
        'MAGAUTHOR',
        e.locationName,
        'earthquake',
      ].join('|');
    });
    return `${header}\n${lines.join('\n')}`;
  }

  it('failed fetch returns failed=true with previously loaded events', async () => {
    await fc.assert(
      fc.asyncProperty(
        eventsArb,
        async (events) => {
          const fetcher = new DataFetcher();
          const responseText = buildFDSNResponse(events);

          let callCount = 0;

          // Mock fetch: first call succeeds, second call fails
          globalThis.fetch = vi.fn().mockImplementation(() => {
            callCount++;
            if (callCount === 1) {
              return Promise.resolve({
                ok: true,
                text: () => Promise.resolve(responseText),
              });
            }
            // Second call: network error
            return Promise.reject(new Error('Network failure'));
          });

          // First fetch — should succeed
          const successResult = await fetcher.fetch();
          expect(successResult.failed).toBeUndefined();
          expect(successResult.events).toHaveLength(events.length);

          // Second fetch — should fail and retain previous data
          const failedResult = await fetcher.fetch();
          expect(failedResult.failed).toBe(true);
          expect(failedResult.events).toHaveLength(events.length);

          // Verify the events are the same as the successful fetch
          for (let i = 0; i < events.length; i++) {
            expect(failedResult.events[i]!.id).toBe(successResult.events[i]!.id);
            expect(failedResult.events[i]!.latitude).toBeCloseTo(successResult.events[i]!.latitude, 10);
            expect(failedResult.events[i]!.longitude).toBeCloseTo(successResult.events[i]!.longitude, 10);
            expect(failedResult.events[i]!.depth).toBeCloseTo(successResult.events[i]!.depth, 10);
            expect(failedResult.events[i]!.magnitude).toBeCloseTo(successResult.events[i]!.magnitude, 10);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('failed fetch with HTTP error retains previous data', async () => {
    await fc.assert(
      fc.asyncProperty(
        eventsArb,
        async (events) => {
          const fetcher = new DataFetcher();
          const responseText = buildFDSNResponse(events);

          let callCount = 0;

          // Mock fetch: first call succeeds, second returns HTTP 500
          globalThis.fetch = vi.fn().mockImplementation(() => {
            callCount++;
            if (callCount === 1) {
              return Promise.resolve({
                ok: true,
                text: () => Promise.resolve(responseText),
              });
            }
            // Second call: HTTP error
            return Promise.resolve({
              ok: false,
              status: 500,
              text: () => Promise.resolve('Internal Server Error'),
            });
          });

          // First fetch — succeeds
          const successResult = await fetcher.fetch();
          expect(successResult.events).toHaveLength(events.length);

          // Second fetch — HTTP error, should retain previous events
          const failedResult = await fetcher.fetch();
          expect(failedResult.failed).toBe(true);
          expect(failedResult.events).toHaveLength(events.length);

          for (let i = 0; i < events.length; i++) {
            expect(failedResult.events[i]!.id).toBe(successResult.events[i]!.id);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
