# Service inventory

| Service | Owner | Entry and boundary | Maintainer notes |
| --- | --- | --- | --- |
| Dashboard web | theharithsa | Static assets in `site/`; same-origin portfolio API; browser-local owner preferences, linked sprint views, delivery metrics and coding streaks | [Skill](../skills/service-dashboard-web/SKILL.md) · [Continuation](../skills/service-dashboard-web/continuation.md) |
| Portfolio feed | theharithsa | Firebase HTTPS function in `functions/`; shared users and organizations in [config/owners.json](../config/owners.json), anonymous portfolio, repository activity and developer commit search with bounded in-memory caches | [Skill](../skills/service-portfolio-feed/SKILL.md) · [Continuation](../skills/service-portfolio-feed/continuation.md) |
| Repository tooling | theharithsa | Local and CI checks, service registration, issue intake and opt-in branch rules | [Skill](../skills/service-foundation-tooling/SKILL.md) · [Continuation](../skills/service-foundation-tooling/continuation.md) |

The local preview in `scripts/serve.mjs` serves the same web files and imports the collector directly. The optional `scripts/snapshot.py` tool is for a maintainer comparing the authenticated GitHub view. Its output may include private planning data and stays in the ignored `local-archive/` directory. It is outside Hosting, repository releases and the public feed.

The service catalog is the machine-readable ownership record. Update the matching skill and continuation with material changes. [Catalog](../skills/catalog.json) · [API](api.md) · [Operations](delivery.md)
