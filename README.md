# Vermont Basketball Network (VBN)

> VBN | Vermont Basketball Network | vbn.nsnsports.net | NOT a VFN file. Every file in this repo starts with this tag.

Sister site to the Vermont Football Network. A Northeast Sports Network production.

## Folder layout

```
index.html          Homepage: next game day, live scores refresh every 45 seconds
live-scores.html    Live Now, Later Today, and Final Scores, Boys/Girls tabs, refreshes every 45 seconds
scorekeeper.html    Staff only (not in the menu): passcode sign-in to send quarter scores and approve finals.
                    Talks to the VBN Scorekeeper Hub script. Setup: ../LIVE-SCORES-SETUP.md
schedule.html       Full schedule with Boys/Girls, league, VPA division, and team filters (team list narrows to match)
standings.html      League standings and VPA index points (unofficial until verified)
statistics.html     Player stat leaders with minimums, 10 per page
teams.html          Directory of every team with a League, Boys/Girls tabs, grouped by league
team.html           One team page for every school (team.html?team=Lyndon&g=B), Boys/Girls toggle,
                    league and division standing, PPG and points allowed ranks, schedule, roster, stats
team-download.html  Printable schedule & roster PDF for one team (reached from the button on team.html)
data-cache.php      Fetches and saves Google Sheet tabs (NSN server only)
assets/vbn.css      Shared look for every page (colors, header, cards)
assets/vbn.js       Shared code for every page (data loading, team lookup, game cards, header, footer)
assets/logos/       Team logos, 256x256 PNG, named after the school (lyndon.png)
```

## Where the data comes from

All data lives in the **VBN Data Hub** Google Sheet. The pages read **Schedule**, **Teams**, and, once they exist, **Stats** and **Roster**.

Stats tab: one row per player per game. GameID ties the row to a Schedule game. A blank cell means "not reported," which is different from 0.

Stats tab columns: GameID, Team, Player, Number, 2PM, 2PA, 3PM, 3PA, FTM, FTA, REB, AST, STL, BLK. There is no points column:
the site works out points (2 x 2PM + 3 x 3PM + FTM) and field goals (2s plus 3s). If a PTS column is ever added, the site
shows a warning when the typed points do not match the shots and uses the shots.

On the NSN server, pages read through `data-cache.php`. On GitHub, PHP does not run, so the pages read the published Google links directly. No change to the files is needed when moving from GitHub to the NSN server.

Adding a new Sheet tab means two one-line changes: the `$SOURCES` list in `data-cache.php` and the `GOOGLE` list at the top of `assets/vbn.js`.

## Team sponsors

Team page logos and the printable PDF sponsor come from the **SponsorDirectory** tab (columns SponsorTag, Name, URL, LogoPath).
Tag a row `TeamPage-Lyndon` for a logo on the Lyndon team page (boys and girls), `TeamPage-Lyndon-Girls` (or `-Boys`) for one side only,
and `TeamPDF-Lyndon` for the "Presented by" logo on the printable schedule & roster. Logos go in `assets/sponsors/`. A URL makes the logo clickable.
Every team page also shows two open "your business here" spots, so the space is always for sale.

## Live scores

Scorekeepers send scores through scorekeeper.html. A script in the private **VBN Scorekeeper Hub** sheet checks their passcode and writes Quarter, Team1Score, and Team2Score on the Schedule row. Quarter "Pending Final" means a final is waiting for an approver: pages show the score but never count it. Full setup and game night steps are in LIVE-SCORES-SETUP.md, one folder up.

## Adding a league (southern Vermont, etc.)

A school shows up in standings, the Teams directory, team rankings, and the schedule filters as soon as its Teams row has a **League** filled in. The NVAC column is only a note. League tabs and lists are built from the Teams tab, so a new league appears on its own. A league name ending in a single tier letter (Capital A, Capital B) shares one schedule filter tab (Capital).

## Before launch

- Every new page needs the VBN GA4 tag (G-T9F0MPQ8Z0) as the first thing inside head. Copy it from index.html.
- Logos live in `assets/logos/`. Each Teams row points to its file in the `LogoPath` column, for example `assets/logos/lyndon.png`.
- Index point values are in `INDEX_POINTS` near the middle of `assets/vbn.js`. Verify them against an official VPA release before launch.
- Update `SEASON_YEAR` at the top of `assets/vbn.js` each season.
