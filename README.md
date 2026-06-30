# Traditional Chinese Day Calendar JSON

This repository publishes static JSON for a traditional Chinese day calendar.
The generated JSON is committed to the repo, so it can be consumed directly
from GitHub raw URLs, GitHub Pages, a CDN, or a local checkout.

The generator uses:

- [`lunar-javascript`](https://www.npmjs.com/package/lunar-javascript) for lunar calendar, sexagenary cycle, solar term, almanac, and day/time data.
- [`opencc-js`](https://www.npmjs.com/package/opencc-js) to convert returned Chinese strings from Simplified Chinese to Traditional Chinese.

## Files

- `data/today.json` is the stable latest-day URL target.
- `data/days/YYYY-MM-DD.json` stores dated snapshots.
- `scripts/generate-day.mjs` generates the JSON locally or in GitHub Actions.
- `scripts/serve-data.mjs` serves the committed JSON locally.
- `.github/workflows/publish-calendar.yml` regenerates and commits the JSON every day.

## GitHub raw URL

After pushing this repo to GitHub, the latest file is available at:

```text
https://raw.githubusercontent.com/<owner>/<repo>/main/data/today.json
```

Dated snapshots are available at:

```text
https://raw.githubusercontent.com/<owner>/<repo>/main/data/days/YYYY-MM-DD.json
```

## Local usage

Install dependencies:

```sh
pnpm install
```

Generate today's JSON using the default `Asia/Taipei` calendar day:

```sh
pnpm run generate:today
```

Generate a specific Gregorian date:

```sh
pnpm run generate -- --date 2026-06-30 --out data/today.json --date-out-dir data/days
```

Serve the committed JSON locally:

```sh
pnpm run serve
```

Then open:

```text
http://localhost:8787/today.json
```

## Daily automation

The workflow runs at `16:10 UTC`, just after midnight in `Asia/Taipei`, and
also supports manual runs from the GitHub Actions tab.

Generated JSON changes are committed by the workflow with
`stefanzweifel/git-auto-commit-action`, so daily data updates do not need to be
committed locally.

It needs the default GitHub token write permission. The repo already declares:

```yaml
permissions:
  contents: write
```

If your repository settings restrict workflow writes, enable:

```text
Settings -> Actions -> General -> Workflow permissions -> Read and write permissions
```

## JSON shape

The generated document includes:

- `calendarCard`, a ready-to-render block matching a traditional day-card UI:
  lunar headline, year/month/day stems and branches, weekday, five elements,
  clash and sha, Peng Zu, 喜神/福神/財神 directions, 宜/忌, 吉神, and 凶神.
- Gregorian date, weekday, constellation, and solar festivals.
- Lunar date, leap-month flag, lunar festivals, and full lunar text.
- Solar term for the day plus the year's solar-term table.
- Heavenly stems and earthly branches for year, month, day, and exact variants when provided by the library.
- Zodiac, Na Yin, almanac `宜` and `忌`, clash, sha, Peng Zu, deities, and auspicious directions.
- Nine-star and twenty-eight-mansion information.
- Moon phase, seasonal hou fields, and time-period almanac entries.
