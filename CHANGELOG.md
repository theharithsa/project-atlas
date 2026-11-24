# Changelog

## 0.10.2 · 24 November 2026

- Switch Light to a pure white workspace. Refresh navigation, metrics and actions with Phosphor icons and identify products by their board initials.
- Align native dropdown values, carets, text fields and action buttons. Keep the full option titles available on narrow screens. [Controls issue](https://github.com/theharithsa/project-atlas/issues/29)

## 0.10.1 · 24 November 2026

- Show an empty survey grid while the first GitHub board request is pending. The loading view uses the selected appearance and hands over to the real terrain when the feed arrives. [Loading view](https://github.com/theharithsa/project-atlas/issues/27)

## 0.10.0 · 24 November 2026

- Explore open work as a rotatable terrain. Select a board’s peak, read its exact workload and open the filtered overview.
- Choose System, Light or Dark across the workspace, including planning views and the contribution calendar. The opening, theme change and page transitions honor reduced motion. [Design issue](https://github.com/theharithsa/project-atlas/issues/25)
- Restore assigned issue rows and their visible GitHub status labels in sprint and backlog views.

## 0.9.0 · 18 November 2026

- Select 7–365 days on Overview to compare issue closures, sprint windows and upcoming release targets. The linked views use the same dates.
- Match dropdown triggers and supported popups to the dark palette, and give the typed opening 3.1 seconds to play. [Overview controls](https://github.com/theharithsa/project-atlas/issues/23)

## 0.8.1 · 18 November 2026

- Serve the new Atlas mark at a dedicated URL for returning visitors. Match the navigation scrollbar to the dark theme. [Asset fix](https://github.com/theharithsa/project-atlas/issues/21)

## 0.8.0 · 18 November 2026

- Use the dark Astryx developer workspace across all pages. It includes a new Atlas mark, a short terminal opening and a rotating globe on Overview.
- Open **Activity** for selected-range and lifetime totals, monthly history and a Monday-first calendar with keyboard navigation. Earlier shared activity links keep their settings. [Redesign](https://github.com/theharithsa/project-atlas/issues/19)

## 0.7.0 · 18 November 2026

- Compare a developer’s contributions in the selected range with their lifetime total since joining GitHub. Older accounts show how many calendar years have been checked as the total fills in. [Lifetime contributions](https://github.com/theharithsa/project-atlas/issues/17)

## 0.6.0 · 18 November 2026

- Choose activity ranges from four weeks to five years for projects and developers. Inspect monthly and daily counts and share the same range and month. [Activity history](https://github.com/theharithsa/project-atlas/issues/15)
- See total commits in the selected window and GitHub’s public profile contribution count for a developer. Switch the streak measure to inspect consecutive contribution days.

## 0.5.0 · 18 November 2026

- Share a personal portfolio with its current product, sprint, issue filters and search. Recipients can browse the live view and return to their saved portfolio. [Shareable views](https://github.com/theharithsa/project-atlas/issues/12)
- Open seven-day closures, sprint completion, milestone-only issues and undated releases from the overview. Inspect daily commits and streaks for selected projects or a GitHub developer over 28 India calendar dates. [Metrics and activity](https://github.com/theharithsa/project-atlas/issues/13)

## 0.4.0 · 18 November 2026

- Choose **Shared portfolio** or **My portfolio** for every dashboard view. Visitors can save up to 12 public GitHub users and organizations in their browser, reload or switch back to shared, and clear their list. [Personal portfolios](https://github.com/theharithsa/project-atlas/issues/10)
- Read individual public owners through the versioned API. Independent owner caches, bounded work and visible partial results support live personal sprints, backlog, roadmaps and closed history.

## 0.3.0 · 18 November 2026

- Maintainers can add or remove shared GitHub users and organizations from Data sources through a checked settings PR. Owner changes take effect without a Firebase deployment. [Owner settings issue](https://github.com/theharithsa/project-atlas/issues/7)
- Browse and search closed issues across the portfolio or by product, sorted by GitHub closure time. History includes unscheduled issues and parent issues, with links to their sprints and complete repository history. Sprint details now open with both open and closed work. [Issue history](https://github.com/theharithsa/project-atlas/issues/8)

## 0.2.0 · 18 November 2026

- Discover open public projects in the tracked owner directories and populate sprint, backlog and roadmap views without maintaining a per-board list.
- Discover release repositories from public board items. Report availability per owner and keep empty boards visible.
- Track Atlas issues, pull requests and sprints on its own public Project. [Planning board](https://github.com/users/theharithsa/projects/5) · [Discovery issue](https://github.com/theharithsa/project-atlas/issues/5)

## 0.1.0 · 18 November 2026

First GitHub source release of the existing Project Atlas dashboard.

- Browse public product boards, current sprints, unscheduled work, planned milestones and published releases.
- Serve the public read-only feed through Firebase with shared refreshes, partial coverage reporting and source timestamps.
- Run the dashboard locally, verify changes on Linux and Windows, and contribute through issue-linked pull requests.

[Source publication issue](https://github.com/theharithsa/project-atlas/issues/1) · [GitHub releases](https://github.com/theharithsa/project-atlas/releases)
