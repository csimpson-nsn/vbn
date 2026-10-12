# Vermont Basketball Network (VBN)

> VBN | Vermont Basketball Network | vbn.nsnsports.net | NOT a VFN file. Every file in this repo starts with this tag.

Sister site to the Vermont Football Network. A Northeast Sports Network production.

## Folder layout

```
index.html          Homepage: next game day, live scores refresh every 45 seconds
schedule.html       Full schedule with Boys/Girls, league, VPA division, and team filters (team list narrows to match)
standings.html      League standings and VPA index points (unofficial until verified)
statistics.html     Player stat leaders with minimums, 10 per page
teams.html          Directory of every team with a League, Boys/Girls tabs, grouped by league
team.html           One team page for every school (team.html?team=Lyndon&g=B), Boys/Girls toggle,
                    league and division standing, PPG and points allowed ranks, schedule, roster, stats
data-cache.php      Fetches and saves Google Sheet tabs (NSN server only)
assets/vbn.css      Shared look for every page (colors, header, cards)
assets/vbn.js       Shared code for every page (data loading, team lookup, game cards, header, footer)
assets/logos/       Team logos, 256x256 PNG, named after the school (lyndon.png)
```

## Where the data comes from

All data lives in the **VBN Data Hub** Google Sheet. The pages read **Schedule**, **Teams**, and, once they exist, **Stats** and **Roster**.

Stats tab: one row per player per game. GameID ties the row to a Schedule game. A blank cell means "not reported," which is different from 0.

On the NSN server, pages read through `data-cache.php`. On GitHub, PHP does not run, so the pages read the published Google links directly. No change to the files is needed when moving from GitHub to the NSN server.

Adding a new Sheet tab means two one-line changes: the `$SOURCES` list in `data-cache.php` and the `GOOGLE` list at the top of `assets/vbn.js`.

## Adding a league (southern Vermont, etc.)

A school shows up in standings, the Teams directory, team rankings, and the schedule filters as soon as its Teams row has a **League** filled in. The NVAC column is only a note. League tabs and lists are built from the Teams tab, so a new league appears on its own. A league name ending in a single tier letter (Capital A, Capital B) shares one schedule filter tab (Capital).

## Before launch

- Every new page needs the VBN GA4 tag (G-T9F0MPQ8Z0) as the first thing inside head. Copy it from index.html.
- Logos live in `assets/logos/`. Each Teams row points to its file in the `LogoPath` column, for example `assets/logos/lyndon.png`.
- Index point values are in `INDEX_POINTS` near the middle of `assets/vbn.js`. Verify them against an official VPA release before launch.
- Update `SEASON_YEAR` at the top of `assets/vbn.js` each season.
