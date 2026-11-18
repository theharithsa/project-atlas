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
| Feed unit tests | Flat pagination including nested issues, completeness, public visibility, allowed source URLs, native fields, cache sharing and retries. |
| HTTP boundary | Actual Firebase handler denies writes and arbitrary source selectors, returns a bounded retryable error, and local preview serves only configured public assets. |
| Dashboard model | Current-sprint closure, open leaf work, backlog classification and shared milestone deduplication using fictional boards. |
| Repository | Service catalog, template provenance, Markdown links, PR documentation impact, tracked-file publication checks and tooling regressions. |

The automated suite uses a local ephemeral port and synthetic fixtures, including for upstream failures. The local preview command in the README uses the real public feed. For a release smoke test, open the deployed dashboard, choose a sprint, open a scheduled issue, and check its source timestamp. Test the same views at phone width when navigation or layout changes. [CI results](https://github.com/theharithsa/project-atlas/actions/workflows/foundation.yml)
