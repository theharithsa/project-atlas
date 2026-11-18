# Public portfolio API

`GET /api/v1/portfolio` returns the public portfolio as JSON. `HEAD` returns the response headers. The route accepts an empty query string and has no authentication requirement. [Inspect the live response](https://pipeline.theharithsanotes.com/api/v1/portfolio)

| Field | Meaning |
| --- | --- |
| `schemaVersion` | Response contract version, currently `1`. The application release version is tracked separately. |
| `capturedAt`, `asOf`, `timezone` | Board check instant in UTC, corresponding calendar date and IANA time zone. |
| `projects[]` | Board key, title, owner, GitHub URL, optional health update, linked repositories, iteration windows and published items. Iteration IDs are scoped to their board. |
| `projects[].items[]` | Public issue or pull request URL, title, number, repository, state, status, priority, size, sprint ID, milestone, rollup and permitted parent reference. Missing optional values are null. |
| `repositories` | Map keyed by owner/repository. Each entry has its own check time, open milestones with dates and counts, and latest published release when available. |
| `unavailable[]` | Source label and bounded explanation for a board or repository whose data could not be included. |
| `boardRefreshSeconds`, `repositoryRefreshSeconds` | Normal refresh periods for boards and release metadata. |

The source inventory is declared in [functions/github.js](../functions/github.js). The collector verifies the board’s public flag, owner and number and verifies each item’s repository visibility and URL. Draft planning items and restricted content are omitted. It uses GitHub’s public web representations, which can change independently of its documented REST API. Milestones use a public REST fallback when the web representation is incomplete. The browser cannot select an arbitrary upstream URL or repository.

| HTTP result | Client behavior |
| --- | --- |
| `200` | Use the data and inspect `unavailable` for partial coverage. Successful board responses are cached up to 60 seconds, partial responses up to 20 seconds. |
| `404` | Check the path and remove query parameters. Product and sprint filters belong in the page URL fragment. |
| `405` | Use GET or HEAD. |
| `503` | The feed could not read the public boards. The error code is `github_unavailable` and the function sends `Retry-After: 30` and disables response caching. |

Cloud and local previews share the collector. The local server uses a separate lightweight HTTP adapter and reports `source_unavailable` for an upstream failure. There is no durable application database or user write endpoint.
