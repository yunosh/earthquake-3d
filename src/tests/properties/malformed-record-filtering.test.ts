import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { DataFetcher } from '../../data-fetcher';

/**
 * Property 8: Malformed Record Filtering
 * Validates: Requirements 1.6
 *
 * For any INGV text response containing a mix of valid and malformed lines
 * (missing fields, unparseable numbers, invalid dates), parsing SHALL return
 * exactly the valid records and discard exactly the malformed ones.
 * count(events) + count(warnings) = total non-header, non-empty lines.
 */

const HEADER = '#EventID|Time|Latitude|Longitude|Depth/Km|Author|Catalog|Contributor|ContributorID|MagType|Magnitude|MagAuthor|EventLocationName|EventType';

// Generator for valid INGV text lines
const validLineArb = fc.record({
  eventId: fc.stringMatching(/^[a-zA-Z0-9]{1,20}$/),
  year: fc.integer({ min: 2000, max: 2024 }),
  month: fc.integer({ min: 1, max: 12 }),
  day: fc.integer({ min: 1, max: 28 }),
  hour: fc.integer({ min: 0, max: 23 }),
  minute: fc.integer({ min: 0, max: 59 }),
  second: fc.integer({ min: 0, max: 59 }),
  latitude: fc.double({ min: 40.78, max: 40.90, noNaN: true, noDefaultInfinity: true }),
  longitude: fc.double({ min: 14.03, max: 14.22, noNaN: true, noDefaultInfinity: true }),
  depth: fc.double({ min: 0.1, max: 15.0, noNaN: true, noDefaultInfinity: true }),
  magnitude: fc.double({ min: -1.0, max: 6.0, noNaN: true, noDefaultInfinity: true }),
  magType: fc.constantFrom('Md', 'ML', 'Mw', 'mb'),
  location: fc.stringMatching(/^[a-zA-Z ]{1,30}$/),
}).map(r => {
  const mm = String(r.month).padStart(2, '0');
  const dd = String(r.day).padStart(2, '0');
  const hh = String(r.hour).padStart(2, '0');
  const min = String(r.minute).padStart(2, '0');
  const ss = String(r.second).padStart(2, '0');
  const time = `${r.year}-${mm}-${dd}T${hh}:${min}:${ss}`;
  const line = `${r.eventId}|${time}|${r.latitude}|${r.longitude}|${r.depth}|BULLETIN|INGV|||${r.magType}|${r.magnitude}|--|${r.location}|earthquake`;
  return { line, eventId: r.eventId };
});

// Generator for malformed lines - various kinds of malformation
const malformedLineArb = fc.oneof(
  // Too few fields
  fc.stringMatching(/^[a-zA-Z0-9]{1,10}$/).map(id => `${id}|2024-01-01T00:00:00|40.82|14.15`),
  // Invalid date
  fc.stringMatching(/^[a-zA-Z0-9]{1,10}$/).map(id =>
    `${id}|not-a-date|40.82|14.15|2.5|AUTH|CAT|||Md|1.8|--|Location|earthquake`
  ),
  // Invalid latitude (non-numeric)
  fc.stringMatching(/^[a-zA-Z0-9]{1,10}$/).map(id =>
    `${id}|2024-01-15T10:30:00|abc|14.15|2.5|AUTH|CAT|||Md|1.8|--|Location|earthquake`
  ),
  // Invalid longitude (non-numeric)
  fc.stringMatching(/^[a-zA-Z0-9]{1,10}$/).map(id =>
    `${id}|2024-01-15T10:30:00|40.82|xyz|2.5|AUTH|CAT|||Md|1.8|--|Location|earthquake`
  ),
  // Invalid depth (non-numeric)
  fc.stringMatching(/^[a-zA-Z0-9]{1,10}$/).map(id =>
    `${id}|2024-01-15T10:30:00|40.82|14.15|deep|AUTH|CAT|||Md|1.8|--|Location|earthquake`
  ),
  // Invalid magnitude (non-numeric)
  fc.stringMatching(/^[a-zA-Z0-9]{1,10}$/).map(id =>
    `${id}|2024-01-15T10:30:00|40.82|14.15|2.5|AUTH|CAT|||Md|big|--|Location|earthquake`
  ),
  // Empty EventID
  fc.constant('|2024-01-15T10:30:00|40.82|14.15|2.5|AUTH|CAT|||Md|1.8|--|Location|earthquake'),
  // Only a few pipe-separated fields
  fc.constant('field1|field2|field3'),
);

describe('Feature: campi-flegrei-3d-earthquakes, Property 8: Malformed Record Filtering', () => {
  const fetcher = new DataFetcher();

  it('valid records are correctly parsed, malformed records are discarded, and counts are consistent', () => {
    fc.assert(
      fc.property(
        fc.array(validLineArb, { minLength: 0, maxLength: 10 }),
        fc.array(malformedLineArb, { minLength: 0, maxLength: 10 }),
        (validRecords, malformedLines) => {
          // Combine valid and malformed lines in a shuffled order
          const allDataLines = [
            ...validRecords.map(r => ({ line: r.line, valid: true, eventId: r.eventId })),
            ...malformedLines.map(line => ({ line, valid: false, eventId: null })),
          ];

          // Shuffle the lines to simulate a realistic mixed response
          const shuffled = [...allDataLines].sort(() => Math.random() - 0.5);

          // Build response text with header
          const responseText = [HEADER, ...shuffled.map(r => r.line)].join('\n');

          // Parse
          const result = fetcher.parseTextResponse(responseText);

          // Count non-header, non-empty lines
          const lines = responseText.split('\n');
          const nonHeaderNonEmptyLines = lines.filter(l => {
            const trimmed = l.trim();
            return trimmed !== '' && !trimmed.startsWith('#');
          });
          const totalDataLines = nonHeaderNonEmptyLines.length;

          // Property: count(events) + count(warnings) = total non-header, non-empty lines
          expect(result.events.length + result.warnings.length).toBe(totalDataLines);

          // Property: All valid records are correctly parsed (appear as events)
          expect(result.events.length).toBe(validRecords.length);

          // Property: All malformed records are discarded (appear in warnings)
          expect(result.warnings.length).toBe(malformedLines.length);

          // Property: Parsed events have the correct EventIDs from valid records
          const parsedIds = new Set(result.events.map(e => e.id));
          for (const record of validRecords) {
            expect(parsedIds.has(record.eventId)).toBe(true);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
