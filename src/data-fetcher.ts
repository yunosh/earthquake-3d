import type { EarthquakeEvent, FetchOptions, FetchResult } from './types';

const INGV_ENDPOINT = 'https://webservices.ingv.it/fdsnws/event/1/query';

const DEFAULT_MIN_LAT = 40.78;
const DEFAULT_MAX_LAT = 40.90;
const DEFAULT_MIN_LON = 14.03;
const DEFAULT_MAX_LON = 14.22;
const DEFAULT_TIMEOUT_MS = 15000;
const DEFAULT_TIME_RANGE_DAYS = 7;

/**
 * Fetches and parses earthquake data from the INGV FDSNWS Event Service.
 */
export class DataFetcher {
  private previousResult: FetchResult = { events: [], warnings: [] };

  /**
   * Fetches earthquake data from the INGV API with timeout and error handling.
   * On failure (network error, HTTP error, timeout), returns previously loaded data.
   */
  async fetch(options?: Partial<FetchOptions>): Promise<FetchResult> {
    const now = new Date();
    const resolvedOptions: FetchOptions = {
      startDate: options?.startDate ?? new Date(now.getTime() - DEFAULT_TIME_RANGE_DAYS * 24 * 60 * 60 * 1000),
      endDate: options?.endDate ?? now,
      minLat: options?.minLat ?? DEFAULT_MIN_LAT,
      maxLat: options?.maxLat ?? DEFAULT_MAX_LAT,
      minLon: options?.minLon ?? DEFAULT_MIN_LON,
      maxLon: options?.maxLon ?? DEFAULT_MAX_LON,
      timeoutMs: options?.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    };

    const url = this.buildUrl(resolvedOptions);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), resolvedOptions.timeoutMs);

    try {
      const response = await globalThis.fetch(url, { signal: controller.signal });

      if (!response.ok) {
        return this.previousResult;
      }

      const text = await response.text();
      const result = this.parseTextResponse(text);

      // Store successful result for future failures
      this.previousResult = result;
      return result;
    } catch {
      // Network error, timeout (AbortError), or any other failure
      return this.previousResult;
    } finally {
      clearTimeout(timeoutId);
    }
  }
  /**
   * Builds the INGV FDSNWS query URL from the given options.
   */
  buildUrl(options: FetchOptions): string {
    const params = new URLSearchParams();

    params.set('starttime', this.formatDate(options.startDate));
    params.set('endtime', this.formatDate(options.endDate));
    params.set('minlat', String(options.minLat ?? DEFAULT_MIN_LAT));
    params.set('maxlat', String(options.maxLat ?? DEFAULT_MAX_LAT));
    params.set('minlon', String(options.minLon ?? DEFAULT_MIN_LON));
    params.set('maxlon', String(options.maxLon ?? DEFAULT_MAX_LON));
    params.set('format', 'text');

    return `${INGV_ENDPOINT}?${params.toString()}`;
  }

  /**
   * Parses the pipe-delimited text response from INGV.
   * Skips header lines (starting with #), extracts relevant fields,
   * and discards malformed records with warnings.
   */
  parseTextResponse(text: string): FetchResult {
    const events: EarthquakeEvent[] = [];
    const warnings: string[] = [];

    const lines = text.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!.trim();

      // Skip empty lines and header lines
      if (line === '' || line.startsWith('#')) {
        continue;
      }

      const result = this.parseLine(line, i + 1);
      if (result.event) {
        events.push(result.event);
      } else {
        warnings.push(result.warning!);
      }
    }

    return { events, warnings };
  }

  /**
   * Parses a single pipe-delimited line into an EarthquakeEvent.
   * Returns either the parsed event or a warning message.
   */
  private parseLine(
    line: string,
    lineNumber: number
  ): { event: EarthquakeEvent; warning?: undefined } | { event?: undefined; warning: string } {
    const fields = line.split('|');

    // Expected fields: EventID|Time|Latitude|Longitude|Depth/Km|Author|Catalog|Contributor|ContributorID|MagType|Magnitude|MagAuthor|EventLocationName|EventType
    if (fields.length < 13) {
      return {
        warning: `Line ${lineNumber}: Expected at least 13 fields, got ${fields.length}`,
      };
    }

    const eventId = fields[0]!.trim();
    const timeStr = fields[1]!.trim();
    const latStr = fields[2]!.trim();
    const lonStr = fields[3]!.trim();
    const depthStr = fields[4]!.trim();
    const magTypeStr = fields[9]!.trim();
    const magStr = fields[10]!.trim();
    const locationName = fields[12]!.trim();

    // Validate EventID
    if (!eventId) {
      return { warning: `Line ${lineNumber}: Missing EventID` };
    }

    // Parse and validate timestamp
    const timestamp = new Date(timeStr);
    if (isNaN(timestamp.getTime())) {
      return { warning: `Line ${lineNumber}: Invalid date '${timeStr}'` };
    }

    // Parse and validate latitude
    const latitude = parseFloat(latStr);
    if (isNaN(latitude)) {
      return { warning: `Line ${lineNumber}: Invalid latitude '${latStr}'` };
    }

    // Parse and validate longitude
    const longitude = parseFloat(lonStr);
    if (isNaN(longitude)) {
      return { warning: `Line ${lineNumber}: Invalid longitude '${lonStr}'` };
    }

    // Parse and validate depth
    const depth = parseFloat(depthStr);
    if (isNaN(depth)) {
      return { warning: `Line ${lineNumber}: Invalid depth '${depthStr}'` };
    }

    // Parse and validate magnitude
    const magnitude = parseFloat(magStr);
    if (isNaN(magnitude)) {
      return { warning: `Line ${lineNumber}: Invalid magnitude '${magStr}'` };
    }

    return {
      event: {
        id: eventId,
        timestamp,
        latitude,
        longitude,
        depth,
        magnitude,
        magnitudeType: magTypeStr,
        locationName,
      },
    };
  }

  /**
   * Formats a Date to ISO 8601 string suitable for INGV API (YYYY-MM-DDTHH:mm:ss).
   */
  private formatDate(date: Date): string {
    return date.toISOString().replace(/\.\d{3}Z$/, '');
  }
}
