---
name: service-dashboard-web
description: Maintain the Project Atlas interface, planning rules and public static assets.
---

# Dashboard web

The product owner is theharithsa. The browser enters through `site/index.html` and `site/app.js`. The latter polls the same-origin feed, handles partial and delayed states, and preserves the visitor’s route and active issue search on refresh. `site/model.js` owns sprint and backlog classifications and deduplication of closed issues across boards. `site/overview.js` and `site/work.js` render the calendar, work lists and release views. `site/ui.js` escapes dynamic text and restricts outbound links to GitHub.

Keep sprint IDs scoped to a product. Count leaf issues for workload and exclude archived items and PRs. Use source dates in India time and show the original check time when data is delayed. The interface accepts public planning metadata and the server discovers each tracked owner’s open public boards. The product selector must handle new titles and empty boards without a UI edit. The portfolio selector switches every view. `site/portfolio.js` owns browser-local settings and combines the selected public feeds. Abort obsolete reads and preserve unsaved form input during refresh. There is no browser login or telemetry SDK. Update the [handbook](../../docs/handbook.md) when changing these definitions.

Run `npm test`, exercise a sprint drilldown and inspect narrow navigation for layout changes. Publish through the dedicated Firebase Hosting site and use its release history to restore a previous frontend. [API](../../docs/api.md) · [Operations](../../docs/delivery.md) · [Continuation](continuation.md)

Version 0.5 adds route serialization in `site/sharing.js` and project and developer streak presentation in `site/activity.js`. Preserve owner settings when entering a linked view. Keep project-scoped delivery measures and global developer search independently labeled. [Guide](../../docs/handbook.md#explore-coding-streaks)

The range model in `site/activity-range.js` clips multiple source years to inclusive calendar windows. Keep daily and month selections accessible and shareable. Missing dates must stay distinguishable from confirmed zeros. [Dashboard guide](../../docs/handbook.md#explore-coding-streaks)

The developer view shows contributions for the selected range and the account lifetime. Keep the lifetime cache scoped to the login and preserve coverage labels as range, month and streak settings change. [Guide](../../docs/handbook.md#explore-coding-streaks)

The workspace uses Astryx’s Neutral theme, site tokens in `site/console.css` and build-time Button and Badge markup from `scripts/build.mjs`. The boot and route transitions live in `site/atlas-motion.js`. `site/appearance.js` resolves the browser-local appearance before CSS loads. `site/terrain.js` maps prepared open issues to rotatable, keyboard-accessible terrain. Keep the opening dismissible, keep data fetches independent of motion and verify the reduced-motion branch.

Use `deliveryTimeframe` for Overview and its date-sensitive drilldowns. The visible menus share `selectPicker` and Astryx tokens. Keep the native select semantics, date inclusivity and filter state across links.
