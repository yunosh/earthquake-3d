import type { EarthquakeEvent, FetchOptions, FetchResult, GeoBounds } from './types';

const INGV_ENDPOINT = 'https://webservices.ingv.it/fdsnws/event/1/query';

const DEFAULT_BOUNDS: GeoBounds = {
  minLat: 40.78,
  maxLat: 40.90,
  minLon: 14.03,
  maxLon: 14.22,
};

const DEFAULT_TIMEOUT_MS = 15000;
const DEFAULT_TIME_RANGE_DAYS = 30;

/**
 * Fetches and parses earthquake data from an FDSN-compatible event service.
 * Supports reconfiguration for different regions (endpoint + bounds).
 */
export class DataFetcher {
  private previousResult: FetchResult = { events: [], warnings: [] };
  private currentController: AbortController | null = null;
  private endpoint: string;
  private defaultBounds: GeoBounds;

  constructor(config?: { endpoint: string; bounds: GeoBounds }) {
    this.endpoint = config?.endpoint ?? INGV_ENDPOINT;
    this.defaultBounds = config?.bounds ?? DEFAULT_BOUNDS;
  }

  /**
   * Reconfigure for a new region, aborting in-flight requests and resetting cached data.
   */
  configure(endpoint: string, bounds: GeoBounds): void {
    this.abort();
    this.endpoint = endpoint;
    this.defaultBounds = bounds;
    this.previousResult = { events: [], warnings: [] };
  }

  /**
   * Abort any in-flight request.
   */
  abort(): void {
    if (this.currentController) {
      this.currentController.abort();
      this.currentController = null;
    }
  }

  /**
   * Fetches earthquake data from the configured API with timeout and error handling.
   * On failure (network error, HTTP error, timeout), returns previously loaded data.
   */
  async fetch(options?: Partial<FetchOptions>): Promise<FetchResult> {
    this.abort();
    this.currentController = new AbortController();

    const now = new Date();
    const resolvedOptions: FetchOptions = {
      startDate: options?.startDate ?? new Date(now.getTime() - DEFAULT_TIME_RANGE_DAYS * 24 * 60 * 60 * 1000),
      endDate: options?.endDate ?? now,
      minLat: options?.minLat ?? this.defaultBounds.minLat,
      maxLat: options?.maxLat ?? this.defaultBounds.maxLat,
      minLon: options?.minLon ?? this.defaultBounds.minLon,
      maxLon: options?.maxLon ?? this.defaultBounds.maxLon,
      timeoutMs: options?.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    };

    const url = this.buildUrl(resolvedOptions);
    const timeoutId = setTimeout(() => this.currentController?.abort(), resolvedOptions.timeoutMs);

    try {
      const response = await globalThis.fetch(url, { signal: this.currentController.signal });

      if (!response.ok) {
        return { ...this.previousResult, failed: true };
      }

      const text = await response.text();
      const result = this.parseTextResponse(text);

      // Store successful result for future failures
      this.previousResult = result;
      return result;
    } catch {
      // Network error, timeout (AbortError), or any other failure
      return { ...this.previousResult, failed: true };
    } finally {
      clearTimeout(timeoutId);
      this.currentController = null;
    }
  }

  /**
   * Builds the FDSN query URL from the given options using the configured endpoint.
   */
  buildUrl(options: FetchOptions): string {
    const params = new URLSearchParams();

    params.set('starttime', this.formatDate(options.startDate));
    params.set('endtime', this.formatDate(options.endDate));
    params.set('minlat', String(options.minLat ?? this.defaultBounds.minLat));
    params.set('maxlat', String(options.maxLat ?? this.defaultBounds.maxLat));
    params.set('minlon', String(options.minLon ?? this.defaultBounds.minLon));
    params.set('maxlon', String(options.maxLon ?? this.defaultBounds.maxLon));
    params.set('format', 'text');

    return `${this.endpoint}?${params.toString()}`;
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
