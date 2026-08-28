# CampiFlegrei 3D

Eine 3D-Web-Visualisierung von Erdbebendaten für vulkanische und seismische Regionen. Erdbeben werden als farbige Kugeln in einem 3D-Raum dargestellt (Längengrad → X, Tiefe → Y, Breitengrad → Z) und über die Zeit animiert. Aktuell unterstützt: die Campi Flegrei bei Neapel (Italien) und die Kanarischen Inseln.

## Features

- **3D-Visualisierung** der Erdbeben-Hypozentren mit Three.js
- **Mehrere Regionen** über ein Dropdown umschaltbar (Campi Flegrei, Kanarische Inseln)
- **Zeitanimation**: Ereignisse werden chronologisch über einen einstellbaren Zeitraum abgespielt
- **Magnitudenabhängige Größe**: Der Kugelradius skaliert linear mit der Magnitude
- **Altersabhängige Färbung**: Frische Ereignisse leuchten orange-rot (#FF4500), ältere verblassen zu einem gedämpften Blaugrau (#4A6080)
- **Interaktive Kamera**: Rotieren, Verschieben und Zoomen; automatische Kamerarotation, die bei Nutzerinteraktion pausiert

## Voraussetzungen

- **Node.js** (aktuelle LTS-Version empfohlen)
- **npm** (wird mit Node.js installiert)

## Installation & Start

```bash
npm install
npm run dev
```

Der Vite-Dev-Server startet und gibt die lokale URL aus.

Weitere Skripte:

| Befehl | Beschreibung |
| --- | --- |
| `npm run dev` | Startet den Vite-Entwicklungsserver |
| `npm run build` | Type-Check (`tsc`) und Produktions-Build (`vite build`) |
| `npm run preview` | Vorschau des Produktions-Builds |
| `npm test` | Führt alle Tests einmalig aus (`vitest run`) |
| `npm run test:watch` | Tests im Watch-Modus (`vitest`) |

## Bedienung

- **Region wählen**: Über das Dropdown (Region-Switcher) zwischen den verfügbaren Regionen wechseln. Beim Wechsel wird die Szene neu aufgebaut und die Daten der neuen Region geladen.
- **Zeitraum**: Über die Datumsfelder des Time-Sliders den Anfang und das Ende des Betrachtungszeitraums festlegen.
- **Wiedergabe**: Mit Play/Pause die Animation starten bzw. anhalten, mit Reset an den Anfang zurückspringen.
- **Geschwindigkeit**: Über den Geschwindigkeits-Selektor einen Multiplikator zwischen 0,25× und 8× wählen.
- **Fortschritt & virtuelle Zeit**: Der Fortschrittsbalken und die Zeitanzeige zeigen die aktuelle virtuelle Zeit innerhalb des Zeitraums.

Kamerasteuerung:

- **Linke Maustaste / ein Finger**: Rotieren
- **Mittlere/rechte Maustaste, zwei Finger (Trackpad)**: Verschieben (Pan)
- **Scrollen / Pinch**: Zoomen

Die automatische Kamerarotation pausiert während der Interaktion und setzt nach einer kurzen Verzögerung sanft wieder ein.

## Datenquellen

Die Erdbebendaten stammen aus FDSN-kompatiblen Web-Services im pipe-getrennten Textformat (`fdsn-text`):

- **Campi Flegrei**: INGV — `https://webservices.ingv.it/fdsnws/event/1/query` (bis ca. Magnitude 1,0)
- **Kanarische Inseln**: EMSC/SeismicPortal — `https://www.seismicportal.eu/fdsnws/event/1/query` (bis ca. Magnitude 1,5)

Hinweise:

- Die minimal verfügbare Magnitude hängt vom jeweiligen Dienst ab (siehe oben). Für die Kanaren sind über FDSN keine Ereignisse unter Magnitude ~1,5 verfügbar.
- Die Anfragen gehen direkt an externe Dienste; diese müssen per **CORS** zugänglich sein. Bei Ausfall einer Anfrage behält der `DataFetcher` die zuvor geladenen Daten.

## Projektstruktur

```
src/
├── main.ts                  Bootstrap/Orchestrierung: WebGL-Check, Region-Registrierung, Animation-Loop
├── viewer.ts                Three.js-Szene: Kamera, Renderer, Licht, Oberflächen, Küstenlinien, Erdbebenkugeln
├── data-fetcher.ts          DataFetcher: FDSN-Text laden und parsen
├── coordinate-mapper.ts     Geo→Szene-Projektion, km-pro-Grad-Faktoren, Tiefenskalierung
├── magnitude-scale.ts       Magnitude → Kugelradius (linear, geklemmt)
├── color-mapper.ts          Ereignisalter → Farbe (HSL-Interpolation)
├── animation-controller.ts  Chronologische Zeitanimation, Geschwindigkeit, Play/Pause/Reset
├── rotation-engine.ts       Automatische Kamerarotation mit Pause/Resume
├── region-config.ts         RegionConfig-Interface
├── region-registry.ts       Registry: registerRegion / getRegion / getAllRegions / getDefaultRegionId
├── coastline-data.ts        Küstenlinie Campi Flegrei (OpenStreetMap, ODbL)
├── canary-coastline-data.ts Küstenlinien Kanaren (Natural Earth, Public Domain)
├── regions/                 RegionConfig-Instanzen (campi-flegrei.ts, canary-islands.ts)
├── types.ts                 Gemeinsame TypeScript-Interfaces
├── ui/
│   ├── time-slider.ts       Datumsfelder, Geschwindigkeit, Play/Pause/Reset, Fortschritt
│   └── region-switcher.ts   Dropdown zum Regionenwechsel
└── style.css                Styles
```

Details zur Architektur: siehe [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Neue Region hinzufügen

1. **Küstendaten bereitstellen**: Als Array von Polylinien im Format `[lat, lon][][]` (offene Küstenlinien oder geschlossene Insel-Polygone). Entweder direkt in der Region-Datei oder in einem eigenen Datenmodul.
2. **RegionConfig anlegen** unter `src/regions/`, z. B. `src/regions/meine-region.ts`:

   ```typescript
   import type { RegionConfig } from '../region-config';

   export const myRegion: RegionConfig = {
     id: 'meine-region',
     title: 'Meine Region',
     center: { lat: 28.3, lon: -16.5 },
     bounds: { minLat: 27.5, maxLat: 29.5, minLon: -18.5, maxLon: -13.5 },
     coastlinePolylines: [ /* [lat, lon][] Polylinien */ ],
     towns: [{ name: 'Ort', lat: 28.4, lon: -16.3 }],
     apiEndpoint: 'https://beispiel.org/fdsnws/event/1/query',
     apiFormat: 'fdsn-text',
     defaultTimeRangeDays: 30,
     cameraDistance: 500,
   };
   ```

3. **Registrieren** in `src/main.ts` über `registerRegion(myRegion)` neben den bestehenden Regionen. Danach erscheint die Region automatisch im Region-Switcher.

## Tests

```bash
npm test          # einmaliger Lauf
npm run test:watch
```

Die Tests bestehen aus Unit- und Integrationstests (`src/tests/`) sowie **Property-Based Tests** mit fast-check (`src/tests/properties/`), die Korrektheitseigenschaften über viele generierte Eingaben prüfen. Als Testumgebung dient happy-dom. Details zu den einzelnen Eigenschaften: siehe [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Lizenzhinweise Geodaten

- **Kanarische Inseln**: Küstenlinien aus Natural Earth (1:10m), Public Domain.
- **Campi Flegrei**: Küstenlinie aus OpenStreetMap, lizenziert unter der Open Database License (ODbL).
