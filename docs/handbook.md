# Dashboard guide

Start with the whole portfolio or choose a product in the sidebar. A product selection follows you to Sprints, Backlog, History and Roadmap. A link in the browser’s address bar preserves the selected view and filters. [Open the live dashboard](https://pipeline.theharithsanotes.com/)

## Change the shared portfolio owners

1. Open **Data sources → Shared portfolio owners → Edit owners on GitHub**. Sign in to GitHub to propose a change. The two lists contain account logins, as shown in GitHub profile URLs. [Live settings](https://pipeline.theharithsanotes.com/#sources) · [Shared file](../config/owners.json)
2. Add or remove logins in `users` and `organizations`. Keep both arrays. Either may be empty, and two empty arrays produce an empty dashboard. Repeated logins of the same type count once. Assign each login to exactly one type.
3. Open a pull request. A repository maintainer can merge it after the checks pass. The merged list applies to everyone. While the dashboard is in use the feed checks for changes every five minutes. GitHub and dashboard caching can add a short delay. Settings-only edits take effect without a Firebase deployment. [GitHub file editing](https://docs.github.com/en/repositories/working-with-files/managing-files/editing-files)

For example, this file would track one personal account and one organization. Replace each example login with your own.

```json
{
  "users": ["octocat"],
  "organizations": ["github"]
}
```

## Add a product

1. Create a GitHub Project under a configured user or organization, set its visibility to public and leave it open. Atlas checks those owners’ directories every ten minutes while the dashboard is in use. The visible tab polls the feed every minute.
2. Add a public issue or pull request from each repository the board tracks. That gives Atlas a verified link to the repository’s milestones and latest published release. An empty board appears with zero items. A repository by itself does not create a product.
3. Use a native iteration field for sprints. Assign planned work to a sprint and leave unscheduled issues in Todo or Backlog. Set dates on GitHub release milestones when the team has agreed on a target.

Select the product in Atlas to follow its work. Project Atlas uses the same discovery path as every other board. [Atlas sprints](https://pipeline.theharithsanotes.com/#sprints?product=theharithsa-5) · [Atlas backlog](https://pipeline.theharithsanotes.com/#backlog?product=theharithsa-5) · [Atlas roadmap](https://pipeline.theharithsanotes.com/#roadmap?product=theharithsa-5)

## Follow a sprint

Select a colored sprint window in the calendar. The detail page shows its dates, issue closure and individual issues. The list opens with all issues. Choose **Open** or **Closed** to narrow it. Search by title, number or repository, then open an issue to see the source discussion. Sprint membership uses the native GitHub iteration ID. The first and last days both count, using the board check date in Asia/Kolkata.

![Sprint dates, closure and searchable issue rows for a fictional product](images/sprint.jpg)

## Interpret the backlog

**Unscheduled** includes open leaf issues with a Backlog, Todo or missing status, no sprint and no delivery milestone. Intake milestones such as Backlog triage can still appear here. **Milestone only** is useful for scoped work that still needs a sprint. **Board backlog** mirrors the board’s own Backlog and Todo statuses. An item can therefore appear in its assigned sprint and in Board backlog.

## Find closed work

Open **History** for the whole portfolio or select a product to narrow it. Search by title, issue number, repository or closure reason. Each row links to the issue and its product or sprint. An issue on several selected boards appears once with links to each membership. [Portfolio history](https://pipeline.theharithsanotes.com/#history) · [Atlas history](https://pipeline.theharithsanotes.com/#history?product=theharithsa-5)

History includes closed parent issues and issues that never had a sprint. The newest closures appear first using GitHub’s closure timestamp, displayed in India time. If GitHub supplies a reason, such as **Not planned**, the row shows it. Rows with no closure date appear last. When GitHub reopens an issue, it leaves the closed list on refresh. **Repository history** links to GitHub’s full closed-issue list for each represented repository, including issues archived on or removed from the board.

## Follow a release

The roadmap reads open GitHub milestones. A date is the target set on the milestone. Open **Data sources → Repository releases** to verify which version the repository actually published. A sprint closure percentage measures closed issues, including early closures.

## Investigate a discrepancy

Use the board check time in the top bar and check the selection under **Data sources**. A partial feed lists unavailable sources and totals cover the sources that responded. During a temporary full outage an open page retains its previous timestamped view for up to ten minutes. The page retries when it regains visibility or network connectivity. [Source links and counting rules](https://pipeline.theharithsanotes.com/#sources)
