# Solmar Bay — Make GTA 6

[![make.fun](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![rank](https://make.fun/badge/gta6-01/rank/vjmunggahari-ui/gta6-01-ono10-v3.svg)](https://make.fun/bounty/gta6-01)
[![reward](https://make.fun/badge/gta6-01/reward/vjmunggahari-ui/gta6-01-ono10-v3.svg)](https://make.fun/bounty/gta6-01)

An open-city crime story set in Solmar Bay, built for make.fun's
[Make GTA 6 bounty](https://make.fun/bounty/gta6-01) ($1,666 in USDC).
Jax Marlowe owes the crew: work the jobs, dodge the Solmar PD, and own the
bay — on foot or behind the wheel. Every street, character, vehicle, name
and note of music is original; nothing here comes from a commercial game.

## Play

No install, no network — the game is static files. From the repo root:

```sh
node serve.ts
```

Then open http://localhost:8080 in a desktop browser.

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

A 3200×2400 open world with a day/night cycle: downtown towers, the beach,
the marina, the East Docks, traffic that follows the roads and pedestrians
on the sidewalks. Crime raises your wanted level — one to five stars — and
the Solmar PD answers with cruisers that chase, ram and box you in. Lose
them, lay low, and the heat cools off; get busted and the active job fails.

## The jobs

Five crew jobs with a beginning, a middle and a payout — First Fare, Hot
Package, Bay Getaway, Dockside Debt and The Last Ferry — plus street fares
between jobs when you need quick cash. Each job has timed steps, a
destination beacon on the minimap, and a fail state if the clock runs out,
your ride is wrecked, or the PD takes you in. Finish a job well and the
time bonus pays extra.

## Screenshots

The four images in `screenshots/` are real renders of this game's own code,
posed by `game/src/shots.js` and captured at 1280×720 in a headless browser:
the cover chase at noon, a morning roam on foot downtown, the Hot Package
run at dusk, and the four-star Bay Getaway at night. Nothing is edited,
composited or borrowed.

## Build it yourself

```sh
# Hand the entry in: copies game/ + screenshots/ to out/ and writes the dossier.
MAKEFUN_OUTPUT_DIR=out node main.ts
```

`main.ts` validates the entry first — screenshot count, size and pixel
bounds, game file count and bytes — then writes `out/dossier.json`. Run it
twice and the dossier comes out byte-identical.

The source is split by job: `game/src/world.js` builds the city,
`game/src/entities.js` owns cars, people and the wanted system,
`game/src/missions.js` runs the jobs, `game/src/render.js` draws the city,
cars, people, light and HUD, and `game/src/main.js` owns the game object
and the loop. Everything under `game/` is plain static files.

## License

MIT — see [LICENSE](LICENSE).
