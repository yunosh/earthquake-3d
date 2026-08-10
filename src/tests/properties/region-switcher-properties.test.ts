import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { RegionSwitcher } from '../../ui/region-switcher';

/**
 * Property 5: Region switcher displays all registered regions
 *
 * For any set of RegionConfig objects in the registry, the RegionSwitcher
 * rendered output shall contain an option element for each region whose text
 * content matches the region's title.
 *
 * **Validates: Requirements 4.1**
 */

/**
 * Property 6: Region selection emits correct identifier
 *
 * For any region available in the RegionSwitcher, when that region is selected,
 * the emitted change event shall contain that region's exact id string.
 *
 * **Validates: Requirements 4.3**
 */

/**
 * Arbitrary that generates a non-empty list of regions with unique IDs and non-empty titles.
 */
const regionsArb = fc
  .uniqueArray(
    fc.record({
      id: fc.string({ minLength: 1, maxLength: 30 }).filter((s) => s.trim().length > 0),
      title: fc.string({ minLength: 1, maxLength: 50 }).filter((s) => s.trim().length > 0),
    }),
    { minLength: 1, maxLength: 20, selector: (r) => r.id }
  );

describe('Feature: multi-region-canary-islands, Property 5: Region switcher displays all registered regions', () => {
  it('renders an <option> element for each region with matching text content', () => {
    fc.assert(
      fc.property(regionsArb, (regions) => {
        const container = document.createElement('div');
        new RegionSwitcher(container, regions);

        const options = container.querySelectorAll('option');
        expect(options.length).toBe(regions.length);

        for (const region of regions) {
          const matchingOption = Array.from(options).find(
            (opt) => opt.textContent === region.title
          );
          expect(matchingOption).toBeDefined();
          expect(matchingOption!.value).toBe(region.id);
        }
      }),
      { numRuns: 100 }
    );
  });
});

describe('Feature: multi-region-canary-islands, Property 6: Region selection emits correct identifier', () => {
  it('emits the exact region id when a region is selected', () => {
    fc.assert(
      fc.property(
        regionsArb.filter((r) => r.length >= 2),
        fc.nat(),
        (regions, indexSeed) => {
          const container = document.createElement('div');
          const switcher = new RegionSwitcher(container, regions);

          // Pick an arbitrary region to select (not the first, since it's already selected)
          const targetIndex = (indexSeed % (regions.length - 1)) + 1;
          const targetRegion = regions[targetIndex];

          let emittedId: string | undefined;
          switcher.onChange((id) => {
            emittedId = id;
          });

          // Programmatically change the select value and dispatch a change event
          const select = container.querySelector('select')!;
          select.value = targetRegion.id;
          select.dispatchEvent(new Event('change'));

          expect(emittedId).toBe(targetRegion.id);
        }
      ),
      { numRuns: 100 }
    );
  });
});
