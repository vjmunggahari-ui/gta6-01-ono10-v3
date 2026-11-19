// Solmar Bay (v5) — the crew's jobs: five story beats, street fares, and
// fail states that actually bite.
// One job: tell the player where to go, pay them when they get there, and
// end the job cleanly when they blow it.
//
// v5 vs v4: five story missions instead of three (two new beats close the
// arc — Dockside Debt and The Last Ferry), three step kinds instead of one
// (reach / hold / lose-the-heat), a time bonus on clean finishes, fail
// reasons the player can learn from, randomized street fares drawn from the
// seeded stream, and an explicit abort + progress API for the HUD.

import { MISSIONS } from './config.js';
import { int, pick } from './random.js';
import { districtAt, pointInBuilding, randomRoadPoint } from './world.js';

// --- story definitions ------------------------------------------------------
// Steps run in order. `reach` = get within radius. `hold` = stay inside the
// radius for `holdSec` seconds (a pickup that takes time). `lose` = bring
// the wanted level under 1 star — the getaway step. `onStep` fires once
// when a step is entered; `onReach` fires once when it completes.
export const DEFS = [
  {
    id: 'm1',
    title: 'First Fare',
    pay: 150,
    brief: 'A fare is waiting downtown. Pick them up, then drop them at the marina. Drive clean — the crew is watching.',
    steps: [
      { kind: 'reach', x: 1320, y: 700, radius: 70, label: 'Pick up the fare downtown', timer: 70 },
      { kind: 'reach', x: 2980, y: 1220, radius: 70, label: 'Drop the fare at Solmar Marina', timer: 90 },
    ],
  },
  {
    id: 'm2',
    title: 'Hot Package',
    pay: 300,
    brief: 'A package is stashed downtown. Grab it and run it to the East Docks — the PD will be on you the moment you touch it.',
    steps: [
      { kind: 'reach', x: 1320, y: 1220, radius: 70, label: 'Grab the package downtown', timer: 90 },
      { kind: 'reach', x: 2920, y: 1680, radius: 70, label: 'Deliver to the East Docks', timer: 110 },
    ],
  },
  {
    id: 'm3',
    title: 'Bay Getaway',
    pay: 500,
    brief: 'The whole department is coming. Shake them, then reach the safehouse in the north-west before they box you in.',
    steps: [
      { kind: 'lose', label: 'Lose the heat — get under 1 star', timer: 150 },
      { kind: 'reach', x: 320, y: 300, radius: 80, label: 'Reach the safehouse', timer: 120 },
    ],
  },
  {
    id: 'm4',
    title: 'Dockside Debt',
    pay: 420,
    brief: 'Three crates on the docks belong to the crew. Load them one by one — linger at each crate while the boys stack it — then run them to the marina.',
    steps: [
      { kind: 'hold', x: 2520, y: 1420, radius: 70, holdSec: 4, label: 'Load crate 1 of 3 at the docks', timer: 100 },
      { kind: 'hold', x: 2620, y: 1760, radius: 70, holdSec: 4, label: 'Load crate 2 of 3 at the docks', timer: 100 },
      { kind: 'hold', x: 2440, y: 1960, radius: 70, holdSec: 4, label: 'Load crate 3 of 3 at the docks', timer: 100 },
      { kind: 'reach', x: 2980, y: 1220, radius: 70, label: 'Deliver the crates to the marina', timer: 120 },
    ],
  },
  {
    id: 'm5',
    title: 'The Last Ferry',
    pay: 650,
    brief: 'The ferry leaves the pier at dawn and the crew needs one last passenger on it. Cut through the beachfront, lose the tail, and make the pier.',
    steps: [
      { kind: 'reach', x: 1200, y: 2280, radius: 80, label: 'Cut across Solmar Beach', timer: 120 },
      { kind: 'lose', label: 'Lose the heat before the pier', timer: 150 },
      { kind: 'reach', x: 2960, y: 2140, radius: 80, label: 'Reach the pier before the ferry leaves', timer: 120 },
    ],
  },
];

// Street fares: pickup and drop-off points drawn from named places plus
// random road points, so no two fares are ever the same run.
const FARE_SPOTS = [
  { x: 1320, y: 760, label: 'Downtown' },
  { x: 2980, y: 1220, label: 'Solmar Marina' },
  { x: 2920, y: 1680, label: 'The Docks' },
  { x: 320, y: 1220, label: 'St. Anselm Hospital' },
  { x: 320, y: 300, label: "Jax's Safehouse" },
  { x: 1200, y: 2280, label: 'Solmar Beach' },
  { x: 1820, y: 760, label: 'Hillside' },
  { x: 820, y: 1680, label: 'Southside' },
];

function fareSpot(game, avoid) {
  const rng = game.rng;
  for (let tries = 0; tries < 12; tries += 1) {
    let spot;
    if (rng() < 0.55) {
      spot = pick(rng, FARE_SPOTS);
    } else {
      const p = randomRoadPoint(rng);
      const d = districtAt(p.x, p.y);
      spot = { x: Math.round(p.x), y: Math.round(p.y), label: d.name };
    }
    if (avoid && Math.hypot(spot.x - avoid.x, spot.y - avoid.y) < 500) continue;
    if (pointInBuilding(game.world, spot.x, spot.y)) continue;
    return spot;
  }
  return FARE_SPOTS[0];
}

// --- runtime ----------------------------------------------------------------

export function createMissions(game) {
  const state = {
    done: [],
    current: null,
    defs: DEFS,
    earned: 0,
  };

  function nextAvailable() {
    return DEFS.find((d) => !state.done.includes(d.id)) || null;
  }

  function storyDone() {
    return state.done.length >= DEFS.length;
  }

  function enterStep(m) {
    const step = m.def.steps[m.step];
    if (!step) return;
    m.timer = 0;
    m.holdT = 0;
    if (step.kind === 'lose' && game.wanted < 1) {
      // No heat to lose: the step is already satisfied on entry.
      advance(m);
      return;
    }
    game.message(`${m.def.title}: ${step.label}.`);
    if (m.def.id === 'm3' && m.step === 0) {
      game.wanted = Math.max(game.wanted, 4);
      game.lastCrime = 'Bay Getaway';
      game.lastCrimeT = game.time;
    }
    if (m.def.id === 'm5' && m.step === 1) {
      game.wanted = Math.max(game.wanted, 2);
      game.lastCrime = 'The Last Ferry';
      game.lastCrimeT = game.time;
    }
  }

  function advance(m) {
    m.step += 1;
    if (m.step >= m.def.steps.length) {
      complete(m);
      return;
    }
    enterStep(m);
  }

  function start(id) {
    const def = DEFS.find((d) => d.id === id);
    if (!def || state.current) return false;
    if (state.done.includes(def.id)) return false;
    state.current = { def, step: 0, timer: 0, holdT: 0, startedAt: game.time };
    game.message(`New job: ${def.title} — ${def.brief}`);
    game.sfx.pickup();
    enterStep(state.current);
    return true;
  }

  function startTaxi() {
    if (state.current) return false;
    const rng = game.rng;
    const pickup = fareSpot(game, null);
    const drop = fareSpot(game, pickup);
    const pay = int(rng, MISSIONS.farePayMin, MISSIONS.farePayMax);
    const def = {
      id: 'taxi',
      title: 'Street Fare',
      pay,
      brief: `A fare flagged you down at ${pickup.label}. Drop them at ${drop.label}.`,
      steps: [
        { kind: 'reach', x: pickup.x, y: pickup.y, radius: 70, label: `Pick up the fare at ${pickup.label}`, timer: MISSIONS.fareTimeoutSec },
        { kind: 'reach', x: drop.x, y: drop.y, radius: 70, label: `Drop the fare at ${drop.label}`, timer: MISSIONS.fareTimeoutSec + 30 },
      ],
    };
    state.current = { def, step: 0, timer: 0, holdT: 0, startedAt: game.time };
    game.message(`New job: Street Fare — ${def.brief}`);
    game.sfx.pickup();
    enterStep(state.current);
    return true;
  }

  function complete(m) {
    // A clean finish pays a time bonus: a second left on the clock is a
    // dollar in the pocket, capped so a sprint never doubles the job.
    const step = m.def.steps[m.step - 1] || m.def.steps[0];
    const left = step && step.timer !== undefined ? Math.max(0, step.timer - m.timer) : 0;
    const bonus = m.def.id === 'taxi' ? 0 : Math.min(100, Math.floor(left));
    const total = m.def.pay + bonus;
    game.player.cash += total;
    state.earned += total;
    if (m.def.id !== 'taxi' && !state.done.includes(m.def.id)) state.done.push(m.def.id);
    game.message(
      `${m.def.title} done — $${total} in your pocket${bonus ? ` ($${m.def.pay} + $${bonus} time bonus)` : ''}.`,
      '#7ddc7d',
    );
    game.sfx.cash();
    if (storyDone()) {
      game.message('Every crew job is done. Solmar Bay is yours, Jax.', '#ffd23f');
    }
    state.current = null;
    game.saveGame();
  }

  function fail(m, reason) {
    game.message(`${m.def.title} failed — ${reason}`, '#ff5c5c');
    game.sfx.busted();
    state.current = null;
  }

  function abort() {
    if (!state.current) return false;
    game.message(`${state.current.def.title} abandoned.`, '#ffb02e');
    state.current = null;
    return true;
  }

  // Progress for the HUD: 0..1 through the current job, plus the live step.
  function progress() {
    const m = state.current;
    if (!m) return null;
    const step = m.def.steps[m.step];
    const total = m.def.steps.length;
    const frac = total ? m.step / total : 1;
    return {
      title: m.def.title,
      step: m.step + 1,
      steps: total,
      frac,
      label: step ? step.label : '',
      timer: step && step.timer !== undefined ? Math.max(0, step.timer - m.timer) : null,
      holdFrac: step && step.kind === 'hold' ? Math.min(1, m.holdT / step.holdSec) : null,
    };
  }

  function update(dt) {
    const m = state.current;
    if (!m) return;
    m.timer += dt;
    const step = m.def.steps[m.step];
    if (!step) return;
    const p = game.player;
    const dist = (x, y) => Math.hypot(p.x - x, p.y - y);
    if (step.kind === 'reach') {
      if (dist(step.x, step.y) < (step.radius || 70)) {
        if (m.def.id === 'm2' && m.step === 0) {
          game.wanted = Math.max(game.wanted, 2);
          game.lastCrime = 'Hot Package';
          game.lastCrimeT = game.time;
          game.message('The package is hot — the PD is on you!', '#ff8a5c');
        }
        if (m.def.id === 'm4') {
          game.message(`Crate loaded — ${m.step + 1} of 3 in the truck.`, '#7ddc7d');
        }
        advance(m);
        return;
      }
    } else if (step.kind === 'hold') {
      if (dist(step.x, step.y) < (step.radius || 70)) {
        m.holdT += dt;
        if (m.holdT >= (step.holdSec || 4)) {
          game.message(`Crate ${m.step + 1} of 3 loaded.`, '#7ddc7d');
          advance(m);
          return;
        }
      } else {
        m.holdT = Math.max(0, m.holdT - dt * 2);
      }
    } else if (step.kind === 'lose') {
      if (game.wanted < 1) {
        game.message('Heat is off. Move.', '#7ddc7d');
        advance(m);
        return;
      }
    }
    if (step.timer !== undefined && m.timer > step.timer) {
      fail(m, 'too slow — the job moved on without you.');
      return;
    }
    // A delivery job fails if the player's car is wrecked mid-run.
    if (!p.onFoot && p.car && p.car.wrecked && m.def.id !== 'taxi') {
      fail(m, 'your ride is wrecked — the cargo is lost.');
    }
  }

  // Called by the game when the player is busted: the job is blown.
  function onBusted() {
    if (!state.current) return;
    game.message(`${state.current.def.title} failed — busted by the Solmar PD.`, '#ff5c5c');
    state.current = null;
  }

  return {
    done: state.done,
    get current() { return state.current; },
    set current(v) { state.current = v; },
    get earned() { return state.earned; },
    defs: DEFS,
    nextAvailable,
    storyDone,
    start,
    startTaxi,
    abort,
    progress,
    onBusted,
    update,
  };
}
