---
name: service-portfolio-feed
description: Maintain the anonymous public GitHub collector, portfolio cache and Firebase HTTPS function.
---

# Portfolio feed

The product owner is theharithsa. `functions/github.js` owns source allowlisting, visibility and URL checks, flat pagination, native field extraction, milestones and release tags. `functions/feed.js` shares cache entries and in-flight refresh work. `functions/index.js` exposes GET and HEAD, controls CDN cache lifetime and bounds the public error response. The browser and the local preview share the [portfolio contract](../../docs/api.md).

Keep upstream paths tied to the configured GitHub board and repository. Drop restricted and unrecognized content and retain the original capture timestamp on the client during a full outage. Use synthetic data for request, privacy and pagination tests. The deployed service uses Node.js 22 in us-east1 with zero minimum and two maximum instances. It performs anonymous reads and stores no durable application data.

Run `npm ci --prefix functions --ignore-scripts` and `npm test`. Check live coverage when GitHub changes its public presentation. For recovery, redeploy the last known compatible function and lockfile from a checked tag. [Operations](../../docs/delivery.md) · [Continuation](continuation.md)
