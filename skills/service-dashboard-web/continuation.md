# Dashboard web continuation

The initial source import was compared byte-for-byte with all ten assets on the live custom domain. The public runtime source is preserved in commit `f37b0e9e8b568f49c3295ae497beac3c1e161cda`. The documentation screenshots exercise the real interface with fictional projects.

The selector renders newly discovered boards from the feed. Data sources explains the discovery interval and how to include repository releases. Tests cover empty or previously unknown products, counting rules, the shared milestone roadmap and the HTTP asset boundary. [Portfolio discovery](https://github.com/theharithsa/project-atlas/issues/5) For layout work, run the local preview and follow the sprint, backlog and roadmap paths at desktop and phone widths. [Import issue and linked PR](https://github.com/theharithsa/project-atlas/issues/1) · [Testing](../../docs/testing.md)

Data sources shows the typed shared owner list and links to the GitHub settings editor. History shows closed board issues across all sprints, including unscheduled and parent issues. Check that an issue on two boards has one row with both memberships, that real closure dates sort correctly, and that sprint state filters and History work at narrow widths. [Guide](../../docs/handbook.md)

Version 0.4.0 adds a personal portfolio alongside the shared default. Test save, reload, switch, clear and recovery from an unavailable owner. Verify that data returned after a mode switch cannot enter the new view. [Personal portfolios](https://github.com/theharithsa/project-atlas/issues/10)

Version 0.5.0 shares a temporary personal route and adds four delivery tiles and two commit streak scopes. Verify the share, reload and return journey, seven-day History and both calendars against source data. [Sharing](https://github.com/theharithsa/project-atlas/issues/12) · [Metrics and activity](https://github.com/theharithsa/project-atlas/issues/13)

Version 0.6.0 offers four-week through five-year ranges, commit and contribution totals, and a month-to-day drilldown. Check the leap day, range changes and a linked developer view. [History issue](https://github.com/theharithsa/project-atlas/issues/15)

Exercise lifetime contributions on both a short and a five-year view, then switch developers. Check the join date, partial-year progress, mobile wrapping and shared links. [Lifetime issue](https://github.com/theharithsa/project-atlas/issues/17)

Version 0.8.0 adds the dark Astryx workspace, Atlas logo and motion, and a dedicated Activity route. Legacy Overview activity URLs map to the same range and month. Check keyboard movement, source coverage, the mobile drawer and the typography on all routes. [Redesign issue](https://github.com/theharithsa/project-atlas/issues/19)

When replacing brand artwork, change the asset URL in the page shell, opening and navigation header together. Check a returning browser as well as a fresh tab. [Logo release fix](https://github.com/theharithsa/project-atlas/issues/21)

Version 0.9.0 adds the overview timeframe, darker dropdown menus and a 3.1-second opening. Verify the same closure and release dates on the detail pages. Check newly discovered boards and deduplicated repositories against the counts in the heading. [Timeframe issue](https://github.com/theharithsa/project-atlas/issues/23)

Version 0.10.0 adds System, Light and Dark and a workload terrain derived from each board’s open leaf issues. Check both appearances during loading and on every route, navigate beyond the first six boards, rotate the map, and follow its board link with the selected timeframe. [Design issue](https://github.com/theharithsa/project-atlas/issues/25)

Version 0.10.1 carries the map design through a cold board read. Hold the first API response to verify the empty survey sheet and usable appearance controls, then return success and a retryable failure in separate runs. [Loading view](https://github.com/theharithsa/project-atlas/issues/27)

Version 0.10.2 aligns native selects, text fields and their icons on a 44px control. Verify both appearances, long option names, the keyboard menu, search, developer and owner entry, and sharing at desktop and phone widths. [Controls issue](https://github.com/theharithsa/project-atlas/issues/29)

For 0.11.0, open Work with All products, select two boards that reuse a sprint ID, then switch product and navigate Back. Check the desktop inspector and the phone return link. Compare planned milestones with the latest published tags. [Navigation issue](https://github.com/theharithsa/project-atlas/issues/31)
