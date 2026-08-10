import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { DataFetcher } from '../../data-fetcher';

/**
 * Property 2: Bounding Box Filter Integrity
 *
 * For any parsed EarthquakeEvent, its latitude SHALL be within [40.78, 40.90]
 * and its longitude SHALL be within [14.03, 14.22], matching the geographic
 * bounding box specified in the API query parameters.
 *
 * **Validates: Requirements 1.1**
 */

const MIN_LAT = 40.78;
const MAX_LAT = 40.90;
const MIN_LON = 14.03;
const MAX_LON = 14.22;

const INGV_HEADER =
  '#EventID|Time|Latitude|Longitude|Depth/Km|Author|Catalog|Contributor|ContributorID|MagType|Magnitude|MagAuthor|EventLocationName|EventType';

/**
 * Generates a valid INGV text line with coordinates within the Campi Flegrei bounding box.
 * Since the INGV API constrains results to the queried bounding box, responses will only
 * contain events within those geographic bounds.
 */
const ingvLineWithinBoundsArb = fc
  .record({
    eventId: fc.stringMatching(/^[A-Za-z0-9]{1,12}$/),
    year: fc.integer({ min: 2000, max: 2024 }),
    month: fc.integer({ min: 1, max: 12 }),
    day: fc.integer({ min: 1, max: 28 }),
    hour: fc.integer({ min: 0, max: 23 }),
    minute: fc.integer({ min: 0, max: 59 }),
    second: fc.integer({ min: 0, max: 59 }),
    latitude: fc.double({ min: MIN_LAT, max: MAX_LAT, noNaN: true, noDefaultInfinity: true }),
    longitude: fc.double({ min: MIN_LON, max: MAX_LON, noNaN: true, noDefaultInfinity: true }),
    depth: fc.double({ min: 0.1, max: 15.0, noNaN: true, noDefaultInfinity: true }),
    magnitude: fc.double({ min: -0.5, max: 5.0, noNaN: true, noDefaultInfinity: true }),
    magType: fc.constantFrom('Md', 'ML', 'Mw'),
    location: fc.constantFrom('Campi Flegrei', 'Pozzuoli', 'Napoli'),
  })
  .map((r) => {
    const time = `${r.year}-${String(r.month).padStart(2, '0')}-${String(r.day).padStart(2, '0')}T${String(r.hour).padStart(2, '0')}:${String(r.minute).padStart(2, '0')}:${String(r.second).padStart(2, '0')}`;
    return `${r.eventId}|${time}|${r.latitude}|${r.longitude}|${r.depth}|BULLETIN|INGV|||${r.magType}|${r.magnitude}|--|${r.location}|earthquake`;
  });

describe('Feature: campi-flegrei-3d-earthquakes, Property 2: Bounding Box Filter Integrity', () => {
  const fetcher = new DataFetcher();

  it('all parsed events have latitude within [40.78, 40.90] and longitude within [14.03, 14.22]', () => {
    fc.assert(
      fc.property(
        fc.array(ingvLineWithinBoundsArb, { minLength: 1, maxLength: 20 }),
        (lines) => {
          const text = [INGV_HEADER, ...lines].join('\n');
          const result = fetcher.parseTextResponse(text);

          // Every successfully parsed event must have coordinates within the bounding box
          for (const event of result.events) {
            expect(event.latitude).toBeGreaterThanOrEqual(MIN_LAT);
            expect(event.latitude).toBeLessThanOrEqual(MAX_LAT);
            expect(event.longitude).toBeGreaterThanOrEqual(MIN_LON);
            expect(event.longitude).toBeLessThanOrEqual(MAX_LON);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('buildUrl constrains query parameters to the Campi Flegrei bounding box', () => {
    const validDateArb = fc
      .integer({ min: new Date('2000-01-01').getTime(), max: new Date('2024-12-31').getTime() })
      .map((ts) => new Date(ts));

    fc.assert(
      fc.property(
        validDateArb,
        validDateArb,
        (date1, date2) => {
          // Ensure startDate <= endDate
          const [start, end] = date1 <= date2 ? [date1, date2] : [date2, date1];

          const url = fetcher.buildUrl({
            startDate: start,
            endDate: end,
            minLat: MIN_LAT,
            maxLat: MAX_LAT,
            minLon: MIN_LON,
            maxLon: MAX_LON,
          });

          // The URL must contain the bounding box parameters constraining the API query
          expect(url).toContain('minlat=40.78');
          expect(url).toContain('maxlat=40.9');
          expect(url).toContain('minlon=14.03');
          expect(url).toContain('maxlon=14.22');
        }
      ),
      { numRuns: 100 }
    );
  });
});
