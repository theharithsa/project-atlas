# Repository tooling continuation

The Project Atlas workflow is adapted from App Launchpad 1.14.2. The default branch requires the aggregate `foundation` check. It verifies both OS jobs and the jobs exercise the deployed stack. The repository’s public documentation uses GitHub Markdown and the live site uses Firebase Hosting.

Use the issue, pull request, Actions run and tag as the authoritative source for their own lifecycle state. Verify actual branch rules and deployment details when changing release mechanics. [Import issue](https://github.com/theharithsa/project-atlas/issues/1) · [Actions](https://github.com/theharithsa/project-atlas/actions/workflows/foundation.yml)

For 0.3.0, try settings variations in an isolated preview checkout. Verify an organization-only file and two empty arrays, then run the integrated check. [Settings file](../../config/owners.json)

Version 0.4.0 adds the public owner route and browser module to local preview. Compare the shared route and one external owner route on both preview and the live domain. [Testing](../../docs/testing.md)
