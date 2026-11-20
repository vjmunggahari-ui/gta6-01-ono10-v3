// Solmar Bay (v6, Session B3) — the crew's jobs.
//
// This module tells the player where to go, pays them when they get
// there, and ends the job cleanly when they blow it. v6 (B3) keeps the
// six v5/v6 story beats and adds a seventh, "Marina Heist", built on
// the south-east corner the earlier jobs only passed through: the crew's
// speedboat is fueled and waiting at the marina, the harbour master
// called the PD, and the getaway runs to the pier. Same step kinds
// (reach / hold / lose), same pay and time-bonus rules, same public API.
//
// Layout: the story table first, then the fare generator, then one
// state machine (`createMissions`) that owns the active job. The HUD
// reads progress() and the game loop calls update(dt) every step.
// progress() also reports the job's pay, so the HUD can show the stake.

import { MISSIONS } from './config.js';
import { int, pick } from './random.js';
import { districtAt, pointInBuilding, randomRoadPoint } from './world.js';

// --- story definitions ------------------------------------------------------
// Steps run in order. `reach` = get within radius. `hold` = stay inside
// the radius for `holdSec` seconds (a pickup that takes time). `lose` =
// bring the wanted level under 1 star — the getaway step.
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
  {
    id: 'm6',
    title: 'The Tower Job',
    pay: 800,
    brief: 'The Solmar Tower rooftop safe holds the crew’s cut from the whole season. Crack it at the tower plaza under the gold SOLMAR sign — the PD watches that square — then lose the tail and vanish down the beach.',
    steps: [
      { kind: 'reach', x: 1070, y: 990, radius: 80, label: 'Reach the Solmar Tower plaza', timer: 120 },
      { kind: 'hold', x: 1070, y: 990, radius: 80, holdSec: 6, label: 'Crack the rooftop safe — stay in the plaza', timer: 150 },
      { kind: 'lose', label: 'Lose the heat — get under 1 star', timer: 150 },
      { kind: 'reach', x: 1200, y: 2280, radius: 80, label: 'Vanish down Solmar Beach', timer: 120 },
    ],
  },
  {
    id: 'm7',
    title: 'Marina Heist',
    pay: 900,
    brief: 'The crew’s speedboat is fueled and waiting at the marina — but the harbour master called the PD. Get aboard, gas her up while they close in, lose the tail and run for the pier.',
    steps: [
      { kind: 'reach', x: 2980, y: 1220, radius: 80, label: 'Reach the speedboat at the marina', timer: 120 },
      { kind: 'hold', x: 2980, y: 1220, radius: 80, holdSec: 5, label: 'Fuel the speedboat — stay at the marina', timer: 150 },
      { kind: 'lose', label: 'Lose the heat — get under 1 star', timer: 150 },
      { kind: 'reach', x: 2960, y: 2140, radius: 80, label: 'Run for the pier', timer: 120 },
    ],
  },
];

// Street fares: pickup and drop-off points drawn from named places plus
// random road points, so no two fares are ever the same run.
const FARE_STOPS = [
  { x: 1320, y: 760, label: 'Downtown' },
  { x: 2980, y: 1220, label: 'Solmar Marina' },
  { x: 2920, y: 1680, label: 'The Docks' },
  { x: 320, y: 1220, label: 'St. Anselm Hospital' },
  { x: 320, y: 300, label: "Jax's Safehouse" },
  { x: 1200, y: 2280, label: 'Solmar Beach' },
  { x: 1820, y: 760, label: 'Hillside' },
  { x: 820, y: 1680, label: 'Southside' },
  { x: 1070, y: 990, label: 'Solmar Tower Plaza' },
];

function pickFareSpot(game, avoid) {
  const rng = game.rng;
  for (let tries = 0; tries < 12; tries += 1) {
    let spot;
    if (rng() < 0.55) {
      spot = pick(rng, FARE_STOPS);
    } else {
      const p = randomRoadPoint(rng);
      const d = districtAt(p.x, p.y);
      spot = { x: Math.round(p.x), y: Math.round(p.y), label: d.name };
    }
    if (avoid && Math.hypot(spot.x - avoid.x, spot.y - avoid.y) < 500) continue;
    if (pointInBuilding(game.world, spot.x, spot.y)) continue;
    return spot;
  }
  return FARE_STOPS[0];
}

// --- the state machine ------------------------------------------------------

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

  // One handler per step kind; each returns true when the step is
  // complete this frame.
  const STEP_KINDS = {
    reach(m, step, dt) {
      const p = game.player;
      if (Math.hypot(p.x - step.x, p.y - step.y) < (step.radius || 70)) return true;
      return false;
    },
    hold(m, step, dt) {
      const p = game.player;
      if (Math.hypot(p.x - step.x, p.y - step.y) < (step.radius || 70)) {
        m.holdT += dt;
        return m.holdT >= (step.holdSec || 4);
      }
      m.holdT = Math.max(0, m.holdT - dt * 2);
      return false;
    },
    lose(m, step, dt) {
      return game.wanted < 1;
    },
  };

  // Entry effects: a step that needs heat already has it set when the
  // player walks in, and a `lose` step with no heat is done on entry.
  function applyEntryEffects(m) {
    const step = m.def.steps[m.step];
    if (!step) return;
    if (step.kind === 'lose' && game.wanted < 1) {
      nextStep(m);
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
    if (m.def.id === 'm6' && m.step === 1) {
      game.wanted = Math.max(game.wanted, 3);
      game.lastCrime = 'The Tower Job';
      game.lastCrimeT = game.time;
      game.message('The safe is open — and the whole square is watching!', '#ff8a5c');
    }
    if (m.def.id === 'm7' && m.step === 1) {
      game.wanted = Math.max(game.wanted, 2);
      game.lastCrime = 'Marina Heist';
      game.lastCrimeT = game.time;
      game.message('The marina is hot — fuel fast!', '#ff8a5c');
    }
  }

  function openStep(m) {
    const step = m.def.steps[m.step];
    if (!step) return;
    m.timer = 0;
    m.holdT = 0;
    applyEntryEffects(m);
  }

  function nextStep(m) {
    m.step += 1;
    if (m.step >= m.def.steps.length) {
      finishJob(m);
      return;
    }
    openStep(m);
  }

  function start(id) {
    const def = DEFS.find((d) => d.id === id);
    if (!def || state.current) return false;
    if (state.done.includes(def.id)) return false;
    state.current = { def, step: 0, timer: 0, holdT: 0, startedAt: game.time };
    game.message(`New job: ${def.title} — ${def.brief}`);
    game.sfx.pickup();
    openStep(state.current);
    return true;
  }

  function startTaxi() {
    if (state.current) return false;
    const rng = game.rng;
    const pickup = pickFareSpot(game, null);
    const drop = pickFareSpot(game, pickup);
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
    openStep(state.current);
    return true;
  }

  function finishJob(m) {
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

  function failJob(m, reason) {
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
    return {
      title: m.def.title,
      step: m.step + 1,
      steps: total,
      frac: total ? m.step / total : 1,
      label: step ? step.label : '',
      timer: step && step.timer !== undefined ? Math.max(0, step.timer - m.timer) : null,
      holdFrac: step && step.kind === 'hold' ? Math.min(1, m.holdT / step.holdSec) : null,
      pay: m.def.pay,
    };
  }

  function update(dt) {
    const m = state.current;
    if (!m) return;
    m.timer += dt;
    const step = m.def.steps[m.step];
    if (!step) return;
    const handler = STEP_KINDS[step.kind];
    if (handler && handler(m, step, dt)) {
      if (m.def.id === 'm2' && m.step === 0) {
        game.wanted = Math.max(game.wanted, 2);
        game.lastCrime = 'Hot Package';
        game.lastCrimeT = game.time;
        game.message('The package is hot — the PD is on you!', '#ff8a5c');
      }
      if (m.def.id === 'm4') {
        game.message(`Crate loaded — ${m.step + 1} of 3 in the truck.`, '#7ddc7d');
      }
      nextStep(m);
      return;
    }
    if (step.timer !== undefined && m.timer > step.timer) {
      failJob(m, 'too slow — the job moved on without you.');
      return;
    }
    // A delivery job fails if the player's car is wrecked mid-run.
    const p = game.player;
    if (!p.onFoot && p.car && p.car.wrecked && m.def.id !== 'taxi') {
      failJob(m, 'your ride is wrecked — the cargo is lost.');
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
