# Project Atlas skills

Start with the [App Launchpad workflow](../.agents/skills/app-launchpad/SKILL.md), then select the service that owns the change. [Service inventory](../docs/services.md) · [Catalog](catalog.json)

Use the [web skill](service-dashboard-web/SKILL.md) for interface, counting rules and static assets, the [feed skill](service-portfolio-feed/SKILL.md) for GitHub collection and HTTP behavior, and the [tooling skill](service-foundation-tooling/SKILL.md) for repository checks and issue automation. Each service records operating context in its continuation. Run `sh scripts/check.sh` when changing ownership or release behavior. [Tests](../docs/testing.md)
