# Readable explanations, results that lead with data, and a changeable audience

Date: 2026-07-26
Status: approved for implementation

Three changes to how a searched location presents itself: the Public data list
puts rows that actually carry a value first, the AI explanation reads like
something a person would say out loud, and the resident/buyer choice made on the
entry card can be changed after a search.

## 1. Public data rows lead with what we know

Today `DatasetList` renders `orderedDatasets(location, audience)` — pure
relevance order. A row whose source returned nothing sits above rows with real
readings, so the first thing the reader sees can be three "no result" lines.

**Rank rows by status, then by relevance inside each rank.**

| Rank | Statuses | Why |
| --- | --- | --- |
| 0 | `available`, `loading`, not yet fetched | Has, or may still have, a value |
| 1 | `error` | No value, but retryable — the row carries a Retry button |
| 2 | `unavailable`, `unsupported` | No value, nothing to do about it |

`available` and `loading` share rank 0 deliberately. Results arrive
asynchronously; if `available` outranked `loading`, rows would climb past each
other as each fetch lands. Sharing the rank makes reordering **monotonic** —
every row starts at rank 0 and either stays there or drops once, so nothing the
reader is looking at ever jumps upward. Sorting is stable, so relevance order is
preserved within a rank.

`not_applicable` rows and the coverage filter are untouched — they are still
removed from the list entirely.

A quiet divider labelled "No result for this location" sits above the first
rank-1 row, so the reader understands the break rather than reading it as a
continuation of the ranked list. Error rows sit under that divider but keep
their own "couldn't load" wording and Retry button, which distinguishes them.

**Where the sort lives:** a new pure `rankByAvailability(defs, results)` in
`src/registry/ordering.ts`, applied by `DatasetList` and by `MobileSheet`'s
three-line peek preview. It is deliberately *not* folded into
`orderedDatasets`, because `submitLocation.ts` uses that function to choose
*fetch* order, where no result exists yet.

## 2. The explanation reads like a person talking

The current system prompt stacks six caution rules ("distinguish direct findings
from inference", "keep every stated source limitation intact", "do not offer
legal, financial or safety certainty"). Each is individually reasonable and
together they push the model into hedge-laden, clause-heavy prose. The audience
framing then adds `nota simple`, `Consorcio de Compensación de Seguros` and
`gestor` — unexplained — into the same prompt.

Rewrite `buildSystemPrompt` and `AUDIENCE_FRAMING` around one idea: **the reader
has never looked at water data before, and the follow-up questions are where
depth belongs.** Saying that explicitly in the prompt lets the model stop trying
to be complete in one paragraph.

The prompt keeps two rules verbatim in substance, because they are correctness,
not tone:

- Use only the evidence given; never guess a value for a missing or errored dataset.
- Never invent an overall risk score or combined rating.

And gains plain-language direction that applies in both languages:

- Open with the bottom line in one plain sentence.
- Short sentences; everyday words.
- An official term only when it is genuinely the name of the thing, with its
  everyday meaning first and the term in parentheses once.
- Name the source in words a person would use ("the national flood map (SNCZI)").
- Say once, plainly, when the data can't answer something — don't repeat the caveat.
- Leave depth to the follow-up questions.

Length moves from 120–200 words to **80–140**, and the three follow-up questions
are directed to be short, in the reader's own voice, and each opening a
different direction.

The audience framings are rewritten in the same register — a resident hears what
to check and who to ask (town hall, water company); a buyer hears what matters
before a purchase, with any legal term explained rather than dropped.

The evidence summaries in `services/ai.ts` stay precise and technical. They are
the model's grounding, not reader-facing text; the prompt handles translation
into plain language.

**Verification:** unit tests can only check that the prompt contains what it
should. Readability is checked by running `interpret()` against two realistic
evidence sets — one fully available, one mixing `unavailable` and `error` — and
reading the output as a lay reader.

## 3. The audience can be changed after a search

The entry card already tells the reader "You can change this later"
(`entry.changeLater`), and nothing in the searched view delivers on it.

A compact `AudienceSwitcher` — a label plus two toggle pills, matching the entry
card's toggle-off behaviour — renders at the top of `PanelBody`, which is shared
by the desktop panel and the mobile sheet, so both platforms get it from one
place.

Changing the audience:

- **re-ranks** the dataset list (relevance weights change),
- **marks a `ready` interpretation `stale`**, exactly as `setLanguage` already
  does, so the reader is never shown buyer-framed text under a resident
  selection. The existing stale banner offers regeneration,
- **does not refetch anything.** Audience influences fetch order only, and the
  data is already in hand.

`routeSync` already writes `aud` to the URL, so the change is shareable with no
further work.

## Testing

- `ordering.test.ts` — rank grouping; stability within a rank; the monotonic
  property asserted directly by replaying a load sequence (loading → mixed →
  settled) and checking no row's index ever decreases.
- `useAppStore.test.ts` — `setAudience` marks a ready interpretation stale, and
  leaves idle/loading/error untouched.
- `interpretCore` prompt assertions — plain-language and correctness rules
  present, in both audience framings and both languages.
- `DatasetList.test.tsx` — divider renders only when a no-result row exists.
- `i18n/parity.test.ts` covers the new `en`/`es` keys automatically.
