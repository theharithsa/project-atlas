# Dashboard guide

Start with the whole portfolio or choose a product in the sidebar. A product selection follows you to Sprints, Backlog and Roadmap. A link in the browser’s address bar preserves the selected view and filters. [Open the live dashboard](https://pipeline.theharithsanotes.com/)

## Add a product

1. Create a GitHub Project under theharithsa or ArohaRetreat, set its visibility to public and leave it open. Atlas checks those owners’ directories every ten minutes while the dashboard is in use. The visible tab polls the feed every minute.
2. Add a public issue or pull request from each repository the board tracks. That gives Atlas a verified link to the repository’s milestones and latest published release. An empty board appears with zero items. A repository by itself does not create a product.
3. Use a native iteration field for sprints. Assign planned work to a sprint and leave unscheduled issues in Todo or Backlog. Set dates on GitHub release milestones when the team has agreed on a target.

Select the product in Atlas to follow its work. Project Atlas uses the same discovery path as every other board. [Atlas sprints](https://pipeline.theharithsanotes.com/#sprints?product=theharithsa-5) · [Atlas backlog](https://pipeline.theharithsanotes.com/#backlog?product=theharithsa-5) · [Atlas roadmap](https://pipeline.theharithsanotes.com/#roadmap?product=theharithsa-5)

## Follow a sprint

Select a colored sprint window in the calendar. The detail page shows its dates, issue closure and individual issues. Search by title, number or repository, then open an issue to see the source discussion. Sprint membership uses the native GitHub iteration ID. The first and last days both count, using the board check date in Asia/Kolkata.

![Sprint dates, closure and searchable issue rows for a fictional product](images/sprint.jpg)

## Interpret the backlog

**Unscheduled** includes open leaf issues with a Backlog, Todo or missing status, no sprint and no delivery milestone. Intake milestones such as Backlog triage can still appear here. **Milestone only** is useful for scoped work that still needs a sprint. **Board backlog** mirrors the board’s own Backlog and Todo statuses. An item can therefore appear in its assigned sprint and in Board backlog.

## Follow a release

The roadmap reads open GitHub milestones. A date is the target set on the milestone. Open **Data sources → Repository releases** to verify which version the repository actually published. A sprint closure percentage measures closed issues, including early closures.

## Investigate a discrepancy

Use the board check time in the top bar and check the selection under **Data sources**. A partial feed lists unavailable sources and totals cover the sources that responded. During a temporary full outage an open page retains its previous timestamped view for up to ten minutes. The page retries when it regains visibility or network connectivity. [Source links and counting rules](https://pipeline.theharithsanotes.com/#sources)
