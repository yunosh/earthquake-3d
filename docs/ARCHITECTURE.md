# Architektur — CampiFlegrei 3D

Dieses Dokument beschreibt den technischen Aufbau der Anwendung für Entwickler:innen.

## 1. Überblick

Die Anwendung ist in klar getrennte Modulschichten organisiert. Der Datenfluss verläuft von externen Datenquellen über die Domänen-/Mapping-Logik zum Rendering und zur UI, orchestriert durch ein zentrales Bootstrap-Modul.

```
Daten          →  data-fetcher.ts (FDSN-Text laden & parsen)
Domäne/Mapping →  coordinate-mapper.ts, magnitude-scale.ts, color-mapper.ts,
                  animation-controller.ts, rotation-engine.ts
Rendering      →  viewer.ts (Three.js-Szene)
UI             →  ui/time-slider.ts, ui/region-switcher.ts
Orchestrierung →  main.ts (verdrahtet alle Module, Animation-Loop)
Regionen       →  region-config.ts, region-registry.ts, regions/*
```

Die Schichten sind lose gekoppelt: Die Mapping-Module sind reine Funktionen bzw. zustandsarme Klassen, der Viewer kennt nur Szenen-Positionen und Farben, und `main.ts` verbindet Datenbeschaffung, Animation und Rendering über Callbacks.

## 2. Datenfluss

```
DataFetcher.fetch()
   │  (FDSN-Text, pipe-getrennt)
   ▼
Parsing → EarthquakeEvent[]
   │
   ▼
AnimationController (sequenziert Ereignisse chronologisch über die Zeit)
   │  onFrame(visibleEvents, highlight, progress, virtualTime)
   ▼
Viewer.updateVisibleEvents()
   │  Geo→Szene (coordinate-mapper), Radius (magnitude-scale), Farbe (color-mapper)
   ▼
InstancedMesh (Erdbebenkugeln) im 3D-Raum
```

1. Der `DataFetcher` lädt den FDSN-Text vom konfigurierten Endpunkt und parst ihn zu `EarthquakeEvent[]`.
2. Der `AnimationController` erhält die Ereignisliste und berechnet pro Frame, welche Ereignisse zur aktuellen virtuellen Zeit sichtbar sind, sowie den Hervorhebungs-/Fortschrittszustand.
3. Über den `onFrame`-Callback übergibt `main.ts` die sichtbaren Ereignisse an den `Viewer`.
4. `Viewer.updateVisibleEvents()` bildet Geo-Koordinaten auf Szenenpositionen ab, bestimmt Radius und Farbe und aktualisiert die `InstancedMesh`.

## 3. Module im Detail

### main.ts (Orchestrierung)
Bootstrap der Anwendung: prüft die WebGL-Verfügbarkeit, registriert die Regionen in der Registry, instanziiert und verdrahtet alle Module (Viewer, DataFetcher, AnimationController, RotationEngine, UI) und betreibt die Animationsschleife über `requestAnimationFrame`.

### viewer.ts (Rendering)
Verwaltet die Three.js-Szene: Kamera, Renderer, Licht, Oberflächen-Ebenen (Wasser + Land), Küstenlinien, Ortsbeschriftungen, Tiefenachse und die `InstancedMesh` für die Erdbebenkugeln. Zentrale Methoden:
- `init()` — Grundaufbau der Szene
- `setupRegion()` — baut die regionsspezifischen Szenenelemente auf
- `clearRegionElements()` — entfernt die Elemente der vorherigen Region beim Wechsel
- `updateVisibleEvents()` — aktualisiert die sichtbaren Erdbebenkugeln pro Frame

### data-fetcher.ts
Die `DataFetcher`-Klasse lädt und parst FDSN-Textdaten. Endpunkt und Bounds sind konfigurierbar, laufende Anfragen sind über Abort unterbrechbar. Bei einem Fehlschlag behält der Fetcher die zuvor geladenen Daten, um die Darstellung stabil zu halten.

### coordinate-mapper.ts
- `geoToScene()` — konvertiert lat/lon/depth in 3D-Szenenkoordinaten.
- `createCoordinateMapperConfig()` — berechnet die km-pro-Grad-Faktoren (`kmPerDegreeLon = 111 * cos(centerLat)`).
- `computeDepthScale()` — dynamische Tiefenskalierung.
- Wichtig: Norden wird auf **-Z** abgebildet (Three.js-Konvention „von der Kamera weg").

### magnitude-scale.ts
Bildet die Magnitude linear und geklemmt auf einen Kugelradius ab, sodass sehr kleine bzw. sehr große Werte in einem sinnvollen Bereich bleiben.

### color-mapper.ts
Bildet das Alter eines Ereignisses per HSL-Interpolation auf eine Farbe ab: frische Ereignisse leuchten orange-rot (`#FF4500`), alte verblassen zu gedämpftem Blaugrau (`#4A6080`).

### animation-controller.ts
Der `AnimationController` spielt Ereignisse chronologisch über `defaultDurationSec` ab (Standard: 20 s bei 1×-Geschwindigkeit). Der Geschwindigkeitsmultiplikator reicht von 0,25× bis 8×. Er verarbeitet Play/Pause/Reset und berechnet pro Frame die sichtbaren Ereignisse sowie den Hervorhebungszustand. Sonderfall Einzelereignis (`timeSpanMs = 0`): Hier wird eine Echtzeit-Progression verwendet.

### rotation-engine.ts
Die `RotationEngine` sorgt für eine automatische Kamerarotation (10°/s). Sie pausiert bei Nutzerinteraktion und setzt nach einer Verzögerung mit Ease-in wieder ein.

### Regionen-System
`region-config.ts` definiert das `RegionConfig`-Interface. `region-registry.ts` stellt die Registry-Funktionen bereit: `registerRegion()`, `getRegion(id)`, `getAllRegions()`, `getDefaultRegionId()` (liefert `'campi-flegrei'`). Die konkreten Regionen liegen in `regions/campi-flegrei.ts` und `regions/canary-islands.ts`.

### ui
- `time-slider.ts` — `TimeSlider`: Datumsfelder für den Zeitraum, Geschwindigkeits-Selektor, Play/Pause/Reset-Buttons, Fortschrittsbalken, Anzeige der virtuellen Zeit und Nachrichtenbereich.
- `region-switcher.ts` — `RegionSwitcher`: Dropdown zum Umschalten der Region.

## 4. Koordinatensystem

Die Geo→Szene-Abbildung folgt festen Konventionen:

- **Längengrad → X** (Osten = +X)
- **Breitengrad → Z** (Norden = **-Z**, passend zur Three.js-Konvention „von der Kamera weg")
- **Tiefe → Y** (tiefer = negativeres Y)

Skalierungsfaktoren:

- `HORIZONTAL_SCALE = 10` (1 km = 10 Szeneneinheiten)
- `kmPerDegreeLat = 111`
- `kmPerDegreeLon = 111 * cos(centerLat)` — berücksichtigt die Verkürzung der Längengrade mit zunehmender Breite

Die Kamera rahmt die Szene automatisch anhand der Ausdehnung der Region-Bounds ein. Sie ist südlich erhöht positioniert und blickt nach Norden; die Near-/Far-Clipping-Ebenen werden dynamisch berechnet. Sowohl die **Kugelgrößen** der Erdbeben als auch die **Kameradistanz** sind bounds-relativ: So bleiben die Ereignisse sowohl in kleinen Regionen (Campi Flegrei) als auch in großen Regionen (Kanaren) sichtbar und die Szene ist stets sinnvoll gerahmt. Das Feld `cameraDistance` in der `RegionConfig` bleibt zwar erhalten, wird aber vom Viewer anhand der Bounds-Ausdehnung überschrieben.

## 5. Regionen-System

Eine Region wird über eine `RegionConfig` beschrieben:

```typescript
export interface RegionConfig {
  id: string;
  title: string;
  center: { lat: number; lon: number };
  bounds: GeoBounds;                          // { minLat, maxLat, minLon, maxLon }
  coastlinePolylines: [number, number][][];   // Array von [lat, lon]-Polylinien
  towns: { name: string; lat: number; lon: number }[];
  apiEndpoint: string;                        // FDSN-Event-Query-Basis-URL
  apiFormat: 'fdsn-text';
  defaultTimeRangeDays: number;               // Standard-Abrufzeitraum
  cameraDistance: number;                     // vom Viewer aus Bounds überschrieben
}
```

Regionen werden in `main.ts` per `registerRegion()` in der Registry angemeldet und über `getRegion(id)` / `getAllRegions()` abgerufen. Zur Laufzeit wird über den `RegionSwitcher` gewechselt: Der Viewer entfernt via `clearRegionElements()` die Elemente der alten Region und baut über `setupRegion()` die neue Szene auf, während der `DataFetcher` mit dem neuen Endpunkt und den neuen Bounds neu konfiguriert wird.

## 6. Zeitanimation

Der `AnimationController` bildet reale Zeit auf virtuelle Zeit ab:

- Der gesamte Ereigniszeitraum (`timeSpanMs`) wird auf `defaultDurationSec` (Standard 20 s bei 1×) komprimiert abgespielt.
- Der Geschwindigkeitsmultiplikator (0,25×–8×) skaliert das Verhältnis von realer zu virtueller Zeit.
- Pro Frame werden die zur virtuellen Zeit sichtbaren Ereignisse ermittelt sowie deren Alter (für die Färbung) und der Hervorhebungszustand des zuletzt eingetretenen Ereignisses berechnet.
- **Sonderfall `timeSpanMs = 0`** (nur ein Ereignis bzw. identische Zeitstempel): Da keine Zeitspanne zum Komprimieren existiert, wird auf eine Echtzeit-Progression umgeschaltet, damit die Animation nicht durch Division durch Null degeneriert.

## 7. Rendering-Details

- **Erdbebenkugeln**: Eine einzige `InstancedMesh` rendert alle Kugeln performant. `frustumCulled = false` verhindert, dass Instanzen fälschlich aus dem Sichtvolumen gecullt werden (die Bounding-Sphere der Instanced-Mesh deckt nicht automatisch alle Instanzpositionen ab).
- **Oberflächen-Ebenen**: Wasser- und Land-Ebenen bilden den geografischen Hintergrund. Küstendaten werden danach unterschieden, ob eine Polylinie **offen** (Küstenlinie) oder **geschlossen** (Insel-Polygon) ist, und entsprechend dargestellt.
- **Tiefenachse**: Eine Achse visualisiert die Tiefendimension (Y), damit die vertikale Ausdehnung der Hypozentren ablesbar bleibt.

## 8. Property-Based Testing

Ergänzend zu Unit- und Integrationstests werden mit **fast-check** Korrektheitseigenschaften über viele generierte Eingaben geprüft. Die Generatoren sind auf den sinnvollen Eingaberaum eingeschränkt. Die Eigenschaften liegen in `src/tests/properties/`:

- `animation-progress-monotonicity.test.ts` — der Animationsfortschritt verläuft monoton
- `bounding-box-filter.test.ts` — Filterung von Ereignissen anhand der geografischen Bounds
- `chronological-visibility-order.test.ts` — sichtbare Ereignisse erscheinen in chronologischer Reihenfolge
- `coordinate-mapper-parameterized.test.ts` — parametrisierte Prüfung der Koordinatenabbildung
- `coordinate-projection.test.ts` — Ordnungserhaltung der Geo→Szene-Projektion
- `data-fetcher-region-properties.test.ts` — regionsabhängige Eigenschaften des DataFetchers
- `magnitude-radius-monotonicity.test.ts` — Monotonie der Magnitude→Radius-Abbildung
- `malformed-record-filtering.test.ts` — Herausfiltern fehlerhafter FDSN-Datensätze
- `parsing-round-trip.test.ts` — Round-Trip des FDSN-Parsings
- `region-switcher-properties.test.ts` — Eigenschaften des Regionenwechsels
- `registry-lookup-roundtrip.test.ts` — Round-Trip von Registrierung und Lookup in der Registry
- `speed-change-preserves-position.test.ts` — ein Geschwindigkeitswechsel erhält die aktuelle Position
- `temporal-color-age-ordering.test.ts` — die altersabhängige Färbung respektiert die zeitliche Ordnung

Die Testumgebung ist happy-dom.

## 9. Bekannte Einschränkungen

- **Kanaren-Magnitudenuntergrenze**: Über EMSC/SeismicPortal sind per FDSN keine Ereignisse unter Magnitude ~1,5 verfügbar; kleinere Beben werden daher nicht dargestellt.
- **Vereinfachte Küstenlinien**: Die Küstendaten sind generalisiert (Natural Earth 1:10m für die Kanaren, OpenStreetMap für die Campi Flegrei) und dienen der Orientierung, nicht der geodätisch exakten Darstellung.
- **CORS-Abhängigkeit**: Die Datenabrufe gehen direkt an externe FDSN-Dienste; deren Verfügbarkeit und CORS-Konfiguration bestimmen, ob Daten geladen werden können.
