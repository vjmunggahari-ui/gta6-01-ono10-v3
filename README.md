# Solmar Bay — Make GTA 6

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/vjmunggahari-ui/gta6-01-ono10-v3/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/vjmunggahari-ui/gta6-01-ono10-v3/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

Solmar Bay is an open-world crime game: drive, steal cars, dodge the Solmar PD, and run five crew jobs across a sun-soaked 3200×2400 city — on foot or behind the wheel. Built for make.fun's [Make GTA 6 bounty](https://make.fun/bounty/gta6-01) ($1,666 in USDC). Every street, character, vehicle, name and note of music is original; nothing here comes from a commercial game.

## Run it

```sh
node serve.ts
```

Then open http://localhost:8080 in a desktop browser. No install, no network — the game is static files under `game/`.

| Key | Does |
| --- | --- |
| W A S D | Walk / drive |
| E | Steal a car / get out |
| F | Punch |
| M | Next job |
| Shift | Run |
| Space | Handbrake |
| Esc | Pause |
| H | Mute |

Progress saves on your machine. A gamepad works too.

## The city

Downtown towers, the beach, the marina and the East Docks, under a full day/night cycle. Traffic follows the roads, pedestrians walk the sidewalks, and the Solmar Tower landmark watches over it all. Crime raises your wanted level — one to five stars — and the Solmar PD answers with cruisers that chase, ram and box you in. Lose them, lay low, and the heat cools off; get busted and the active job fails.

## The jobs

Five crew jobs with a beginning, a middle and a payout — First Fare, Hot Package, Bay Getaway, Dockside Debt and The Last Ferry — plus street fares between jobs when you need quick cash. Each job has timed steps, a destination beacon on the minimap, and a fail state if the clock runs out, your ride is wrecked, or the PD takes you in. Finish a job well and the time bonus pays extra.

## Screenshots

The four images in `screenshots/` are real renders of this game's own code, posed by `game/src/shots.js` and captured at 1280×720 in a headless browser: the cover chase at noon, a morning roam on foot at the Old Town fountain square, The Tower Job at dusk, and the four-star Bay Getaway at night. Nothing is edited, composited or borrowed.

## Build it yourself

```sh
# Hand the entry in: copies game/ + screenshots/ to out/ and writes the dossier.
MAKEFUN_OUTPUT_DIR=out node main.ts
```

`main.ts` validates the entry first — screenshot count, size and pixel bounds, game file count and bytes, dossier size — then writes `out/dossier.json`. Run it twice and the dossier comes out byte-identical.

The source is split by job: `game/src/world.js` builds the city, `game/src/entities.js` owns cars, people and the wanted system, `game/src/missions.js` runs the jobs, `game/src/render.js` draws the city, cars, people, light and HUD, and `game/src/main.js` owns the game object and the loop. Everything under `game/` is plain static files.

## License

MIT — see [LICENSE](LICENSE).

---

<sub>Entered on [make.fun](https://make.fun/?utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>
