# Main branch rules

The required check is `foundation` from Project Atlas CI. The `app-launchpad-main` branch ruleset requires an up-to-date PR and resolved conversations, blocks deletions and force pushes, and grants no bypass roles. The sole-maintainer review policy uses zero mandatory independent approvals.

Read the live rules with `gh api repos/theharithsa/project-atlas/rules/branches/main`. To preview the versioned policy locally, run `python3 scripts/repository_ruleset.py --repo theharithsa/project-atlas`. Its `--apply` option requires repository admin access and an authorized change. [Delivery workflow](delivery.md)
