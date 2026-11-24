# Testing

Use Node.js 22. The repository checks require Python 3.11 or newer and a POSIX shell. Git for Windows provides Bash for the Windows CI job.

```sh
npm ci --ignore-scripts
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

For shared links, copy a filtered personal sprint, open it while another portfolio is active, and verify the selected sprint, issue state, search, reload and return journey. Check the four overview tiles against their destination counts. Exercise both streak modes, a selectable date and phone layout. The suite covers India-midnight boundaries, daily deduplication, unknown days, pagination caps, upstream failures and activity-cache renewal.

For activity ranges, compare the selected dates and totals across 28 days and five years. Open an older month containing a leap day, switch streak measure and reload a shared link. Check enrolled repository history against default-branch commits and the developer total against the individual dates on the signed-out GitHub profile calendar. Offline coverage includes multi-year aggregation, date clipping, pagination, retry after rate limits and incomplete calendars.

For lifetime contributions, use a developer with history predating the five-year chart. Compare all public calendar dates starting at account creation. Verify that four weeks and five years change only the range-dependent figures, that switching developers drops earlier results, and that empty and interrupted years have distinct states. Inspect both totals at phone width.

Inspect every dashboard page at desktop and phone widths. Check the opening on a fresh load and with reduced motion, confirm that the calendar supports arrow keys, and open a legacy Overview activity link. Verify the generated Astryx assets, local font files, primary button contrast and the share dialog.

Change the Overview timeframe from 7 to 30 days and compare closures, sprint totals and release targets with their linked detail pages. Check the opened menu, selection and focus at desktop and phone widths. Check the slower opening on a fresh load and verify immediate dismissal on input.

Exercise System, Light and Dark before the feed resolves, after reload and on each route. In Overview, inspect a board, rotate the workload terrain and open its filtered overview. Check keyboard input, reduced motion and a portfolio with more than six boards. A board with no open leaf issues should sit at ground level.

In Light, check the white canvas during loading, on the dashboard and in the share dialog. Open product, timeframe, work and activity filters with a keyboard. Verify that the selected text sits between the leading icon and caret, including at 375px width. Try a long board title and confirm its full text in the menu. Check issue search, owner inputs, developer username and the read-only share link for visible focus and matching heights with nearby buttons.
