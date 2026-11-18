# Public portfolio API

`GET /api/v1/portfolio` returns the public portfolio as JSON. `HEAD` returns the response headers. The route accepts an empty query string and has no authentication requirement. [Inspect the live response](https://pipeline.theharithsanotes.com/api/v1/portfolio)

| Field | Meaning |
| --- | --- |
| `schemaVersion` | Response contract version, currently `1`. The application release version is tracked separately. |
| `capturedAt`, `asOf`, `timezone` | Board check instant in UTC, corresponding calendar date and IANA time zone. |
| `projects[]` | Board key, title, owner, GitHub URL, optional health update, repositories represented by verified public items, iteration windows and published items. Iteration IDs are scoped to their board. |
| `projects[].items[]` | Public issue or pull request URL, title, number, repository, state, status, priority, size, sprint ID, milestone, rollup and permitted parent reference. Missing optional values are null. |
| `projects[].items[].closedAt`, `reason` | UTC ISO 8601 closure instant for a closed issue when GitHub provides it, otherwise null. The native closure reason is uppercase when available. |
| `sourceSettings` | Shared endpoint only. Active `users` and `organizations` arrays and their `refreshSeconds` (300). A configured empty portfolio returns both arrays empty and no projects. |
| `repositories` | Map keyed by owner/repository. Each entry has its own check time, open milestones with dates and counts, and latest published release when available. |
| `unavailable[]` | Source label and bounded explanation for a board or repository whose data could not be included, or a warning that the last validated owner list is in use. |
| `directoryOwners`, `directoryRefreshSeconds` | GitHub owners in scope and the membership refresh period in seconds (600). These fields were added in 0.2.0. |
| `boardRefreshSeconds`, `repositoryRefreshSeconds` | Normal refresh periods for board contents and release metadata (60 and 180 seconds). |

## Select a personal owner

`GET /api/v1/owners/users/{login}` and `GET /api/v1/owners/orgs/{login}` each return one owner’s public portfolio in the same schema. Both support HEAD and use the same product, repository, sprint, history and visibility rules as the shared feed. Use a GitHub login of up to 39 characters. Casing is ignored for lookups. These routes require an empty query string and use anonymous GitHub reads. [Public organization example](https://pipeline.theharithsanotes.com/api/v1/owners/orgs/vitejs)

The browser makes at most two concurrent owner reads and combines results by board key and repository. It uses the oldest successful check for portfolio freshness and the newest available release record for each repository. A valid empty directory returns 200 with zero boards. GitHub’s missing directory response maps to 404 with `public_owner_unavailable`. A temporary upstream failure or busy function returns 503 with a retry interval. Partial results carry warnings. Individual GitHub owner lookups can appear in infrastructure request logs. The service stores no per-visitor owner lists.

Each function instance coalesces duplicate reads, retains up to 16 individual owner caches and runs up to two personal refreshes at once. A personal refresh has a 45-second and 160-request upstream budget. Completed boards can be returned with a coverage warning when a limit is reached. Cold personal REST reads pause when GitHub reports ten or fewer remaining anonymous requests. The shared feed has an independent cache and can still use the remaining allowance.

## Shared settings and discovery

The shared owner scope comes from [config/owners.json](../config/owners.json) on the public default branch. The function reads a fixed GitHub URL anonymously and validates both lists. It checks again on demand after five minutes. During a settings outage, a previously validated list less than ten minutes old is usable with a warning in `unavailable`. A cold instance or an expired list produces a retryable 503. A valid empty configuration returns 200 without a directory request. [Settings reader](../functions/owner-settings.js)

Atlas paginates the public GitHub Projects REST directory for each owner. It rechecks board visibility, owner and number during every board refresh. Closing a board or making it private removes it when the public source reflects that change. A directory outage appears in `unavailable`. A successful empty directory contributes zero boards. A complete directory outage produces a retryable 503. [GitHub Projects REST API](https://docs.github.com/en/rest/projects/projects)

The collector derives repository membership from public issues and pull requests, including closed work. It verifies the public repository flag, repository slug and canonical item URL before it includes an item or uses the repository for releases. An empty board has empty repository and item arrays. A parent reference requires a repository independently verified on the same board. Draft planning items and restricted content are omitted. It uses GitHub’s public web representations, which can change independently of its documented REST API. Milestones use a public REST fallback when the web representation is incomplete. The browser cannot select an arbitrary upstream URL or repository.

| HTTP result | Client behavior |
| --- | --- |
| `200` | Use the data and inspect `unavailable` for partial coverage. Successful board responses are cached up to 60 seconds, partial responses up to 20 seconds. |
| `404` | Check the path and remove query parameters. For a personal owner, verify its login and account type. Product and sprint filters belong in the page URL fragment. |
| `405` | Use GET or HEAD. |
| `503` | The feed could not read the public boards. The error code is `github_unavailable` and the function sends `Retry-After: 30` and disables response caching. |

Cloud and local previews share the settings validator and collector. The local preview reads the owner file in its checkout. The local server exposes the same single-owner paths using a lightweight HTTP adapter and reports `source_unavailable` for an upstream failure. There is no durable application database or user write endpoint.
