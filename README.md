# Aurora — Bay Winds

Live Port Phillip wind for Aurora Sailing, read from the Bureau of Meteorology
for five bay stations — **St Kilda Harbour, Fawkner Beacon, Point Wilson,
Frankston Beach, South Channel Island**. Green is a good breeze; red means off
the water.

## Two views

- **`index.html`** — the fast, mobile-first page. Text-only, laid out so each
  station sits roughly where it is on the bay: St Kilda north-east, Fawkner
  north, Point Wilson west, Frankston east, South Channel south. Wind in knots
  and cardinal direction (e.g. SSW), plus the strongest gust in the last 15
  minutes. Loads in a blink.
- **`bay-map.html`** — a richer view for a big screen: a drawn bay map with a
  wind arrow at each station and a 24-hour windspeed-and-gust graph.

Both read the same mirrored data, so they deploy together.

## How it works

The Bureau's JSON can't be read straight from a browser (no CORS headers) and
it rejects naive clients. So a small scheduled job (`fetch_baywinds.py`) pulls
the five feeds and writes trimmed copies to `data/{wmo}.json`. The pages read
those files same-origin — no CORS, fast, and they keep working if a fetch fails.

```
BOM feeds ──(GitHub Action, every 5 min)──▶ data/*.json ──▶ index.html / bay-map.html
```

Until real data is present, the pages show clearly-labelled **sample data** so
nothing ever looks broken, and never looks fake.

## Deploy (about ten minutes)

Page and data on the same GitHub Pages site, so there's no cross-origin anything:

1. Put these files in a new repo (keep the layout, including
   `.github/workflows/baywinds.yml`).
2. **Settings → Pages** → deploy from `main`, root.
3. **Settings → Actions → General** → Workflow permissions → **Read and write**.
4. **Actions** tab → *Mirror Bay Winds* → **Run workflow** once to seed `data/`.
   After that it runs every five minutes on its own.
5. Live at `https://YOURUSER.github.io/REPO/`. This is the first page of the
   Aurora site built here — link between pages as you add them.

**New to GitHub?** Follow `DEPLOY-GUIDE.md` — the same steps, click by click,
written for a first-timer with no account.

### Your own domain (aurorasailing.com.au)

When you want the site served from your domain instead of the github.io address,
add it under **Settings → Pages → Custom domain** and point one DNS record at
GitHub. A small step you can do any time — ask when you're ready.

## Tuning

All near the top of the `<script>` in each page:

- **Wind bands** — the knot thresholds for Calm / Ideal / Fresh / Strong / Heavy
  (`BANDS`). Set them to your fleet — an Optimist reefs earlier than a keelboat.
- **Gust window** — `GUST_WINDOW_MIN` (default 15) is the "strongest gust in the
  last N minutes" window.
- **Stations** — add a line to `STATIONS` in the page (with its layout anchor)
  and the WMO number in `fetch_baywinds.py`. Bay stations use BOM product
  `IDV60801`; find a station's number on its observations page.
- **Refresh** — `REFRESH_MS` (browser re-read, 2 min) and the workflow `cron` (mirror, 5 min — GitHub's floor).

## Future ideas

**Squall alert — advance warning of the southerly change.** On a hot northerly
day the wind can collapse and return as a 25 kt+ southerly; Fawkner Beacon, out in
the channel, sees it 10–30 minutes before the northern beaches. The mirror job
already reads Fawkner every ten minutes, so this is a small addition to
`.github/workflows/baywinds.yml` rather than a new system:

- Fire when Fawkner's gust is ≥ 25 kt **and** the direction is southerly
  (S / SSW / SW / SSE) — so the hot northerly itself doesn't trip it; it fires on
  the change.
- Alert only on the rising edge, with hysteresis (re-arm once it drops back under
  ~20 kt), so it warns once per change, not every ten minutes. The armed/fired
  state lives in a tiny file in the repo, like the wind data.
- Delivery: ntfy.sh is the free, no-account route (install the ntfy app, subscribe
  to a topic, the job posts to it — push to any number of phones). A club Slack or
  Discord webhook works the same way.

Threshold, station, and the southerly set would all be config.

**A kids-first reading of the wind — the differentiator.** Turn the raw numbers
into something a young sailor understands at a glance. Every other wind site is
built for adults; an Aurora version that teaches kids to read the bay is unique
and on mission. Directions to explore:

- A plain-language line per station — what this wind means for you today, tuned to
  the fleet (an Optimist and a 420 reef at different points).
- Name the pattern when it's happening, e.g. "hot northerly — watch for the
  southerly change" (pairs with the squall alert above).
- A short "learn the wind" panel: what knots are, what the cardinals mean, why the
  bay breathes a sea breeze, the southerly change explained — a few sentences each.
- Short, jargon-free language; define terms where they appear.

**Beaufort translator.** Show the Beaufort force alongside the knots (e.g. 18 kt =
Force 5, "fresh breeze"), with the plain description. Pairs naturally with the
kids-first reading — the Beaufort words are already written for people, not
instruments. A small lookup table; no new data needed.

**True one-minute freshness.** The scheduled job floors at five minutes, and the
Bureau publishes about every ten, so a new reading shows within a few minutes.
To cut that to near-live — mainly worth it so the squall alert catches the change
fast — swap the scheduled mirror for an always-on fetcher (a free Cloudflare
Worker that fetches the Bureau on demand, caches for a minute, and serves it with
CORS). Same pages, different data path.

## A note on the source

The data is the Bureau's — free, public, and automatic, so it isn't
quality-checked and odd values happen. The page footer says as much. This is the
same public source the well-loved *baywx.com.au* draws on; we stand beside it,
we don't copy it.
