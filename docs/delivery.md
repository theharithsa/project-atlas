# Delivery, deployment and recovery

Project Atlas uses GitHub Issues and release milestones to track its own work. The GitHub Projects boards displayed inside the app belong to the products it follows. This repository has one production branch, `main`, and one deployed Firebase environment.

## From issue to source release

1. Open or reuse an issue and choose a milestone. Classify the work as a bug, feature or task. The issue and milestone workflows reconcile missing classifications or milestones from GitHub metadata.
2. Open a short-lived branch and a linked pull request. Linux and Windows jobs run the app and repository checks with read-only repository access. The required `foundation` check succeeds when both platform jobs succeed. [Workflow](../.github/workflows/foundation.yml) · [Test commands](testing.md)
3. Review the current candidate and resolve conversations. Merge through GitHub after the checks pass. The solo-maintainer baseline requires a pull request with zero mandatory independent approvals, blocks force pushes, and automatically deletes eligible merged branches.
4. Create an unused semantic version tag on the reviewed commit and publish its release notes. Results belong on the issue, PR, Actions run and release. [Source releases](https://github.com/theharithsa/project-atlas/releases)

## Deploy the checked source to Firebase

The GitHub workflow runs checks. A maintainer with deployment access runs Firebase CLI from the reviewed revision after production deployment is authorized.

| Setting | Value |
| --- | --- |
| Firebase project | `the-harithsa-notes-94` |
| Hosting site | `the-harithsa-notes-pipeline` |
| HTTPS function / codebase | `atlasPublicFeed` / `project-atlas` |
| Function runtime / region | Node.js 22 / `us-east1` |
| Custom domain | [pipeline.theharithsanotes.com](https://pipeline.theharithsanotes.com/) |

```sh
npm ci --prefix functions --ignore-scripts
npm test
firebase deploy --project the-harithsa-notes-94 --only functions:project-atlas,hosting:the-harithsa-notes-pipeline
```

Use the named Hosting site and codebase because this Firebase project also hosts other products. Check HTTPS, `GET /api/v1/portfolio`, source coverage and a sprint drilldown. Record the hosting version and function revision separately from the Git commit.

## Recover

For a bad frontend release, restore the previous version of the dedicated Atlas site from Firebase Hosting release history. For a collector or schema regression, redeploy the known-good function source and locked dependencies from its tag. If the response contract changed, restore a compatible frontend and function together. Recheck the feed, the release roadmap and local-file denial. The app has no persisted customer records to migrate.
