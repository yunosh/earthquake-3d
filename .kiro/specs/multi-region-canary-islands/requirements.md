# Requirements Document

## Introduction

Erweiterung der bestehenden 3D-Erdbeben-Visualisierung (Campi Flegrei) um ein Multi-Region-System. Als zweite Region werden die Kanarischen Inseln hinzugefügt. Ein UI-Switcher ermöglicht den Wechsel zwischen Regionen. Bestehende Module (Viewer, AnimationController, RotationEngine, TimeSlider) werden wiederverwendet; regionsspezifische Daten (Küstenlinie, Städte, Bounding Box, API-Endpunkt) werden über eine Konfigurationsstruktur abstrahiert.

## Glossary

- **App**: Die 3D-Erdbeben-Visualisierungsanwendung im Browser
- **Region_Config**: Konfigurationsobjekt, das alle regionsspezifischen Parameter bündelt (Bounding Box, Zentrum, Küstenlinie, Städte, API-Endpunkt, Regionstitel)
- **Region_Switcher**: UI-Element (Dropdown oder Tabs), das dem Benutzer den Wechsel zwischen verfügbaren Regionen ermöglicht
- **Data_Fetcher**: Modul zum Abrufen von Erdbebendaten von seismologischen APIs (INGV für Italien, IGN/FDSN für Spanien)
- **Viewer**: Three.js-basierter 3D-Renderer, der Küstenlinien, Städtemarker, Tiefenachse und Erdbebenpunkte darstellt
- **Coordinate_Mapper**: Modul zur Umrechnung geografischer Koordinaten in 3D-Szenenkoordinaten relativ zum Regionszentrum
- **Bounding_Box**: Geografischer Rahmen (minLat, maxLat, minLon, maxLon), der den Datenbereich einer Region definiert
- **INGV_API**: Erdbebenwebservice des Istituto Nazionale di Geofisica e Vulcanologia (Italien), FDSN-konform
- **IGN_FDSN_API**: Erdbebenwebservice des Instituto Geográfico Nacional (Spanien), FDSN-konform unter https://www.ign.es/web/ign/portal/sis-catalogo-terremotos
- **Coastline_Data**: Array von Polylinien mit [lat, lon]-Koordinaten, die Küstenverläufe einer Region beschreiben
- **Town_Labels**: Array von Ortsnamen mit zugehörigen Koordinaten für Beschriftung in der 3D-Szene

## Requirements

### Requirement 1: Region Configuration System

**User Story:** Als Entwickler möchte ich eine Region-Konfigurationsstruktur, sodass neue Regionen durch Hinzufügen eines Konfigurationsobjekts ergänzt werden können, ohne bestehenden Code zu ändern.

#### Acceptance Criteria

1. THE App SHALL define a Region_Config interface containing: unique region identifier, display title, center coordinates (latitude, longitude), Bounding_Box, Coastline_Data, Town_Labels, API endpoint URL, and API response format identifier
2. THE App SHALL provide a registry of all available Region_Config objects accessible by region identifier
3. WHEN the App starts, THE App SHALL load the default Region_Config (Campi Flegrei) from the registry
4. THE Region_Config for Campi Flegrei SHALL contain the existing Bounding_Box (lat 40.78–40.90, lon 14.03–14.22), center (40.827°N, 14.139°E), Coastline_Data, Town_Labels, and INGV_API endpoint

### Requirement 2: Canary Islands Region Data

**User Story:** Als Benutzer möchte ich Erdbebendaten der Kanarischen Inseln visualisieren, sodass ich vulkanische Aktivität in dieser Region beobachten kann.

#### Acceptance Criteria

1. THE Region_Config for Kanarische Inseln SHALL contain a Bounding_Box of lat 27.5–29.5, lon -18.5 to -13.3
2. THE Region_Config for Kanarische Inseln SHALL contain center coordinates at approximately 28.1°N, -15.4°W
3. THE Region_Config for Kanarische Inseln SHALL contain Coastline_Data covering the main islands: Tenerife, La Palma, El Hierro, Gran Canaria, Lanzarote, Fuerteventura, and La Gomera
4. THE Region_Config for Kanarische Inseln SHALL contain Town_Labels for principal towns including Santa Cruz de Tenerife, Las Palmas de Gran Canaria, Los Llanos de Aridane (La Palma), Valverde (El Hierro), Arrecife (Lanzarote), and Puerto del Rosario (Fuerteventura)
5. THE Region_Config for Kanarische Inseln SHALL specify the IGN_FDSN_API endpoint for earthquake data retrieval

### Requirement 3: Multi-Region Data Fetching

**User Story:** Als Benutzer möchte ich, dass die App Erdbebendaten von der korrekten API für jede Region abruft, sodass ich immer aktuelle regionale Daten sehe.

#### Acceptance Criteria

1. WHEN a Region_Config is activated, THE Data_Fetcher SHALL use the API endpoint and Bounding_Box from that Region_Config for all subsequent data requests
2. THE Data_Fetcher SHALL support both the INGV pipe-delimited text format and the IGN FDSN QuakeML or text format
3. IF the API endpoint for a region returns an error, THEN THE Data_Fetcher SHALL display an error message and retain previously loaded data
4. WHEN a region switch occurs, THE Data_Fetcher SHALL cancel any in-flight requests for the previous region before initiating new requests

### Requirement 4: Region Switcher UI

**User Story:** Als Benutzer möchte ich zwischen Regionen wechseln können, sodass ich Erdbebendaten verschiedener vulkanischer Gebiete vergleichen kann.

#### Acceptance Criteria

1. THE Region_Switcher SHALL display the names of all available regions from the registry
2. THE Region_Switcher SHALL visually indicate which region is currently active
3. WHEN the user selects a different region, THE Region_Switcher SHALL trigger a region change event with the selected region identifier
4. WHILE data is loading after a region switch, THE Region_Switcher SHALL be disabled to prevent concurrent switches

### Requirement 5: Region Switch Visualization Reset

**User Story:** Als Benutzer möchte ich, dass die 3D-Visualisierung beim Regionswechsel korrekt zurückgesetzt wird, sodass ich die neue Region ohne Artefakte der vorherigen sehe.

#### Acceptance Criteria

1. WHEN a region switch occurs, THE Viewer SHALL remove all existing Coastline_Data, Town_Labels, surface planes, and earthquake point meshes from the scene
2. WHEN a region switch occurs, THE Viewer SHALL render the new region's Coastline_Data, Town_Labels, and surface planes based on the new Region_Config
3. WHEN a region switch occurs, THE Coordinate_Mapper SHALL use the new Region_Config center coordinates and appropriate km-per-degree factors for the new latitude
4. WHEN a region switch occurs, THE App SHALL reset the AnimationController, set the progress to zero, and clear visible events
5. WHEN a region switch occurs, THE Viewer SHALL adjust the camera position and OrbitControls target to frame the new region appropriately

### Requirement 6: Coordinate Mapping Parameterization

**User Story:** Als Entwickler möchte ich, dass die Koordinatenumrechnung regionsspezifisch funktioniert, sodass jede Region korrekt in der 3D-Szene dargestellt wird.

#### Acceptance Criteria

1. THE Coordinate_Mapper SHALL accept center coordinates (latitude, longitude) as parameters instead of using hardcoded Campi Flegrei constants
2. THE Coordinate_Mapper SHALL compute km-per-degree-longitude based on the cosine of the region center latitude
3. FOR ALL earthquake events in a region, THE Coordinate_Mapper SHALL produce scene positions centered on the region center with consistent horizontal and depth scaling
