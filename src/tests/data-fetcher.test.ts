import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DataFetcher } from '../data-fetcher';
import type { FetchOptions } from '../types';

describe('DataFetcher', () => {
  const fetcher = new DataFetcher();

  describe('buildUrl', () => {
    it('constructs correct URL with all options', () => {
      const options: FetchOptions = {
        startDate: new Date('2024-01-01T00:00:00Z'),
        endDate: new Date('2024-01-08T00:00:00Z'),
        minLat: 40.78,
        maxLat: 40.90,
        minLon: 14.03,
        maxLon: 14.22,
      };

      const url = fetcher.buildUrl(options);

      expect(url).toContain('https://webservices.ingv.it/fdsnws/event/1/query?');
      expect(url).toContain('starttime=2024-01-01T00%3A00%3A00');
      expect(url).toContain('endtime=2024-01-08T00%3A00%3A00');
      expect(url).toContain('minlat=40.78');
      expect(url).toContain('maxlat=40.9');
      expect(url).toContain('minlon=14.03');
      expect(url).toContain('maxlon=14.22');
      expect(url).toContain('format=text');
    });

    it('uses default bounding box when not specified', () => {
      const options: FetchOptions = {
        startDate: new Date('2024-01-01T00:00:00Z'),
        endDate: new Date('2024-01-08T00:00:00Z'),
      };

      const url = fetcher.buildUrl(options);

      expect(url).toContain('minlat=40.78');
      expect(url).toContain('maxlat=40.9');
      expect(url).toContain('minlon=14.03');
      expect(url).toContain('maxlon=14.22');
    });

    it('formats dates without milliseconds', () => {
      const options: FetchOptions = {
        startDate: new Date('2024-06-15T12:30:45.123Z'),
        endDate: new Date('2024-06-22T18:00:00.000Z'),
      };

      const url = fetcher.buildUrl(options);

      expect(url).toContain('starttime=2024-06-15T12%3A30%3A45');
      expect(url).toContain('endtime=2024-06-22T18%3A00%3A00');
      expect(url).not.toContain('.123');
      expect(url).not.toContain('.000');
    });
  });

  describe('parseTextResponse', () => {
    const validHeader = '#EventID|Time|Latitude|Longitude|Depth/Km|Author|Catalog|Contributor|ContributorID|MagType|Magnitude|MagAuthor|EventLocationName|EventType';

    it('parses valid pipe-delimited response', () => {
      const text = [
        validHeader,
        '12345678|2024-01-15T10:30:00|40.82|14.15|2.5|BULLETIN|INGV|||Md|1.8|--|Campi Flegrei|earthquake',
      ].join('\n');

      const result = fetcher.parseTextResponse(text);

      expect(result.events).toHaveLength(1);
      expect(result.warnings).toHaveLength(0);

      const event = result.events[0]!;
      expect(event.id).toBe('12345678');
      expect(event.timestamp).toEqual(new Date('2024-01-15T10:30:00'));
      expect(event.latitude).toBe(40.82);
      expect(event.longitude).toBe(14.15);
      expect(event.depth).toBe(2.5);
      expect(event.magnitude).toBe(1.8);
      expect(event.magnitudeType).toBe('Md');
      expect(event.locationName).toBe('Campi Flegrei');
    });

    it('parses multiple valid lines', () => {
      const text = [
        validHeader,
        '111|2024-01-15T10:30:00|40.82|14.15|2.5|AUTH|CAT|||Md|1.8|--|Location A|earthquake',
        '222|2024-01-16T08:00:00|40.85|14.10|3.1|AUTH|CAT|||ML|2.3|--|Location B|earthquake',
        '333|2024-01-17T14:20:00|40.80|14.18|1.0|AUTH|CAT|||Md|0.5|--|Location C|earthquake',
      ].join('\n');

      const result = fetcher.parseTextResponse(text);

      expect(result.events).toHaveLength(3);
      expect(result.warnings).toHaveLength(0);
      expect(result.events[0]!.id).toBe('111');
      expect(result.events[1]!.id).toBe('222');
      expect(result.events[2]!.id).toBe('333');
    });

    it('skips header lines starting with #', () => {
      const text = [
        '# Some comment',
        '#Another comment',
        validHeader,
        '12345678|2024-01-15T10:30:00|40.82|14.15|2.5|AUTH|CAT|||Md|1.8|--|Campi Flegrei|earthquake',
      ].join('\n');

      const result = fetcher.parseTextResponse(text);

      expect(result.events).toHaveLength(1);
      expect(result.warnings).toHaveLength(0);
    });

    it('skips empty lines', () => {
      const text = [
        validHeader,
        '',
        '12345678|2024-01-15T10:30:00|40.82|14.15|2.5|AUTH|CAT|||Md|1.8|--|Campi Flegrei|earthquake',
        '',
      ].join('\n');

      const result = fetcher.parseTextResponse(text);

      expect(result.events).toHaveLength(1);
      expect(result.warnings).toHaveLength(0);
    });

    it('discards lines with too few fields and adds warning', () => {
      const text = [
        validHeader,
        '12345678|2024-01-15T10:30:00|40.82|14.15|2.5',
      ].join('\n');

      const result = fetcher.parseTextResponse(text);

      expect(result.events).toHaveLength(0);
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0]).toContain('Expected at least 13 fields');
    });

    it('discards lines with invalid date and adds warning', () => {
      const text = [
        validHeader,
        '12345678|not-a-date|40.82|14.15|2.5|AUTH|CAT|||Md|1.8|--|Location|earthquake',
      ].join('\n');

      const result = fetcher.parseTextResponse(text);

      expect(result.events).toHaveLength(0);
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0]).toContain('Invalid date');
    });

    it('discards lines with invalid latitude and adds warning', () => {
      const text = [
        validHeader,
        '12345678|2024-01-15T10:30:00|abc|14.15|2.5|AUTH|CAT|||Md|1.8|--|Location|earthquake',
      ].join('\n');

      const result = fetcher.parseTextResponse(text);

      expect(result.events).toHaveLength(0);
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0]).toContain('Invalid latitude');
    });

    it('discards lines with invalid longitude and adds warning', () => {
      const text = [
        validHeader,
        '12345678|2024-01-15T10:30:00|40.82|xyz|2.5|AUTH|CAT|||Md|1.8|--|Location|earthquake',
      ].join('\n');

      const result = fetcher.parseTextResponse(text);

      expect(result.events).toHaveLength(0);
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0]).toContain('Invalid longitude');
    });

    it('discards lines with invalid depth and adds warning', () => {
      const text = [
        validHeader,
        '12345678|2024-01-15T10:30:00|40.82|14.15|deep|AUTH|CAT|||Md|1.8|--|Location|earthquake',
      ].join('\n');

      const result = fetcher.parseTextResponse(text);

      expect(result.events).toHaveLength(0);
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0]).toContain('Invalid depth');
    });

    it('discards lines with invalid magnitude and adds warning', () => {
      const text = [
        validHeader,
        '12345678|2024-01-15T10:30:00|40.82|14.15|2.5|AUTH|CAT|||Md|big|--|Location|earthquake',
      ].join('\n');

      const result = fetcher.parseTextResponse(text);

      expect(result.events).toHaveLength(0);
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0]).toContain('Invalid magnitude');
    });

    it('discards lines with empty EventID and adds warning', () => {
      const text = [
        validHeader,
        '|2024-01-15T10:30:00|40.82|14.15|2.5|AUTH|CAT|||Md|1.8|--|Location|earthquake',
      ].join('\n');

      const result = fetcher.parseTextResponse(text);

      expect(result.events).toHaveLength(0);
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0]).toContain('Missing EventID');
    });

    it('handles mixed valid and invalid lines', () => {
      const text = [
        validHeader,
        '111|2024-01-15T10:30:00|40.82|14.15|2.5|AUTH|CAT|||Md|1.8|--|Location A|earthquake',
        '222|bad-date|40.82|14.15|2.5|AUTH|CAT|||Md|1.8|--|Location B|earthquake',
        '333|2024-01-16T08:00:00|40.85|14.10|3.1|AUTH|CAT|||ML|2.3|--|Location C|earthquake',
        'incomplete|line',
      ].join('\n');

      const result = fetcher.parseTextResponse(text);

      expect(result.events).toHaveLength(2);
      expect(result.warnings).toHaveLength(2);
      expect(result.events[0]!.id).toBe('111');
      expect(result.events[1]!.id).toBe('333');
    });

    it('handles empty response', () => {
      const result = fetcher.parseTextResponse('');

      expect(result.events).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
    });

    it('handles response with only header', () => {
      const result = fetcher.parseTextResponse(validHeader);

      expect(result.events).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
    });
  });
});


describe('DataFetcher.fetch', () => {
  let fetcher: DataFetcher;

  const validHeader = '#EventID|Time|Latitude|Longitude|Depth/Km|Author|Catalog|Contributor|ContributorID|MagType|Magnitude|MagAuthor|EventLocationName|EventType';
  const validLine = '12345678|2024-01-15T10:30:00|40.82|14.15|2.5|AUTH|CAT|||Md|1.8|--|Campi Flegrei|earthquake';

  beforeEach(() => {
    fetcher = new DataFetcher();
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('fetches and parses data successfully', async () => {
    const responseText = [validHeader, validLine].join('\n');
    vi.mocked(globalThis.fetch).mockResolvedValue(
      new Response(responseText, { status: 200 })
    );

    const result = await fetcher.fetch({
      startDate: new Date('2024-01-01T00:00:00Z'),
      endDate: new Date('2024-01-08T00:00:00Z'),
    });

    expect(result.events).toHaveLength(1);
    expect(result.events[0]!.id).toBe('12345678');
    expect(result.warnings).toHaveLength(0);
  });

  it('uses default time range (last 7 days) when no options provided', async () => {
    const responseText = [validHeader, validLine].join('\n');
    vi.mocked(globalThis.fetch).mockResolvedValue(
      new Response(responseText, { status: 200 })
    );

    await fetcher.fetch();

    const calledUrl = vi.mocked(globalThis.fetch).mock.calls[0]![0] as string;
    expect(calledUrl).toContain('minlat=40.78');
    expect(calledUrl).toContain('maxlat=40.9');
    expect(calledUrl).toContain('minlon=14.03');
    expect(calledUrl).toContain('maxlon=14.22');
    expect(calledUrl).toContain('format=text');
  });

  it('returns empty result on network error when no previous data', async () => {
    vi.mocked(globalThis.fetch).mockRejectedValue(new TypeError('Failed to fetch'));

    const result = await fetcher.fetch();

    expect(result.events).toHaveLength(0);
    expect(result.warnings).toHaveLength(0);
  });

  it('returns previously loaded data on network error', async () => {
    // First call succeeds
    const responseText = [validHeader, validLine].join('\n');
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(
      new Response(responseText, { status: 200 })
    );
    await fetcher.fetch();

    // Second call fails
    vi.mocked(globalThis.fetch).mockRejectedValueOnce(new TypeError('Failed to fetch'));
    const result = await fetcher.fetch();

    expect(result.events).toHaveLength(1);
    expect(result.events[0]!.id).toBe('12345678');
  });

  it('returns previously loaded data on HTTP error', async () => {
    // First call succeeds
    const responseText = [validHeader, validLine].join('\n');
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(
      new Response(responseText, { status: 200 })
    );
    await fetcher.fetch();

    // Second call returns HTTP 500
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(
      new Response('Internal Server Error', { status: 500 })
    );
    const result = await fetcher.fetch();

    expect(result.events).toHaveLength(1);
    expect(result.events[0]!.id).toBe('12345678');
  });

  it('returns previously loaded data on timeout (abort)', async () => {
    // First call succeeds
    const responseText = [validHeader, validLine].join('\n');
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(
      new Response(responseText, { status: 200 })
    );
    await fetcher.fetch();

    // Second call is aborted (simulating timeout)
    vi.mocked(globalThis.fetch).mockRejectedValueOnce(new DOMException('Aborted', 'AbortError'));
    const result = await fetcher.fetch();

    expect(result.events).toHaveLength(1);
    expect(result.events[0]!.id).toBe('12345678');
  });

  it('passes AbortController signal to fetch', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(
      new Response(validHeader, { status: 200 })
    );

    await fetcher.fetch({ timeoutMs: 5000 });

    const callArgs = vi.mocked(globalThis.fetch).mock.calls[0]!;
    const init = callArgs[1] as RequestInit;
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it('uses configurable timeout value', async () => {
    vi.useFakeTimers();

    vi.mocked(globalThis.fetch).mockImplementation((_url, init) => {
      return new Promise((_resolve, reject) => {
        // Listen for abort
        (init?.signal as AbortSignal)?.addEventListener('abort', () => {
          reject(new DOMException('Aborted', 'AbortError'));
        });
      });
    });

    const fetchPromise = fetcher.fetch({ timeoutMs: 100 });

    // Advance time past the timeout
    vi.advanceTimersByTime(100);

    const result = await fetchPromise;
    expect(result.events).toHaveLength(0); // Returns empty previous result

    vi.useRealTimers();
  });

  it('stores successful results and returns them on subsequent failures', async () => {
    const line1 = '111|2024-01-15T10:30:00|40.82|14.15|2.5|AUTH|CAT|||Md|1.8|--|Location A|earthquake';
    const line2 = '222|2024-01-16T08:00:00|40.85|14.10|3.1|AUTH|CAT|||ML|2.3|--|Location B|earthquake';

    // First successful fetch
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(
      new Response([validHeader, line1].join('\n'), { status: 200 })
    );
    const first = await fetcher.fetch();
    expect(first.events).toHaveLength(1);

    // Second successful fetch replaces stored data
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(
      new Response([validHeader, line2].join('\n'), { status: 200 })
    );
    const second = await fetcher.fetch();
    expect(second.events).toHaveLength(1);
    expect(second.events[0]!.id).toBe('222');

    // Third call fails — returns last successful data (line2)
    vi.mocked(globalThis.fetch).mockRejectedValueOnce(new TypeError('Network error'));
    const third = await fetcher.fetch();
    expect(third.events).toHaveLength(1);
    expect(third.events[0]!.id).toBe('222');
  });

  it('handles HTTP 404 as error and returns previous data', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(
      new Response('Not Found', { status: 404 })
    );

    const result = await fetcher.fetch();

    expect(result.events).toHaveLength(0);
    expect(result.warnings).toHaveLength(0);
  });
});


describe('DataFetcher.configure', () => {
  let fetcher: DataFetcher;

  const validHeader = '#EventID|Time|Latitude|Longitude|Depth/Km|Author|Catalog|Contributor|ContributorID|MagType|Magnitude|MagAuthor|EventLocationName|EventType';
  const validLine = '12345678|2024-01-15T10:30:00|40.82|14.15|2.5|AUTH|CAT|||Md|1.8|--|Campi Flegrei|earthquake';

  beforeEach(() => {
    fetcher = new DataFetcher();
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('switches endpoint after configure() is called', async () => {
    const newEndpoint = 'http://www.seismicportal.eu/fdsnws/event/1/query';
    const newBounds = { minLat: 27.5, maxLat: 29.5, minLon: -18.5, maxLon: -13.3 };

    vi.mocked(globalThis.fetch).mockResolvedValue(
      new Response([validHeader, validLine].join('\n'), { status: 200 })
    );

    fetcher.configure(newEndpoint, newBounds);
    await fetcher.fetch();

    const calledUrl = vi.mocked(globalThis.fetch).mock.calls[0]![0] as string;
    expect(calledUrl).toContain(newEndpoint);
    expect(calledUrl).toContain('minlat=27.5');
    expect(calledUrl).toContain('maxlat=29.5');
    expect(calledUrl).toContain('minlon=-18.5');
    expect(calledUrl).toContain('maxlon=-13.3');
  });

  it('resets previousResult after configure()', async () => {
    // First fetch succeeds with data
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(
      new Response([validHeader, validLine].join('\n'), { status: 200 })
    );
    const first = await fetcher.fetch();
    expect(first.events).toHaveLength(1);

    // Reconfigure to new endpoint
    fetcher.configure('http://example.com/fdsnws/event/1/query', {
      minLat: 27.5, maxLat: 29.5, minLon: -18.5, maxLon: -13.3
    });

    // Next fetch fails — should NOT return previous data (it was cleared by configure)
    vi.mocked(globalThis.fetch).mockRejectedValueOnce(new TypeError('Network error'));
    const result = await fetcher.fetch();

    expect(result.events).toHaveLength(0);
    expect(result.failed).toBe(true);
  });

  it('buildUrl uses the newly configured endpoint', () => {
    const newEndpoint = 'http://www.seismicportal.eu/fdsnws/event/1/query';
    const newBounds = { minLat: 27.5, maxLat: 29.5, minLon: -18.5, maxLon: -13.3 };

    fetcher.configure(newEndpoint, newBounds);

    const url = fetcher.buildUrl({
      startDate: new Date('2024-01-01T00:00:00Z'),
      endDate: new Date('2024-01-08T00:00:00Z'),
    });

    expect(url).toContain(newEndpoint);
    expect(url).toContain('minlat=27.5');
    expect(url).toContain('maxlat=29.5');
    expect(url).toContain('minlon=-18.5');
    expect(url).toContain('maxlon=-13.3');
  });
});


describe('DataFetcher.abort', () => {
  let fetcher: DataFetcher;

  const validHeader = '#EventID|Time|Latitude|Longitude|Depth/Km|Author|Catalog|Contributor|ContributorID|MagType|Magnitude|MagAuthor|EventLocationName|EventType';
  const validLine = '12345678|2024-01-15T10:30:00|40.82|14.15|2.5|AUTH|CAT|||Md|1.8|--|Campi Flegrei|earthquake';

  beforeEach(() => {
    fetcher = new DataFetcher();
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('abort() cancels an in-flight request', async () => {
    // First fetch succeeds to populate previousResult
    vi.mocked(globalThis.fetch).mockResolvedValueOnce(
      new Response([validHeader, validLine].join('\n'), { status: 200 })
    );
    await fetcher.fetch();

    // Set up a fetch that hangs until aborted
    vi.mocked(globalThis.fetch).mockImplementationOnce((_url, init) => {
      return new Promise((_resolve, reject) => {
        (init?.signal as AbortSignal)?.addEventListener('abort', () => {
          reject(new DOMException('Aborted', 'AbortError'));
        });
      });
    });

    const fetchPromise = fetcher.fetch();

    // Abort while in-flight
    fetcher.abort();

    const result = await fetchPromise;
    expect(result.failed).toBe(true);
    expect(result.events).toHaveLength(1); // retains previous data
    expect(result.events[0]!.id).toBe('12345678');
  });

  it('abort() is safe to call when no request is in-flight', () => {
    // Should not throw
    expect(() => fetcher.abort()).not.toThrow();
  });

  it('configure() aborts an in-flight request', async () => {
    // Set up a fetch that hangs until aborted
    vi.mocked(globalThis.fetch).mockImplementationOnce((_url, init) => {
      return new Promise((_resolve, reject) => {
        (init?.signal as AbortSignal)?.addEventListener('abort', () => {
          reject(new DOMException('Aborted', 'AbortError'));
        });
      });
    });

    const fetchPromise = fetcher.fetch();

    // configure() should abort in-flight request
    fetcher.configure('http://example.com/api', {
      minLat: 10, maxLat: 20, minLon: 30, maxLon: 40
    });

    const result = await fetchPromise;
    expect(result.failed).toBe(true);
  });
});
