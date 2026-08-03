# Fire data corrections implementation plan

**Goal:** Make the fire forecast truthfully dated, connect result selection to
map layers, expose exact historic-fire dates, and add a clearly labelled recent
satellite-detection dataset.

## 1. Lock the forecast date

- Update fire-danger service tests to require `TIME=YYYY-MM-DD` in display and
  sample requests and to reject transparent current-date pixels.
- Add an explicit date argument to the fire-danger URL and fetch helpers.
- Prevent an unavailable fire-danger result from being drawn.

## 2. Connect result selection and context layers

- Add store tests for automatic context activation, duplicate prevention and
  replacement of the oldest layer at the two-layer limit.
- Change dataset selection to activate a drawable context layer while preserving
  the existing primary-layer behavior.

## 3. Render historic event dates

- Add summary tests for localized full dates.
- Add component tests for a recent mapped-fire list.
- Replace the year-only summary and add a dedicated historic-fire detail block.

## 4. Add recent satellite detections

- Define typed detection/result contracts and register the dataset.
- Build and test a NASA GIBS VIIRS tile client: geographic tile selection, MVT
  decoding, timestamp extraction, 24-hour/radius filtering and de-duplication.
- Orchestrate the fetch with the other datasets.
- Add an empty GeoJSON source and circle layer, populated from the current search
  result.
- Add summary/detail copy, limitations, source link, legend and all locale keys.

## 5. Verify

- Run focused tests after each red/green cycle.
- Run type-check/build and the complete test suite.
- Inspect the final diff for unrelated changes and verify the four user-visible
  behaviors in the browser when practical.

