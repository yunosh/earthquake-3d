# Implementation Plan: Multi-Region Canary Islands

## Overview

Transformiert die Single-Region-App (Campi Flegrei) in ein Multi-Region-System mit Region-Switcher UI. Die Implementierung folgt dem Ansatz: erst bestehenden Code minimal refaktorisieren (ohne Breaking Changes wo möglich), dann neue Dateien hinzufügen, dann alles verdrahten. Git-Commits an logischen Checkpoints.

## Tasks

- [x] 1. Refactor CoordinateMapper: Parametrisierung statt Hardcoding
  - [x] 1.1 Add `CoordinateMapperConfig` interface and `createCoordinateMapperConfig` factory function to `src/coordinate-mapper.ts`
    - Add `CoordinateMapperConfig` interface with `centerLat`, `centerLon`, `kmPerDegreeLat`, `kmPerDegreeLon`
    - Add `createCoordinateMapperConfig(centerLat, centerLon)` that computes `kmPerDegreeLon = 111 * cos(lat_in_radians)`
    - Change `geoToScene` signature: replace `_bounds: GeoBounds` parameter with `config: CoordinateMapperConfig`
    - Use `config.centerLat`, `config.centerLon`, `config.kmPerDegreeLat`, `config.kmPerDegreeLon` instead of module constants
    - Keep `CALDERA_CENTER_LAT`, `CALDERA_CENTER_LON` exports (still used by Campi Flegrei config)
    - Keep `computeDepthScale` unchanged
    - _Requirements: 6.1, 6.2, 6.3_

  - [x] 1.2 Update all call sites of `geoToScene` in `src/viewer.ts`
    - Import `CoordinateMapperConfig` and `createCoordinateMapperConfig`
    - Add a `private mapperConfig: CoordinateMapperConfig` field, initialized from `ViewerConfig.centerLat/centerLon`
    - Replace all `geoToScene(lat, lon, depth, this.config.bounds, depthScale)` calls with `geoToScene(lat, lon, depth, this.mapperConfig, depthScale)`
    - _Requirements: 6.1, 6.3_

  - [x] 1.3 Update existing tests for the new `geoToScene` signature
    - Update `src/tests/coordinate-mapper.test.ts`: create a `CoordinateMapperConfig` for Campi Flegrei and pass it instead of `DEFAULT_BOUNDS`
    - Update `src/tests/properties/coordinate-projection.test.ts`: same approach, create config and pass it
    - Ensure all existing test assertions still pass with the new signature
    - _Requirements: 6.1, 6.2_

- [x] 2. Refactor DataFetcher: Configurable endpoint and abort support
  - [x] 2.1 Add `configure(endpoint, bounds)` and `abort()` methods to `src/data-fetcher.ts`
    - Add `private endpoint: string` field (default: INGV_ENDPOINT)
    - Add `private defaultBounds: GeoBounds` field (default: current Campi Flegrei bounds)
    - Add `private currentController: AbortController | null` field
    - Add `configure(endpoint: string, bounds: GeoBounds): void` — sets endpoint/bounds, calls `abort()`, resets `previousResult`
    - Add `abort(): void` — aborts `currentController` if active
    - Refactor `fetch()` to use `this.endpoint` for URL base and `this.defaultBounds` for default lat/lon values
    - Refactor `fetch()` to store and use `this.currentController` instead of local `controller`
    - Make `buildUrl` use `this.endpoint` instead of hardcoded `INGV_ENDPOINT`
    - _Requirements: 3.1, 3.4_

  - [x] 2.2 Update `src/tests/integration/pipeline.test.ts` and `src/tests/data-fetcher.test.ts` if needed
    - Ensure existing DataFetcher tests still pass with the refactored constructor
    - Add a test case for `configure()` switching endpoint and `abort()` cancelling in-flight requests
    - _Requirements: 3.1, 3.4_

- [x] 3. Checkpoint — Refactoring abgeschlossen
  - Ensure all tests pass (`npx vitest --run`), ask the user if questions arise.
  - Git commit: `refactor: parameterize coordinate-mapper and data-fetcher for multi-region support`

- [x] 4. Create Region Configuration System
  - [x] 4.1 Create `src/region-config.ts` with `RegionConfig` interface
    - Define `RegionConfig` interface: `id`, `title`, `center: { lat, lon }`, `bounds: GeoBounds`, `coastlinePolylines`, `towns`, `apiEndpoint`, `apiFormat: 'fdsn-text'`, `defaultTimeRangeDays`, `cameraDistance`
    - Export `CoordinateMapperConfig` re-export from `coordinate-mapper.ts` for convenience
    - _Requirements: 1.1_

  - [x] 4.2 Create `src/region-registry.ts` with registry functions
    - Implement `registerRegion(config: RegionConfig): void`
    - Implement `getRegion(id: string): RegionConfig | undefined`
    - Implement `getAllRegions(): RegionConfig[]`
    - Implement `getDefaultRegionId(): string` returning `'campi-flegrei'`
    - _Requirements: 1.2, 1.3_

  - [x] 4.3 Create `src/regions/campi-flegrei.ts` with Campi Flegrei RegionConfig
    - Import `COASTLINE_POLYLINES` from `../coastline-data`
    - Define and export `campiFlegrei: RegionConfig` with existing center (40.827, 14.139), bounds (40.78–40.90, 14.03–14.22), towns, INGV endpoint, `defaultTimeRangeDays: 30`, `cameraDistance: 15`
    - _Requirements: 1.4_

  - [x] 4.4 Write property test: Registry lookup round-trip (Property 1)
    - **Property 1: Registry lookup round-trip**
    - **Validates: Requirements 1.2**
    - File: `src/tests/properties/registry-lookup-roundtrip.test.ts`
    - For any generated RegionConfig registered in registry, `getRegion(id)` returns the same object

- [x] 5. Create Canary Islands Region Data
  - [x] 5.1 Create `src/canary-coastline-data.ts` with coastline polylines for all 7 main islands
    - Export `CANARY_COASTLINE_POLYLINES: [number, number][][]`
    - Provide simplified polygon outlines (~15–30 coordinate pairs per island) for: Tenerife, Gran Canaria, La Palma, El Hierro, Lanzarote, Fuerteventura, La Gomera
    - _Requirements: 2.3_

  - [x] 5.2 Create `src/regions/canary-islands.ts` with Canary Islands RegionConfig
    - Import `CANARY_COASTLINE_POLYLINES` from `../canary-coastline-data`
    - Define and export `canaryIslands: RegionConfig` with center (28.1, -15.4), bounds (27.5–29.5, -18.5 to -13.3), EMSC SeismicPortal endpoint, towns (Santa Cruz de Tenerife, Las Palmas, Los Llanos de Aridane, Valverde, Arrecife, Puerto del Rosario), `defaultTimeRangeDays: 90`, `cameraDistance: 60`
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

- [x] 6. Checkpoint — Configuration Layer abgeschlossen
  - Ensure all tests pass, ask the user if questions arise.
  - Git commit: `feat: add region configuration system with Campi Flegrei and Canary Islands configs`

- [x] 7. Extend Viewer with region-switch capabilities
  - [x] 7.1 Add `clearRegionElements()` and `setupRegion()` methods to `src/viewer.ts`
    - `clearRegionElements()`: remove all scene objects named `coastline*`, `town-*`, `waterPlane`, `landPlane`; dispose their geometry/material; remove `earthquakePoints` instanced mesh and reset it
    - `setupRegion(config: RegionConfig, mapperConfig: CoordinateMapperConfig)`: call `clearRegionElements()`, update `this.config.bounds/centerLat/centerLon`, set `this.mapperConfig`, rebuild surface planes, coastline from `config.coastlinePolylines`, towns from `config.towns`, reset camera to `config.cameraDistance`
    - Refactor `initCoastline()` to accept polylines parameter (or add `initCoastlineFrom(polylines)`)
    - Refactor `initTownLabels()` to accept towns parameter (or add `initTownLabelsFrom(towns)`)
    - Add `resetCamera(distance: number)` private method
    - _Requirements: 5.1, 5.2, 5.5_

  - [x] 7.2 Write unit tests for `clearRegionElements` and `setupRegion`
    - Test that `clearRegionElements` removes named objects from scene
    - Test that `setupRegion` creates new coastline/town elements
    - _Requirements: 5.1, 5.2_

- [x] 8. Create RegionSwitcher UI component
  - [x] 8.1 Create `src/ui/region-switcher.ts`
    - Implement `RegionSwitcher` class with constructor accepting `container: HTMLElement` and `regions: { id: string; title: string }[]`
    - Render a `<select>` dropdown with `<option>` for each region
    - Implement `onChange(callback: (regionId: string) => void)` for change event subscription
    - Implement `setActive(regionId: string)` to programmatically set selection
    - Implement `setDisabled(disabled: boolean)` to disable during loading
    - Add appropriate ARIA labels (`aria-label="Region auswählen"`)
    - _Requirements: 4.1, 4.2, 4.3, 4.4_

  - [x] 8.2 Write property tests for RegionSwitcher (Properties 5 and 6)
    - **Property 5: Region switcher displays all registered regions**
    - **Property 6: Region selection emits correct identifier**
    - **Validates: Requirements 4.1, 4.3**
    - File: `src/tests/properties/region-switcher-properties.test.ts`

- [x] 9. Checkpoint — Neue Komponenten fertig
  - Ensure all tests pass, ask the user if questions arise.
  - Git commit: `feat: add RegionSwitcher UI and Viewer region-switch methods`

- [x] 10. Wire everything together in main.ts
  - [x] 10.1 Integrate region system into `src/main.ts`
    - Import `RegionRegistry`, `registerRegion`, `getRegion`, `getAllRegions`, `getDefaultRegionId`
    - Import `campiFlegrei` and `canaryIslands` configs, register both at startup
    - Import `RegionSwitcher` and `createCoordinateMapperConfig`
    - Create `RegionSwitcher` in UI container, populate with `getAllRegions()`
    - Load default region (`campiFlegrei`) on startup
    - Replace hardcoded `BOUNDS`, `CALDERA_CENTER_LAT`, `CALDERA_CENTER_LON` with values from active `RegionConfig`
    - Create `CoordinateMapperConfig` from active region center
    - Pass `mapperConfig` to Viewer (via `setupRegion` on init)
    - Configure `DataFetcher` with active region's endpoint and bounds
    - Wire `RegionSwitcher.onChange` to: disable switcher → abort DataFetcher → reset AnimationController → Viewer.setupRegion → fetch new data → re-enable switcher
    - _Requirements: 1.3, 3.1, 3.4, 4.4, 5.3, 5.4_

  - [x] 10.2 Write property tests for CoordinateMapper parameterization (Properties 7 and 8)
    - **Property 7: km-per-degree-longitude scales with cosine of latitude**
    - **Property 8: Region center maps to scene origin**
    - **Validates: Requirements 5.3, 6.2, 6.3**
    - File: `src/tests/properties/coordinate-mapper-parameterized.test.ts`

  - [x] 10.3 Write property tests for DataFetcher region configuration (Properties 2, 3, 4)
    - **Property 2: Activated region drives fetch URL construction**
    - **Property 3: FDSN text parsing round-trip**
    - **Property 4: Error retains previous data**
    - **Validates: Requirements 3.1, 3.2, 3.3**
    - File: `src/tests/properties/data-fetcher-region-properties.test.ts`

- [x] 11. Add CSS styles for RegionSwitcher
  - [x] 11.1 Add RegionSwitcher styles to `src/style.css`
    - Style `.region-switcher` container (position, layout)
    - Style the select element to match existing UI (dark theme, consistent with TimeSlider)
    - Ensure disabled state is visually distinct
    - _Requirements: 4.2_

- [x] 12. Final checkpoint — Alles verdrahtet
  - Ensure all tests pass, ask the user if questions arise.
  - Git commit: `feat: wire multi-region system with region switcher in main orchestration`

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation with git commits
- Property tests validate universal correctness properties from the design document
- The refactoring steps (1–2) are designed to be minimally breaking — the old call sites get updated immediately in the same task group
- The EMSC SeismicPortal uses the same FDSN pipe-delimited text format as INGV, so no second parser is needed
- Existing property tests in `src/tests/properties/coordinate-projection.test.ts` need updating in task 1.3 due to the signature change

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "2.1"] },
    { "id": 1, "tasks": ["1.2", "1.3", "2.2"] },
    { "id": 2, "tasks": ["4.1"] },
    { "id": 3, "tasks": ["4.2", "4.3", "5.1"] },
    { "id": 4, "tasks": ["4.4", "5.2"] },
    { "id": 5, "tasks": ["7.1", "8.1"] },
    { "id": 6, "tasks": ["7.2", "8.2"] },
    { "id": 7, "tasks": ["10.1", "11.1"] },
    { "id": 8, "tasks": ["10.2", "10.3"] }
  ]
}
```
