# Repository tooling continuation

The Project Atlas workflow is adapted from App Launchpad 1.14.2. The default branch requires the aggregate `foundation` check. It verifies both OS jobs and the jobs exercise the deployed stack. The repository’s public documentation uses GitHub Markdown and the live site uses Firebase Hosting.

Use the issue, pull request, Actions run and tag as the authoritative source for their own lifecycle state. Verify actual branch rules and deployment details when changing release mechanics. [Import issue](https://github.com/theharithsa/project-atlas/issues/1) · [Actions](https://github.com/theharithsa/project-atlas/actions/workflows/foundation.yml)

For 0.3.0, try settings variations in an isolated preview checkout. Verify an organization-only file and two empty arrays, then run the integrated check. [Settings file](../../config/owners.json)

Version 0.4.0 adds the public owner route and browser module to local preview. Compare the shared route and one external owner route on both preview and the live domain. [Testing](../../docs/testing.md)

The foundation workflow installs the pinned root design dependencies before the app test. The public site serves generated assets from a fixed allowlist in the local preview. [Operations](../../docs/delivery.md)

The preview allowlist includes the pre-paint appearance script and terrain module. Check both paths in the HTTP suite after changing the dashboard entry points.

For 0.10.2, verify that the same-origin icon sprite is served as SVG and the generated notices include Phosphor. [Controls issue](https://github.com/theharithsa/project-atlas/issues/29)

For 0.11.0, verify `/workspace.js` and `/workspace.css` in local preview and on the public Hosting domain. Compare the built icon sprite as part of the static asset check. [Workspace navigation](https://github.com/theharithsa/project-atlas/issues/31)
