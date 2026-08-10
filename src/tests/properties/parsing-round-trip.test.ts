import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { DataFetcher } from '../../data-fetcher';

/**
 * Property 1: Parsing Round-Trip Consistency
 *
 * For any valid INGV text response line containing all required fields
 * (EventID, Time, Latitude, Longitude, Depth, Magnitude), parsing the line
 * into an EarthquakeEvent and formatting it back to its constituent values
 * SHALL produce values equivalent to the original input (within floating-point precision).
 *
 * Validates: Requirements 1.2
 */
describe('Feature: campi-flegrei-3d-earthquakes, Property 1: Parsing Round-Trip Consistency', () => {
  const fetcher = new DataFetcher();

  // Arbitrary for valid EventIDs (non-empty alphanumeric strings, no pipes)
  const eventIdArb = fc.stringMatching(/^[a-z0-9]{1,20}$/);

  // Arbitrary for valid timestamps (ISO 8601, second precision, as UTC strings)
  // We generate a timestamp string that looks like INGV format (no Z suffix),
  // and also the expected Date object from parsing that string.
  const timestampArb = fc.date({
    min: new Date('2000-01-01T00:00:00Z'),
    max: new Date('2025-12-31T23:59:59Z'),
  }).map(d => {
    // Round to second precision and produce INGV-formatted string
    d.setMilliseconds(0);
    // Format as INGV does: "YYYY-MM-DDTHH:mm:ss" (without trailing Z)
    const formatted = d.toISOString().replace(/\.\d{3}Z$/, '');
    // The parsed result will be new Date(formatted) which is what the parser produces
    return { formatted, expectedDate: new Date(formatted) };
  });

  // Arbitrary for latitude within bounding box
  const latitudeArb = fc.double({ min: 40.78, max: 40.90, noNaN: true, noDefaultInfinity: true });

  // Arbitrary for longitude within bounding box
  const longitudeArb = fc.double({ min: 14.03, max: 14.22, noNaN: true, noDefaultInfinity: true });

  // Arbitrary for depth (positive, reasonable range)
  const depthArb = fc.double({ min: 0.01, max: 30.0, noNaN: true, noDefaultInfinity: true });

  // Arbitrary for magnitude (reasonable range)
  const magnitudeArb = fc.double({ min: -1.0, max: 7.0, noNaN: true, noDefaultInfinity: true });

  // Arbitrary for magnitude type
  const magTypeArb = fc.constantFrom('Md', 'ML', 'Mw', 'Mb', 'Ms');

  // Arbitrary for location name (non-empty, no pipe characters, not whitespace-only since parser trims)
  const locationNameArb = fc.stringMatching(/^[a-zA-Z0-9][a-zA-Z0-9 ]{0,28}[a-zA-Z0-9]$/).filter(s => s.length >= 1);

  /**
   * Constructs a valid INGV pipe-delimited text line from generated values.
   * Fields: EventID|Time|Latitude|Longitude|Depth/Km|Author|Catalog|Contributor|ContributorID|MagType|Magnitude|MagAuthor|EventLocationName|EventType
   */
  function buildINGVLine(params: {
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
      'BULLETIN',     // Author
      'INGV',        // Catalog
      '',            // Contributor
      '',            // ContributorID
      params.magType,
      params.magnitude.toString(),
      '--',          // MagAuthor
      params.locationName,
      'earthquake',  // EventType
    ].join('|');
  }

  it('parsed field values match generated inputs within floating-point precision', () => {
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
          const line = buildINGVLine({
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

          // Should parse successfully with no warnings
          expect(result.events).toHaveLength(1);
          expect(result.warnings).toHaveLength(0);

          const parsed = result.events[0]!;

          // EventID round-trip
          expect(parsed.id).toBe(eventId);

          // Timestamp round-trip (compare against what new Date(formattedStr) produces)
          expect(parsed.timestamp.getTime()).toBe(timestamp.expectedDate.getTime());

          // Latitude round-trip (within floating-point precision)
          expect(parsed.latitude).toBeCloseTo(latitude, 10);

          // Longitude round-trip (within floating-point precision)
          expect(parsed.longitude).toBeCloseTo(longitude, 10);

          // Depth round-trip (within floating-point precision)
          expect(parsed.depth).toBeCloseTo(depth, 10);

          // Magnitude round-trip (within floating-point precision)
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
