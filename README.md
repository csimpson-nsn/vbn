# Vermont Basketball Network (VBN)

Sister site to the Vermont Football Network. A Northeast Sports Network production.

## Folder layout

```
index.html          Homepage: next game day, live scores refresh every 45 seconds
schedule.html       Full schedule with Boys/Girls, division, and team filters
data-cache.php      Fetches and saves Google Sheet tabs (NSN server only)
assets/vbn.css      Shared look for every page (colors, header, cards)
assets/vbn.js       Shared code for every page (data loading, team lookup, game cards, header, footer)
assets/logos/       Team logos go here (not created yet)
```

## Where the data comes from

All data lives in the **VBN Data Hub** Google Sheet. The pages read two tabs: **Schedule** and **Teams**.

On the NSN server, pages read through `data-cache.php`. On GitHub, PHP does not run, so the pages read the published Google links directly. No change to the files is needed when moving from GitHub to the NSN server.

Adding a new Sheet tab means two one-line changes: the `$SOURCES` list in `data-cache.php` and the `GOOGLE` list at the top of `assets/vbn.js`.

## Before launch

- Every new page needs the VBN GA4 tag (G-T9F0MPQ8Z0) as the first thing inside head. Copy it from index.html.
- Add team logos to `assets/logos/` and put each file's path in the Teams tab `LogoPath` column, for example `assets/logos/lyndon.png`.
- Update `SEASON_YEAR` at the top of `assets/vbn.js` each season.
