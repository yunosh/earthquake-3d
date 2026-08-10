# Implementation Plan: Campi Flegrei 3D Earthquake Visualization

## Overview

Diese Implementierung baut eine webbasierte 3D-Erdbeben-Visualisierung als Single-Page-Application auf. Die Architektur folgt dem modularen Ansatz aus dem Design: Data Fetcher → Animation Controller → 3D Viewer, orchestriert durch einen zentralen App Entry Point. Alle Module werden in TypeScript mit Three.js implementiert und über Vite gebaut.

## Tasks

- [ ] 1. Project scaffolding and core interfaces
  - [-] 1.1 Initialize Vite + TypeScript project with Three.js
    - Run `npm create vite@latest . -- --template vanilla-ts`
    - Install dependencies: `three`, `@types/three`
    - Install dev dependencies: `vitest`, `fast-check`, `msw`
    - Configure `tsconfig.json` with strict mode
    - Create directory structure: `src/`, `src/ui/`, `src/tests/`, `src/tests/properties/`
    - Create minimal `index.html` with a `<div id="app">` container
    - Initialize git repository with `git init`
    - Create `.gitignore` for Node.js/TypeScript (node_modules, dist, .env, .env.*, *.log, coverage/, .DS_Store)
    - Make initial commit: `git add -A && git commit -m 'chore: initialize Vite + TypeScript project with Three.js'`
    - _Requirements: 6.1, 6.2_

  - [~] 1.2 Define core data model interfaces and types
    - Create `src/types.ts` with all interfaces: `EarthquakeEvent`, `VisibleEvent`, `ScenePosition`, `ColorMapping`, `DepthScale`, `MagnitudeScale`, `RawINGVRecord`, `FetchOptions`, `FetchResult`, `GeoBounds`
    - Export all types as named exports
    - _Requirements: 1.2, 2.1, 2.3, 2.4_

- [ ] 2. Data Fetcher implementation
  - [~] 2.1 Implement INGV API URL builder and response parser
    - Create `src/data-fetcher.ts` with `DataFetcher` class
    - Implement `buildUrl(options: FetchOptions): string` method constructing the INGV FDSNWS query URL with parameters: `starttime`, `endtime`, `minlat`, `maxlat`, `minlon`, `maxlon`, `format=text`
    - Implement `parseTextResponse(text: string): FetchResult` parsing pipe-delimited text, skipping header lines starting with `#`, extracting EventID, Time, Latitude, Longitude, Depth/Km, Magnitude, MagType, EventLocationName
    - Discard malformed records (missing fields, unparseable numbers, invalid dates) and collect them in `warnings[]`
    - _Requirements: 1.1, 1.2, 1.6_

  - [~] 2.2 Implement fetch with timeout and error handling
    - Implement `fetch(options: FetchOptions): Promise<FetchResult>` using `AbortController` with configurable timeout (default 15s)
    - Handle network errors, HTTP error codes, and timeout
    - Return previously loaded data on failure (retain previous data)
    - Default bounding box: lat 40.78–40.90, lon 14.03–14.22
    - Default time range: last 7 days
    - Commit: `git add -A && git commit -m 'feat: implement data fetcher with INGV API URL builder, parser, and error handling'`
    - _Requirements: 1.1, 1.3, 1.4, 1.5, 1.6_

  - [~] 2.3 Write property test for parsing round-trip consistency
    - **Property 1: Parsing Round-Trip Consistency**
    - Generate valid INGV text lines with fast-check (arbitrary EventID, valid timestamps, coordinates within bounding box, valid depth and magnitude)
    - Parse the generated line and verify extracted field values match the generated inputs within floating-point precision
    - **Validates: Requirements 1.2**

  - [~] 2.4 Write property test for bounding box filter integrity
    - **Property 2: Bounding Box Filter Integrity**
    - Generate `EarthquakeEvent` objects with arbitrary coordinates and verify all parsed events have latitude in [40.78, 40.90] and longitude in [14.03, 14.22]
    - **Validates: Requirements 1.1**

  - [~] 2.5 Write property test for malformed record filtering
    - **Property 8: Malformed Record Filtering**
    - Generate mixed INGV responses (valid + malformed lines) and verify: valid records parsed correctly, malformed records discarded, count(valid) + count(discarded) = total non-header lines
    - **Validates: Requirements 1.6**

- [~] 3. Checkpoint - Data Fetcher complete
  - Ensure all tests pass, ask the user if questions arise.
  - Commit: `git add -A && git commit -m 'feat: implement data fetcher with INGV API integration'`

- [ ] 4. 3D Viewer and scene setup
  - [~] 4.1 Implement core 3D scene with Three.js
    - Create `src/viewer.ts` with `Viewer` class
    - Initialize `WebGLRenderer`, `PerspectiveCamera` (FOV 60°), `Scene`
    - Add `AmbientLight` + `DirectionalLight`
    - Create semi-transparent reference plane (`PlaneGeometry`) at y=0 representing the earth's surface
    - Create dynamic depth axis with vertical guide lines and labels (1km, 2km, 3km...)
    - Handle window resize, WebGL context lost/restored events
    - Implement `dispose()` for cleanup
    - _Requirements: 2.1, 2.2, 6.2, 6.3, 6.4, 6.5_

  - [~] 4.2 Implement coordinate mapping and depth scaling
    - Create `src/coordinate-mapper.ts` with functions:
      - `geoToScene(lat, lon, depth, bounds, depthScale): ScenePosition` — linear projection centered on caldera center (40.827°N, 14.139°E)
      - `computeDepthScale(events): DepthScale` — dynamic scaling with min depth 2km for shallow datasets
    - Horizontal: ~1 unit = 100m, centered on caldera
    - Vertical: negative y for depth, dynamically scaled
    - Commit: `git add -A && git commit -m 'feat: implement 3D viewer scene setup and coordinate mapping'`
    - _Requirements: 2.1_

  - [~] 4.3 Write property test for coordinate projection bijectivity
    - **Property 9: Coordinate Projection Bijectivity and Ordering**
    - Generate earthquake events within bounding box, verify injective mapping (distinct geo-coords → distinct scene positions) and ordering preservation (east → larger x, north → larger z, deeper → lower y)
    - **Validates: Requirements 2.1**

- [ ] 5. Earthquake point rendering
  - [~] 5.1 Implement InstancedMesh-based point rendering
    - In `Viewer`, implement `updateVisibleEvents(events: VisibleEvent[]): void`
    - Use `InstancedMesh` with `SphereGeometry` for performance (up to ~1000 simultaneous points)
    - Set per-instance transform matrix (position from coordinate mapper, scale from magnitude)
    - Set per-instance color from age-based color mapping
    - Apply highlight effect (scale pulse 1.5x → 1.0x over 0.5s) for new events
    - _Requirements: 2.1, 2.3, 2.4, 4.4_

  - [~] 5.2 Implement magnitude scaling
    - Create `src/magnitude-scale.ts` implementing `MagnitudeScale` interface
    - `toRadius(magnitude): number` — clamped linear mapping: mag ≤ 0 → 2px, mag ≥ 4 → 16px, linear interpolation between
    - Convert screen-projected px to world-space radius based on camera distance
    - _Requirements: 2.3, 2.6_

  - [~] 5.3 Write property test for magnitude-to-radius monotonicity
    - **Property 3: Magnitude-to-Radius Monotonicity and Clamping**
    - Generate pairs of magnitude values, verify: radius non-decreasing with magnitude, clamped at bounds, linear between 0 and 4
    - **Validates: Requirements 2.3, 2.6**

  - [~] 5.4 Implement temporal age color encoding
    - Create `src/color-mapper.ts` implementing `ColorMapping` interface
    - `interpolate(age: number): THREE.Color` — HSL-based interpolation from fresh (#FF4500, bright orange-red) to faded (#4A6080, muted blue-grey)
    - Hue transition orange → blue, saturation decreasing, lightness decreasing
    - _Requirements: 2.4_

  - [~] 5.5 Write property test for temporal color age ordering
    - **Property 4: Temporal Color Age Ordering**
    - Generate pairs (ageA > ageB), verify color of A is at least as faded (equal or lower saturation/lightness) as color of B
    - **Validates: Requirements 2.4**

  - [~] 5.6 Implement tooltip on hover
    - In `Viewer`, implement raycasting on `pointermove` to detect hovered earthquake point
    - `showTooltip(event, screenPos)` displays: magnitude (1 decimal), depth (2 decimals, km), timestamp (ISO 8601)
    - `hideTooltip()` removes tooltip
    - Show within 200ms of hover
    - Commit: `git add -A && git commit -m 'feat: implement earthquake point rendering, magnitude scaling, color encoding, and tooltip'`
    - _Requirements: 2.5, 2.6_

- [~] 6. Checkpoint - 3D Viewer rendering complete
  - Ensure all tests pass, ask the user if questions arise.
  - Commit: `git add -A && git commit -m 'feat: implement 3D viewer with earthquake point rendering'`

- [ ] 7. Animation Controller
  - [~] 7.1 Implement animation playback logic
    - Create `src/animation-controller.ts` with `AnimationController` class
    - Implement `play()`, `pause()`, `reset()`, `setSpeed(multiplier)`
    - `tick(deltaTime)`: advance `virtualTime` linearly from startDate to endDate
    - Speed calculation: `(endDate - startDate) / (defaultDuration / speedMultiplier)`
    - Compute `visibleEvents[]` — all events with `timestamp ≤ virtualTime`
    - Compute `age` for each visible event: `(virtualTime - event.timestamp) / (endDate - startDate)`
    - Compute `isNew` and `highlightProgress` (0.5s highlight window)
    - Fire `onFrame` callback with visible events and virtual time
    - Commit: `git add -A && git commit -m 'feat: implement animation controller with playback logic'`
    - _Requirements: 4.1, 4.2, 4.3, 4.5, 4.6, 4.7, 4.8_

  - [~] 7.2 Write property test for chronological visibility order
    - **Property 5: Chronological Visibility Order**
    - Generate event sets and arbitrary virtual time T, verify: visible set = exactly events with timestamp ≤ T, no event with timestamp > T visible
    - **Validates: Requirements 4.1, 4.2, 4.5**

  - [~] 7.3 Write property test for animation progress monotonicity
    - **Property 6: Animation Progress Monotonicity**
    - Generate sequences of positive deltaTimes, verify: virtualTime strictly non-decreasing, progress moves from 0.0 toward 1.0 monotonically
    - **Validates: Requirements 4.2, 4.3**

  - [~] 7.4 Write property test for speed change preserves position
    - **Property 7: Speed Change Preserves Position**
    - Generate animation state + speed change, verify: virtualTime and visible events unchanged immediately after speed change
    - **Validates: Requirements 5.6**

- [ ] 8. Rotation Engine
  - [~] 8.1 Implement auto-rotation with interaction pause
    - Create `src/rotation-engine.ts` with `RotationEngine` class
    - Use Three.js `OrbitControls` with `autoRotate = true`, `autoRotateSpeed` set for 10°/s
    - `onInteractionStart()`: immediately set `autoRotate = false`
    - `onInteractionEnd()`: start 3s timer, then ease-in `autoRotateSpeed` from 0 → target over 1s
    - `update(deltaTime)`: handle ease-in interpolation
    - Commit: `git add -A && git commit -m 'feat: implement rotation engine with auto-rotation and interaction pause'`
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [ ] 9. Time Slider UI
  - [~] 9.1 Implement time slider and playback controls
    - Create `src/ui/time-slider.ts` with `TimeSlider` class
    - Render: two `<input type="date">` (start/end, range 2000-01-01 to today, default last 7 days)
    - Speed selector: `<select>` with 0.25x, 0.5x, 1x, 2x, 4x, 8x options
    - Playback buttons: Play/Pause toggle, Reset
    - Progress bar: `<progress>` element showing animation position
    - Virtual time display: `<span>` with current animation date/time
    - Message area: for error, warning, info messages
    - Wire callbacks: `onRangeChange`, `onSpeedChange`, `onPlayPause`, `onReset`
    - Implement `setProgress()`, `setVirtualTime()`, `setLoading()`, `showError()`, `showWarning()`, `showInfo()`
    - Commit: `git add -A && git commit -m 'feat: implement time slider UI and playback controls'`
    - _Requirements: 5.1, 5.2, 5.3, 5.7, 5.8_

- [~] 10. Checkpoint - All modules implemented
  - Ensure all tests pass, ask the user if questions arise.
  - Commit: `git add -A && git commit -m 'feat: implement animation controller, rotation engine, and time slider'`

- [ ] 11. Integration and wiring
  - [~] 11.1 Wire all modules together in main entry point
    - Create `src/main.ts` as application entry point
    - Initialize `DataFetcher`, `Viewer`, `AnimationController`, `RotationEngine`, `TimeSlider`
    - Connect data flow: TimeSlider → DataFetcher → AnimationController → Viewer
    - Connect rotation: Viewer interaction events → RotationEngine
    - Connect UI updates: AnimationController frame → TimeSlider progress/time display
    - Handle loading states and error propagation
    - Set up animation loop with `requestAnimationFrame`
    - WebGL availability check at startup
    - _Requirements: 1.4, 1.5, 5.4, 5.5, 5.6, 6.4, 6.6_

  - [~] 11.2 Implement error handling and recovery
    - Add WebGL context lost/restored event listeners with 5s recovery attempt
    - Implement error message display through TimeSlider UI for all failure scenarios
    - Ensure no unhandled Promise rejections — all async paths have error handlers
    - Implement data retention on fetch failure (keep previous data visible)
    - _Requirements: 1.4, 1.5, 1.6, 6.4, 6.5_

  - [~] 11.3 Add CSS styling and responsive layout
    - Create `src/style.css` with layout for canvas (full viewport) and UI overlay
    - Ensure no horizontal scrollbar for viewports 320px to 3840px
    - Position time slider and controls as overlay on top of 3D scene
    - Style tooltip, messages, and loading indicator
    - Commit: `git add -A && git commit -m 'feat: integrate all modules, add error handling and responsive styling'`
    - _Requirements: 6.3_

  - [~] 11.4 Write integration tests
    - Set up MSW (Mock Service Worker) for INGV API mocking
    - Test: DataFetcher correctly parses mocked INGV response
    - Test: AnimationController produces correct visible events for known dataset
    - Test: Full pipeline from fetch → animation → visible event calculation
    - _Requirements: 1.1, 1.2, 4.1, 4.2_

- [~] 12. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.
  - Commit: `git add -A && git commit -m 'feat: integrate all modules and add integration tests'`

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation after major milestones
- Property tests validate universal correctness properties from the design document
- Unit tests are embedded within implementation tasks where applicable
- The project uses Vite for dev server (`npm run dev`) and building (`npm run build`)
- Three.js OrbitControls provides built-in auto-rotation; the RotationEngine wraps this with pause/resume logic
- InstancedMesh is used for performance with up to 1000 simultaneous earthquake points

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2"] },
    { "id": 2, "tasks": ["2.1", "4.1"] },
    { "id": 3, "tasks": ["2.2", "4.2"] },
    { "id": 4, "tasks": ["2.3", "2.4", "2.5", "4.3", "5.2", "5.4"] },
    { "id": 5, "tasks": ["5.1", "5.6", "7.1", "8.1"] },
    { "id": 6, "tasks": ["5.3", "5.5", "7.2", "7.3", "7.4", "9.1"] },
    { "id": 7, "tasks": ["11.1"] },
    { "id": 8, "tasks": ["11.2", "11.3"] },
    { "id": 9, "tasks": ["11.4"] }
  ]
}
```
