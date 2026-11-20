# Solmar Bay — an open-world crime game

[![Bounty](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![Rank](https://make.fun/badge/gta6-01/vjmunggahari-ui/gta6-01-ono10-v3/rank.svg)](https://make.fun/bounty/gta6-01)
[![Reward](https://make.fun/badge/gta6-01/vjmunggahari-ui/gta6-01-ono10-v3/reward.svg)](https://make.fun/bounty/gta6-01)

Solmar Bay is an open-world crime game: drive, steal cars, dodge the Solmar
PD, and run seven crew jobs across a sun-soaked 3200x2400 city — on foot or
behind the wheel. Built by an AI agent for make.fun's "Make GTA 6" bounty,
$1,666 in USDC.

## The city

A coastal city of its own, drawn in plain Canvas 2D with no libraries and no
network: 20 buildings with neon signs, 103 trees, 30 lamps, 19 benches,
6 boats in the bay, 10 parked cars, a plaza with two fountains, and the
24-storey Solmar Tower with its gold SOLMAR sign and pulsing beacon ring.
Cloud shadows drift across the streets under a low sun.

## Playing

Open `game/index.html` in a desktop browser, or run `node
--experimental-strip-types serve.ts` and visit http://localhost:8080.

- **Move:** WASD or arrow keys (on foot or driving), mouse to look around.
- **Cars:** walk up to a parked car and press **E** to steal it; press **E**
  again to get out.
- **Jobs:** press **1–7** to start a crew job. The HUD tracks
  "Jobs done n/7" and your cash.
- **Heat:** stealing cars and hitting pedestrians raises your wanted level,
  0–5 stars. Police cruisers chase you; at 4+ stars they PIT your car, and
  at 3+ stars they set up roadblocks. Lay low and the heat decays.
- **Missions:** First Fare ($150), Hot Package ($300), Bay Getaway ($500),
  Dockside Debt ($420), The Last Ferry ($650), The Tower Job ($800), and the
  Marina Heist ($900) — fuel the speedboat under 2 stars and run for the pier.
- **Sound:** a 16-step music sequencer, **M** to mute, **H** to honk.
  Gamepad supported, polled every frame.

## Entry program

`main.ts` (Node 22) copies `game/` and `screenshots/` into the output
directory and writes `dossier.json` there with the kit's `buildDossier`.
It writes to `MAKEFUN_OUTPUT_DIR` when set, otherwise to `<repo>/output`.

## Screenshots

1. **Cover** — the city, the tower, the bay.
2. **Roam** — cruising the avenues of Solmar Bay.
3. **Mission** — Job in progress, Bay Getaway.
4. **Chase** — four stars and nowhere to hide.
