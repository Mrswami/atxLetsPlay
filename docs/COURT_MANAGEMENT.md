# Court Management Protocol

Source of truth: `src/data/courtsMeta.js` (`AUSTIN_COURTS_DATA`).

## Ingesting a recommendation
Users tap **"Missing a court? Let us know!"** (bottom of each district list), which emails `hello@letsplayatx.com` with a template (name, address, sport(s)).

1. **Triage** – confirm the court is real and publicly accessible (Google Maps / city PRD site). Prioritise courts requested by multiple people.
2. **Draft** a candidate JSON using the schema of an existing entry (`id` kebab-case, `coords`, `district`, `sport[]`, `courtCount`, `status`).
3. **Check duplicates & validity**:
   `node scripts/validateCourts.mjs candidate.json`
   Flags: same id, same normalised name, any court within 75 m, unknown sport/district, missing fields, mojibake characters.
4. **Add** to `AUSTIN_COURTS_DATA` under the right district comment, then run `npm run validate:courts`.
5. **Reply** to the requester; log it in `CHANGELOG.md` under *Added*.

## Corrections / removals
Fix in place (never change an `id` that has games attached). To retire a court set `status: 'closed'` instead of deleting.

## Conventions
- Sport label for bocce-style courts is **Hangar** (`petanque` key kept for data compatibility).
- Files are UTF-8; the validator fails CI on mojibake (`Ã`, `â`, `ð`, `�`).

## Automation
`npm run validate:courts` runs in CI (`.github/workflows/ci-cd.yml`) so bad or duplicate data cannot deploy.
