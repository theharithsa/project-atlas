# Project Atlas

Project Atlas gives product owners and maintainers one place to see what each team has scheduled, which issues still need a plan, what has closed, and which releases have a target date. It reads public GitHub Projects and links each result back to its source. Anyone can use the dashboard without signing in.

**[Open Project Atlas](https://pipeline.theharithsanotes.com/)** · [Current sprints](https://pipeline.theharithsanotes.com/#sprints) · [Backlog](https://pipeline.theharithsanotes.com/#backlog) · [Issue history](https://pipeline.theharithsanotes.com/#history) · [Release roadmap](https://pipeline.theharithsanotes.com/#roadmap)

![Project Atlas overview with three example products, a sprint calendar and upcoming milestones](docs/images/overview.jpg)

*The screenshots use fictional products and issues. The live dashboard reads the configured GitHub boards.*

## Read the dashboard

| To answer this question | Open |
| --- | --- |
| What is in flight for one product? | Choose the product in **Overview**, then open a sprint in the calendar to see its issues. |
| Which issues still need planning? | **Backlog → Unscheduled** shows open work without a sprint or delivery milestone. **Board backlog** shows the source board’s Backlog and Todo statuses, including scheduled issues. |
| Which issues closed recently? | **History** lists closed issues newest first. Select a product or search by issue number, title or repository. |
| How do I change the tracked accounts? | **Data sources → Edit owners on GitHub** opens the shared user and organization list for a pull request. |
| What is expected to ship next? | **Roadmap** shows versioned milestone targets. **Data sources** links to the latest published release for each repository. |
| How fresh are the numbers? | The status at the top shows the last board check in India time. Open **Data sources** for coverage or use the refresh button. |

While the page is visible it checks boards every minute. Repository milestones and release tags refresh on demand every three minutes. Workload counts exclude pull requests, archived entries and parent rollups. Atlas discovers open public boards under the configured users and organizations every ten minutes. It checks for changes to the shared owner settings every five minutes while the dashboard is in use. The dashboard also tracks its own work. [Atlas sprint](https://pipeline.theharithsanotes.com/#sprints?product=theharithsa-5) · [Atlas planning board](https://github.com/users/theharithsa/projects/5) · [Dashboard guide](docs/handbook.md)

## Run locally

Use Node.js 22 and a network connection to GitHub. The local server uses the same public collector as the deployed site.

```sh
git clone https://github.com/theharithsa/project-atlas.git
cd project-atlas
npm start
```

Open [localhost:4179](http://127.0.0.1:4179/). The preview reads the owner list from your local checkout. You can try different logins before proposing a shared change. [Owner settings](config/owners.json) To choose a different port, run `npm start -- 4180`. To install the Firebase function dependencies and run the application tests:

```sh
npm ci --prefix functions --ignore-scripts
npm test
```

## How it works

The frontend is plain HTML, CSS and JavaScript. Firebase Hosting routes `GET /api/v1/portfolio` to a Node.js function. The function lists public projects by owner, reads each open board as a signed-out visitor and discovers repositories from verified public issues and pull requests. An empty board can appear as soon as GitHub lists it. Add a public issue or PR from each repository to include its milestones and latest release. Concurrent visitors share the same refresh. The browser never needs a GitHub token.

| Source | Responsibility |
| --- | --- |
| [config/owners.json](config/owners.json) | Shared GitHub users and organizations, applied after merge without a Firebase deployment |
| [site/](site/) | Product filter, sprint calendar, issue search, closed history, backlog and roadmap |
| [functions/](functions/) | GitHub collection, visibility filtering, caching and the public HTTPS handler |
| [firebase.json](firebase.json) | Dedicated Hosting site, function rewrite and cache headers |
| [docs/api.md](docs/api.md) | API contract, data scope, timestamps and failure behavior |
| [docs/delivery.md](docs/delivery.md) | Pull request checks, release, Firebase deployment and rollback |

To report a mismatch, include the public board or milestone link, the active dashboard filter and the displayed check time. [Open an issue](https://github.com/theharithsa/project-atlas/issues/new/choose) · [Contributing](CONTRIBUTING.md) · [Security reporting](SECURITY.md) · [Release history](CHANGELOG.md)

## License

Project Atlas and the inherited App Launchpad foundation are MIT licensed. The bundled DM Sans font is distributed under the SIL Open Font License 1.1. [MIT license](LICENSE) · [Font license](site/assets/dm-sans-license.txt) · [Template provenance](docs/versioning.md)
