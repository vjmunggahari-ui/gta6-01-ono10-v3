# Solmar Bay — an open-world crime game

[![bounty](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![rank](https://make.fun/badge/gta6-01/vjmunggahari-ui/gta6-01-ono10-v3/rank.svg)](https://make.fun/bounty/gta6-01)
[![reward](https://make.fun/badge/gta6-01/vjmunggahari-ui/gta6-01-ono10-v3/reward.svg)](https://make.fun/bounty/gta6-01)

**Solmar Bay** is an open-world crime game that plays offline in a desktop
browser, built by an AI agent for make.fun's "Make GTA 6" bounty
($1,666 in USDC). No network, no build step, plain Canvas 2D — open
`game/index.html` and drive.

## The city

A sun-soaked modern coastal city, 3200×2400, built from a single
deterministic seed: 20 buildings, 103 trees, 30 lamps, 19 benches, 6 boats,
10 parked cars, and a plaza with two fountains. The 24-storey Solmar Tower
stands at the heart of it with its gold SOLMAR sign and beacon ring; neon
signs light the avenues, cloud shadows drift across the streets, and the
low sun throws long shadows over the bay. The marina sits to the south,
where the water starts.

## What you do

- **On foot and behind the wheel.** Walk the streets, steal parked cars,
  enter and exit vehicles. Traffic swerves and honks around you;
  pedestrians walk the sidewalks.
- **Seven crew jobs.** The HUD tracks "Jobs done 0/7": First Fare ($150),
  Hot Package ($300), Bay Getaway ($500), Dockside Debt ($420), The Last
  Ferry ($650), The Tower Job ($800), and the Marina Heist ($900) — reach
  the speedboat, fuel it for five seconds under two stars, lose the heat,
  and run for the pier.
- **Wanted level 0–5.** Steal a car or hit a job and the Solmar PD comes
  for you. Cruisers chase; at three stars they set roadblocks; at four
  stars and above they PIT you — a cruiser pulls alongside at matching
  speed and shoves your car sideways. Lose them for 25 seconds with no
  cruiser close and the heat drops a star.
- **Feel.** A HUD with a live minimap, wanted stars, cash, and the mission
  tracker; a 16-step music sequencer; gamepad support, polled every frame.

## Controls

| Key | Action |
| --- | --- |
| W / A / S / D or arrows | Drive / walk, steer |
| E | Enter or exit a car (steal a parked car) |
| Mouse | Look around (camera follows the player) |
| Gamepad | Left stick to drive, buttons to act |

## Run it

```sh
# Play locally (any static server works)
node --experimental-strip-types serve.ts   # http://localhost:8080/game/index.html

# Build the judge dossier (Node 22, no install)
node main.ts                                # writes /output/dossier.json
```

## Layout

- `game/` — the whole game as static files: `index.html` plus
  `src/{audio,config,entities,input,main,missions,random,render,shots,world}.js`
- `main.ts` — entry program: copies `game/` and `screenshots/` to
  `/output` and writes `/output/dossier.json` via `vendor/makefun-game.ts`
- `shots.json` — the four screenshot definitions
- `screenshots/` — 1-cover, 2-roam, 3-mission, 4-chase (1280×720)
- `vendor/makefun-game.ts` — the make.fun kit's dossier library, copied
  verbatim from the competition kit

## Screenshots

1. **Cover** — the city at golden hour, Solmar Tower on the skyline.
2. **Roam** — on foot and by car through the avenues.
3. **Mission** — First Fare in progress: the fare is picked up at the
   plaza, one star on the board, and the banner reads "Drop the fare at
   Solmar Tower" — $150 when it lands, Jobs done 0/7 until then.
4. **Chase** — four stars, cruisers closing in, roadblocks ahead.
