# Testing

Use Node.js 22. The repository checks require Python 3.11 or newer and a POSIX shell. Git for Windows provides Bash for the Windows CI job.

```sh
npm ci --prefix functions --ignore-scripts
npm test
sh scripts/check.sh
```

If the default Python is older, select the newer executable, for example `PYTHON=python3.12 sh scripts/check.sh`.

| Layer | What it verifies |
| --- | --- |
| Feed unit tests | Shared owner validation, changes, removals, expiry, failure recovery and empty configurations, owner-directory pagination, removal and outages, empty boards, canonical public repository evidence, flat item pagination, native closure dates and cache sharing. |
| HTTP boundary | The Firebase handler validates typed owner paths and rejects writes and URL selectors. Tests cover isolated caches, shared in-flight reads, bounded errors and the preview asset allowlist. |
| Dashboard model | Current-sprint closure, open leaf work, backlog classification, closed issues across multiple boards and sprints, missing dates and shared milestone deduplication using fictional boards. |
| Repository | Service catalog, template provenance, Markdown links, PR documentation impact, tracked-file publication checks and tooling regressions. |

The automated suite uses a local ephemeral port and synthetic fixtures, including for upstream failures. The local preview command in the README uses the real public feed. For a release smoke test, open the deployed dashboard, choose a sprint, open a scheduled issue, and check its source timestamp. Open **History**, compare a closure date with GitHub and try search, pagination and a product filter. Open **Data sources** to verify the account types and settings editor. Test the same views at phone width when navigation or layout changes. [CI results](https://github.com/theharithsa/project-atlas/actions/workflows/foundation.yml)

For personal portfolios, save an owner outside the shared settings and reload the browser. Check the personal closed history, switch back to shared, then return and clear the personal list. Exercise a missing owner alongside a healthy source. Automated cases cover storage failure, empty lists, scope validation, request cancellation and upstream capacity limits.
