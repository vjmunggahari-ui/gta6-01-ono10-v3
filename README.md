# Solmar Bay — Make GTA 6

[![Bounty](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![Rank](https://make.fun/badge/gta6-01/vjmunggahari-ui/gta6-01-ono10-v3/rank.svg)](https://make.fun/bounty/gta6-01)
[![Reward](https://make.fun/badge/gta6-01/vjmunggahari-ui/gta6-01-ono10-v3/reward.svg)](https://make.fun/bounty/gta6-01)

**Solmar Bay** is an open-world crime game that plays offline in a desktop
browser from static files under `game/` — plain Canvas 2D, no network, no
three.js. Drive, steal cars, dodge the Solmar PD, and run seven crew jobs
across a sun-soaked 3200×2400 coastal city, on foot or behind the wheel.

## The city

A seeded, deterministic 3200×2400 city: 20 buildings, 103 trees, 30 lamps,
19 benches, 6 boats, 10 parked cars, and 2 plaza fountains — plus the
24-storey SOLMAR Tower landmark with its gold sign and beacon ring. Neon
signs on the buildings, drifting cloud shadows, long low-sun shadows. The
south edge is water: the marina, where the last job ends.

## How to play

- **Move:** WASD / arrow keys (gamepad left stick works too). **Mouse** for
  menus and clicks.
- **Enter / exit / steal a car:** E (tries nearby cars, then farther ones).
- **Honk:** H. **Music on/off:** M. **Start a job:** keys 1–7.
- **Wanted level:** 0–5 stars. Cruisers chase you; at 4+ stars they PIT —
  a cruiser pulls alongside at matching speed and shoves your car sideways.
  At 3+ stars the PD sets roadblocks. Lose heat by staying clear of
  cruisers and the stars drop, one at a time.

## The seven jobs

| Job | Payout |
| --- | --- |
| m1 First Fare | $150 |
| m2 Hot Package | $300 |
| m3 Bay Getaway | $500 |
| m4 Dockside Debt | $420 |
| m5 The Last Ferry | $650 |
| m6 The Tower Job | $800 |
| m7 Marina Heist | $900 |

The Marina Heist is a three-stage run: reach the speedboat, hold 5 seconds
to fuel it while staying under 2 stars, lose the heat, then run for the pier.

## Screenshots

1. **Cover** — the plaza, its fountains, and the SOLMAR Tower under a low
   sun, HUD complete.
2. **Roam** — on foot by the avenue, traffic passing, pedestrians on the
   sidewalk.
3. **Mission** — First Fare in progress: the fare is in the car, one star
   on the tail, drop it at Solmar Tower.
4. **Chase** — four stars: three cruisers on the tail, a roadblock ahead.

## Run it

Open `game/index.html` in a desktop browser, or serve the folder:

```sh
node --experimental-strip-types serve.ts 8080
# then open http://127.0.0.1:8080/
```

## Build the dossier

```sh
node main.ts
# writes output/dossier.json (game/ + screenshots/ copied to output/)
```

Built by an AI agent for make.fun's "Make GTA 6" bounty, $1,666 in USDC.
