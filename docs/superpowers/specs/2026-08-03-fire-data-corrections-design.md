# Fire data corrections

**Date:** 2026-08-03
**Status:** Approved in conversation

## Problem

The fire experience currently mixes two different concepts and overstates the
freshness of one of them:

1. The EFFIS Fire Weather Index map omits its `TIME` parameter. The service then
   returns an old default raster while the interface labels it as today's daily
   update.
2. Opening the mapped-fire result does not turn on its map layer, so the detail
   and the map appear disconnected.
3. The mapped-fire summary reduces a full event date to a year and provides no
   event list, despite the source already returning exact dates.
4. Historic burnt-area perimeters cannot answer whether a fire is active now.

## Decisions

### 1. The forecast fails closed

Every EFFIS Fire Weather Index request includes an explicit ISO date in the WMS
`TIME` parameter. The same date is stored in the result and shown to the reader.
If the requested dated raster has no usable pixel, the result is unavailable and
the overlay is not drawable. The app must never fall back silently to an
undated/default raster or stamp a service default with today's date.

### 2. A mapped result controls its map layer

Selecting a dataset with a context overlay turns that overlay on immediately.
The existing global limit of two context layers remains. If the limit is already
reached, the oldest selected context layer is replaced by the newly selected
one. Selecting an unavailable raster does not enable it.

### 3. Historic fires show event dates and events

The summary shows the exact most-recent EFFIS date in the current locale, not
only its year. The detail view lists the most recent mapped fires with date,
area, distance and available place names. The wording continues to say “mapped
fires” or “burnt areas”: these records describe where fire has occurred, not
where it is still burning.

### 4. Current detections are a separate dataset

Add “Recent satellite fire detections” as a fire/context dataset using NASA
FIRMS VIIRS daily thermal-anomaly vectors served by NASA GIBS. Query the tiles
covering the search radius, convert detections to local GeoJSON, and show their
recorded date/time and distance. The associated map layer displays those points
and is enabled when the result is opened.

The interface does not call a thermal anomaly a confirmed active wildfire.
Copy explains that satellite overpass timing, cloud and smoke can cause misses,
and that industrial or other heat sources can cause detections. A result with no
detections is evidence only for the stated observation window, never proof that
there is no fire.

## Data and failure handling

- Fire danger: Copernicus EFFIS `ecmwf007.fwi`, explicitly dated WMS request.
- Historic fires: Copernicus EFFIS burnt-area polygons, unchanged source.
- Recent detections: NASA FIRMS VIIRS NOAA-20 375 m “All” daily GIBS vector
  tiles. Today and the preceding day are requested so exact timestamps can be
  filtered to a rolling 24-hour window when supplied by the tile properties.
- A failed recent-detection request produces an unavailable result. It must not
  be converted to “zero detections”.
- Duplicate thermal detections from adjacent day/tile queries are removed.

## Testing

- Assert every fire-danger map and sample request contains the requested date,
  and transparent dated pixels are unavailable.
- Assert selecting mapped historic-fire and recent-detection results activates
  their context layers, including deterministic replacement at the two-layer
  limit.
- Assert summaries render an exact localized date and detail views expose the
  recent event/detection records.
- Assert GIBS tile selection, vector decoding, radius filtering, time filtering,
  duplicate removal and network-failure behavior.
- Assert dataset registry, ordering, translations and map layer plans include the
  new dataset without weakening missing-data semantics.

