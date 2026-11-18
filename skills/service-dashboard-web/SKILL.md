---
name: service-dashboard-web
description: Maintain the Project Atlas interface, planning rules and public static assets.
---

# Dashboard web

The product owner is theharithsa. The browser enters through `site/index.html` and `site/app.js`. The latter polls the same-origin feed, handles partial and delayed states, and preserves the visitor’s route and active issue search on refresh. `site/model.js` owns sprint and backlog classifications. `site/overview.js` and `site/work.js` render the calendar, work lists and release views. `site/ui.js` escapes dynamic text and restricts outbound links to GitHub.

Keep sprint IDs scoped to a product. Count leaf issues for workload and exclude archived items and PRs. Use source dates in India time and show the original check time when data is delayed. The interface accepts public planning metadata and the server uses a fixed source list. There is no browser login or telemetry SDK. Update the [handbook](../../docs/handbook.md) when changing these definitions.

Run `npm test`, exercise a sprint drilldown and inspect narrow navigation for layout changes. Publish through the dedicated Firebase Hosting site and use its release history to restore a previous frontend. [API](../../docs/api.md) · [Operations](../../docs/delivery.md) · [Continuation](continuation.md)
