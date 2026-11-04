# Squeekast

A **stream companion** for the hamster economy: three OBS browser-source overlays that read
Squeektoshi's wheel live on [Squeekchain](https://squeekchain.com).

Nobody on the Genesis board had built one, so this is the streaming lane: the wheel, the
mining ticker, and the block alert a streamer actually puts on screen.

## What it does

| Overlay | URL | What it shows |
| --- | --- | --- |
| Wheel | `overlay.html?o=wheel` | Squeektoshi's wheel as a dot-matrix disc that spins at his real `rpmMilli`, and stops when the core goes idle |
| Ticker | `overlay.html?o=ticker` | A 1280×92 strip: wheel rpm, Squeek block height, SQK live supply, Squeeks alive, difficulty per 1k blocks |
| Block alert | `overlay.html?o=alert` | Fires when a new Squeek block settles, and when the hamster wakes up |

Query parameters:

- `o` — `wheel` \| `ticker` \| `alert`
- `bg` — `0` transparent (default, composites in OBS) \| `1` solid dark
- `scale` — `0.75` \| `1` \| `1.35`
- `label` — `0` hides the caption under the wheel

The landing page at `index.html` is the builder: pick a mode, copy the URL into OBS, done.

## Where the numbers come from

Both endpoints are public and CORS-open, so there is no backend and no key:

- `GET https://api.squeekchain.com/v1/status` → `measurement.rpmMilli`, `measurement.coreStatus`,
  `builder.anchor.blockHeight`, `builder.anchor.workPerThousandBlocks`, `builder.anchor.settledThroughRound`
- `GET https://api.squeekchain.com/v1/economy/state` → `supply.liveSupplyBaseUnits`,
  `supply.capBaseUnits`, `nft.live`, `staking.totalStakedBaseUnits`

Polling is 5 s for status and 20 s for the economy. If a request fails the last good reading
stays on screen and the overlay dims, so a stream never shows an empty box.

## Run it locally

```bash
python3 -m http.server 8123
# open http://127.0.0.1:8123/
```

No build step, no dependencies, no bundler — plain HTML, CSS and JS, served as static files.

## OBS setup

1. Sources → `+` → Browser, paste the URL from the builder.
2. Size it: wheel `420×420`, ticker `1280×92`, alert `1280×720`.
3. Leave "Shutdown source when not visible" off so the alert keeps listening.

## Layout

```
index.html            builder + live telemetry
overlay.html          the overlay itself (?o=wheel|ticker|alert)
assets/styles.css     landing styles
assets/overlay.css    overlay styles
assets/app.js         landing: polling + URL builder
assets/overlay.js     overlay: polling, canvas wheel, ticker, alert
cover.png             card image
```

## Verification

<!-- squeekchain-verify -->
This repository is the source of the live site verified on the Squeekchain Genesis Code Lane.

## License

MIT.
