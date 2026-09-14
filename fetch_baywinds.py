#!/usr/bin/env python3
"""
fetch_baywinds.py — mirror the four Port Phillip BOM stations to static JSON.

Why this exists: the Bureau's JSON can't be read straight from a browser
(no CORS headers) and it rejects naive clients (needs a real User-Agent).
So we pull it here, on a schedule, and write a trimmed copy next to the page
as  data/{wmo}.json . The page reads those files same-origin — no CORS, fast.

Run locally:   python3 fetch_baywinds.py
On a schedule:  see .github/workflows/baywinds.yml
"""

import json
import os
import time
import urllib.request

# Product IDV60801 = "Latest Weather Observations", VIC. Same product for all four.
PRODUCT = "IDV60801"
STATIONS = {
    95864: "St Kilda Harbour RMYS",
    95872: "Fawkner Beacon",
    94847: "Point Wilson",
    94871: "Frankston Beach",
    94853: "South Channel Island",
}

# Only the fields the page uses — keeps the mirrored files tiny.
KEEP = (
    "wind_spd_kt", "gust_kt", "wind_dir", "air_temp",
    "local_date_time", "local_date_time_full", "name",
)

UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
      "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36")

OUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data")


def fetch(wmo, retries=3):
    url = f"http://www.bom.gov.au/fwo/{PRODUCT}/{PRODUCT}.{wmo}.json"
    req = urllib.request.Request(url, headers={
        "User-Agent": UA,
        "Referer": "http://www.bom.gov.au/",
        "Accept": "application/json,text/plain,*/*",
    })
    last = None
    for attempt in range(retries):
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                return json.loads(r.read().decode("utf-8"))
        except Exception as e:           # noqa: BLE001 — log and retry
            last = e
            time.sleep(3 * (attempt + 1))
    raise last


def trim(payload):
    rows = payload.get("observations", {}).get("data", [])
    slim = [{k: row.get(k) for k in KEEP} for row in rows]   # newest first, ~72h
    return {"observations": {"data": slim}}


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    ok = 0
    for wmo, name in STATIONS.items():
        try:
            data = trim(fetch(wmo))
            path = os.path.join(OUT_DIR, f"{wmo}.json")
            with open(path, "w") as f:
                json.dump(data, f, separators=(",", ":"))
            n = len(data["observations"]["data"])
            print(f"  ok  {name:<22} {wmo}  ({n} rows)")
            ok += 1
        except Exception as e:                                # noqa: BLE001
            print(f"  !!  {name:<22} {wmo}  failed: {e}")
        time.sleep(1)   # be a good citizen between stations
    print(f"{ok}/{len(STATIONS)} stations mirrored -> {OUT_DIR}")
    # Non-zero exit only if every station failed, so a single flaky station
    # doesn't fail the scheduled run.
    raise SystemExit(0 if ok else 1)


if __name__ == "__main__":
    main()
