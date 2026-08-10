# Requirements Document

## Introduction

Dieses Feature bietet eine webbasierte, animierte 3D-Ansicht, die die zeitliche und räumliche Progression von Erdbeben unterhalb der Campi Flegrei (Phlegräische Felder, Italien) darstellt. Einzelne Erdbeben werden als Punkte im dreidimensionalen Raum unter der Erdoberfläche angezeigt. Die Ansicht rotiert um eine vertikale Achse im Zentrum der Flegrei, während die zeitliche Abfolge der Erdbeben animiert dargestellt wird. Zeitraum und Geschwindigkeit der Animation sind konfigurierbar. Als erster Schritt werden Erdbeben der letzten sieben Tage angezeigt.

## Glossary

- **3D_Viewer**: Die webbasierte 3D-Visualisierungskomponente, die Erdbeben als Punkte im Raum darstellt und um eine vertikale Achse rotiert.
- **Earthquake_Point**: Ein visuelles Element im 3D-Raum, das ein einzelnes Erdbeben repräsentiert, positioniert nach Latitude, Longitude und Tiefe.
- **Data_Fetcher**: Die Komponente, die Erdbebendaten von einer externen seismologischen Datenquelle (z.B. INGV) abruft.
- **Animation_Controller**: Die Komponente, die die zeitliche Wiedergabe der Erdbeben-Sequenz steuert, einschließlich Start, Stopp und Geschwindigkeit.
- **Rotation_Engine**: Die Komponente, die die automatische Rotation der 3D-Ansicht um die vertikale Achse im Zentrum der Campi Flegrei steuert.
- **Time_Slider**: Das UI-Element, mit dem der Benutzer den angezeigten Zeitraum und die Wiedergabegeschwindigkeit konfigurieren kann.
- **INGV**: Istituto Nazionale di Geofisica e Vulcanologia – die seismologische Datenquelle für Erdbeben in der Region Campi Flegrei.

## Requirements

### Requirement 1: Erdbebendaten abrufen

**User Story:** Als Benutzer möchte ich, dass aktuelle Erdbebendaten aus der Region Campi Flegrei automatisch geladen werden, damit ich die seismische Aktivität der letzten Tage sehen kann.

#### Acceptance Criteria

1. WHEN the 3D_Viewer is initialized, THE Data_Fetcher SHALL retrieve earthquake data for the Campi Flegrei region from the INGV external seismological data source, bounded by the geographic rectangle latitude 40.78°N to 40.90°N and longitude 14.03°E to 14.22°E.
2. THE Data_Fetcher SHALL retrieve earthquake records containing latitude, longitude, depth (in km below sea level), magnitude (on Richter/local magnitude scale), and timestamp (in UTC with second precision) for each event.
3. THE Data_Fetcher SHALL retrieve earthquake data for a configurable time period between 1 and 90 days, defaulting to the last 7 days.
4. IF the external data source is unavailable or does not respond within 15 seconds, THEN THE Data_Fetcher SHALL display an error message to the user indicating that data could not be loaded and retain any previously loaded data in the view.
5. IF no earthquake events exist for the selected time period, THEN THE 3D_Viewer SHALL display an informational message indicating that no events were found for the selected period.
6. IF the external data source returns a response that cannot be parsed or contains records missing required fields, THEN THE Data_Fetcher SHALL discard the malformed records and display a warning message to the user indicating that some records could not be processed.

### Requirement 2: Erdbeben als 3D-Punkte darstellen

**User Story:** Als Benutzer möchte ich einzelne Erdbeben als Punkte im dreidimensionalen Raum unterhalb der Erdoberfläche sehen, damit ich die räumliche Verteilung der seismischen Aktivität erkennen kann.

#### Acceptance Criteria

1. THE 3D_Viewer SHALL render each earthquake event as an Earthquake_Point positioned in 3D space according to its latitude, longitude, and depth below the surface, where coordinates fall within the Campi Flegrei caldera bounding box and the vertical axis is dynamically scaled based on the minimum and maximum depth values present in the loaded dataset.
2. THE 3D_Viewer SHALL represent the earth's surface as a visible reference plane so that the depth of earthquakes relative to the surface is recognizable, with the plane rendered at depth 0 km and visually distinct from Earthquake_Points.
3. THE 3D_Viewer SHALL scale the Earthquake_Point radius proportionally to the earthquake magnitude within a range of 2 px (magnitude 0) to 16 px (magnitude 4) in screen-projected size.
4. THE 3D_Viewer SHALL encode the color of each Earthquake_Point based on its temporal age relative to the current virtual animation time, where freshly appeared events are rendered in a bright, vivid color and events progressively fade to a muted, dimmed color as the virtual time advances beyond their occurrence timestamp.
5. WHEN the user hovers over an Earthquake_Point, THE 3D_Viewer SHALL display a tooltip within 200 ms showing the earthquake's magnitude (to one decimal place), depth (in km to two decimal places), and timestamp (in ISO 8601 date-time format).
6. IF an earthquake event has a magnitude outside the range 0 to 4, THEN THE 3D_Viewer SHALL clamp the magnitude to the nearest bound for rendering size purposes and still display the original magnitude value in the tooltip.
7. IF no earthquake data is available for rendering, THEN THE 3D_Viewer SHALL display the reference plane with an empty scene and show a message indicating that no earthquake events are loaded.

### Requirement 3: Automatische Rotation um die Vertikalachse

**User Story:** Als Benutzer möchte ich, dass die 3D-Ansicht automatisch um eine vertikale Achse im Zentrum der Campi Flegrei rotiert, damit ich die räumliche Verteilung der Erdbeben aus allen Perspektiven betrachten kann.

#### Acceptance Criteria

1. THE Rotation_Engine SHALL continuously rotate the 3D_Viewer around a vertical axis centered on the geographic center of the Campi Flegrei caldera at approximately 40.827°N, 14.139°E.
2. THE Rotation_Engine SHALL rotate at a constant angular velocity of 10 degrees per second (completing one full revolution in 36 seconds).
3. WHEN the user interacts with the 3D_Viewer via mouse drag or touch gesture, THE Rotation_Engine SHALL pause automatic rotation within 100 ms to allow manual camera control.
4. WHEN the user has not interacted with the 3D_Viewer for 3 seconds after releasing manual camera control, THE Rotation_Engine SHALL resume automatic rotation with a smooth ease-in transition over 1 second.
5. WHILE the Rotation_Engine is rotating, THE 3D_Viewer SHALL maintain a minimum frame rate of 30 frames per second.

### Requirement 4: Zeitliche Animation der Erdbeben-Sequenz

**User Story:** Als Benutzer möchte ich die zeitliche Abfolge der Erdbeben als Animation sehen, damit ich erkennen kann, wie sich die seismische Aktivität über die Zeit entwickelt hat.

#### Acceptance Criteria

1. THE Animation_Controller SHALL display Earthquake_Points sequentially in chronological order of their occurrence timestamps.
2. WHILE the animation is playing, THE Animation_Controller SHALL progressively reveal Earthquake_Points from the earliest to the latest event in the selected time period.
3. WHILE the animation is playing, THE Animation_Controller SHALL display a time indicator showing the current date and time corresponding to the animation's position within the selected time period.
4. WHEN an Earthquake_Point first appears during animation, THE 3D_Viewer SHALL apply a visual highlight effect lasting between 0.3 and 1.0 seconds to distinguish the newly appeared event from previously revealed points.
5. THE Animation_Controller SHALL keep previously revealed Earthquake_Points visible after they have appeared, so that the cumulative spatial pattern builds up over the course of the animation.
6. THE Animation_Controller SHALL provide playback controls allowing the user to start, pause, and resume the animation.
7. THE Animation_Controller SHALL support a configurable playback speed between 0.5x and 4x of a default speed, where the default speed maps the entire selected time period to an animation duration of 10 to 30 seconds.
8. IF the user pauses the animation, THEN THE Animation_Controller SHALL retain all currently visible Earthquake_Points and the time indicator at the paused position until playback is resumed or stopped.

### Requirement 5: Steuerung von Zeitraum und Geschwindigkeit

**User Story:** Als Benutzer möchte ich den dargestellten Zeitraum und die Wiedergabegeschwindigkeit anpassen können, damit ich verschiedene Phasen der seismischen Aktivität gezielt untersuchen kann.

#### Acceptance Criteria

1. THE Time_Slider SHALL allow the user to select a start date and end date for the displayed earthquake events, where the selectable range spans from 2000-01-01 to the current date and the minimum selectable interval is 1 day.
2. THE Time_Slider SHALL allow the user to adjust the animation playback speed by selecting a multiplier between 0.25x and 8x in discrete steps (0.25x, 0.5x, 1x, 2x, 4x, 8x), with a default of 1x.
3. THE Animation_Controller SHALL provide play, pause, and reset controls for the animation, where reset returns the animation to the first event in the selected time range and sets the state to paused.
4. WHEN the user changes the time period via the Time_Slider, THE Data_Fetcher SHALL retrieve new earthquake data matching the selected time range and display the results within 3 seconds for the default 7-day range.
5. IF the Data_Fetcher fails to retrieve earthquake data for the selected time range, THEN THE System SHALL display an error message indicating the data could not be loaded and retain the previously displayed dataset.
6. WHEN the user adjusts the playback speed, THE Animation_Controller SHALL apply the new speed to the running animation within 200 milliseconds without restarting the animation from the beginning.
7. WHEN the user presses the play control while the animation is paused or reset, THE Animation_Controller SHALL start the animation from the current position at the currently selected playback speed.
8. WHEN the selected time range contains zero earthquake events, THE System SHALL display an informational message indicating no events were found for the selected period and show an empty visualization.

### Requirement 6: Webbasierte Darstellung

**User Story:** Als Benutzer möchte ich die 3D-Visualisierung direkt im Webbrowser öffnen können, ohne zusätzliche Software installieren zu müssen.

#### Acceptance Criteria

1. THE 3D_Viewer SHALL run in the last 2 major versions of Chrome, Firefox, Safari, and Edge without requiring plugins or additional software installation.
2. THE 3D_Viewer SHALL use WebGL-based 3D rendering for hardware-accelerated graphics.
3. THE 3D_Viewer SHALL render without horizontal scrollbar and with all interactive elements visible and operable for viewport widths from 320px to 3840px.
4. IF the user's browser does not support WebGL, THEN THE 3D_Viewer SHALL display an error message indicating the lack of WebGL support and recommending a compatible browser.
5. IF the WebGL rendering context is lost during a session, THEN THE 3D_Viewer SHALL display a notification indicating the rendering interruption and attempt to restore the 3D scene within 5 seconds.
6. WHEN the user navigates to the application URL, THE 3D_Viewer SHALL complete initial load and display the 3D scene within 10 seconds on a 10 Mbit/s connection.
