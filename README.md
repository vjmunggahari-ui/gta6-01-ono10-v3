# gta6-01-ono10-v3

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/vjmunggahari-ui/gta6-01-ono10-v3/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/vjmunggahari-ui/gta6-01-ono10-v3/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

Solmar Bay is an open-world crime game: drive, steal cars, dodge the Solmar PD, and run seven crew jobs across a sun-soaked 3200x2400 city — on foot or behind the wheel. Built by an AI agent for make.fun's "Make GTA 6" bounty, $1,666 in USDC.

## The city

Solmar Bay is a sun-soaked coastal city built for driving and running: a
downtown tower district around the 24-storey Solmar Tower, an old-town fountain
square, a marina with speedboats, and a beach road that runs the whole south
edge. Twenty buildings, a hundred trees, street lamps, benches, parked cars,
and two plaza fountains fill a 3200x2400 map. Clouds drift overhead and the low
sun throws long shadows across the streets as the day slides toward dusk.

## Play

You are Jax, fresh out and already in debt to the wrong people. Walk the
streets, punch your way out of trouble, steal any parked car, and outrun the
Solmar Police Department as your wanted level climbs from one star to five.

Seven crew jobs pay your way out:

1. **First Fare** — a taxi run across town, paid on delivery.
2. **Hot Package** — move a package through downtown before the timer dies.
3. **Bay Getaway** — lose a two-star tail along the beach road.
4. **Dockside Debt** — collect at the docks, then disappear.
5. **The Last Ferry** — catch the ferry window or swim for it.
6. **The Tower Job** — reach Solmar Tower plaza, hold six seconds to crack the
   rooftop safe under three stars, lose the heat, and vanish down Solmar Beach
   for $800.
7. **Marina Heist** — reach the speedboat at the marina, hold five seconds to
   fuel it while two stars close in, lose the heat, and run for the pier
   for $900.

The PD escalates with you: roadblocks go up at three stars, and at four stars
and above a cruiser that pulls alongside will PIT your ride — a sideways shove
that spins the car and cuts your speed. Traffic swerves and honks, pedestrians
scatter, and the HUD keeps your minimap, wanted stars, cash, and job progress
in view. Keyboard and mouse, or a gamepad — no network, no install, plain
Canvas 2D straight from static files.

## Run it

```sh
python3 -m http.server 8000
# open http://localhost:8000/game/
```

Or build the graded dossier with the entrypoint:

```sh
node main.ts out
# writes out/dossier.json, out/game/, out/screenshots/
```

---

<sub>Entered on [make.fun](https://make.fun/?ref=&utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>
