// Solmar Bay — missions: seven crew jobs.
// Each def carries its payout, a start point and a finish point. The
// missions API tracks the active job and the "Jobs done n/7" counter.
// m7 "Marina Heist" is a three-stage job: reach the speedboat at the
// marina, hold 5 s to fuel it while staying under 2 stars, lose the heat,
// then run for the pier.

import { TOWER, PLAZA } from './config.js';

export const MISSION_DEFS = [
  {
    id: 'm1', name: 'First Fare', payout: 150,
    brief: 'Pick up the fare at the plaza and drop them at Solmar Tower.',
    start: { x: PLAZA.x, y: PLAZA.y - 60 },
    finish: { x: TOWER.x, y: TOWER.y + 120 },
  },
  {
    id: 'm2', name: 'Hot Package', payout: 300,
    brief: 'Grab the package by the north docks and deliver it east, fast.',
    start: { x: 1350, y: 350 },
    finish: { x: 2850, y: 750 },
  },
  {
    id: 'm3', name: 'Bay Getaway', payout: 500,
    brief: 'Lose the tail: reach the south beach without a cruiser in sight.',
    start: { x: 850, y: 1150 },
    finish: { x: 1850, y: 2020 },
  },
  {
    id: 'm4', name: 'Dockside Debt', payout: 420,
    brief: 'Collect the debt at the west marina, then bring it to the plaza.',
    start: { x: 350, y: 1950 },
    finish: { x: PLAZA.x + 90, y: PLAZA.y },
  },
  {
    id: 'm5', name: 'The Last Ferry', payout: 650,
    brief: 'Catch the last ferry crew at the pier before they cast off.',
    start: { x: 2350, y: 350 },
    finish: { x: 2350, y: 2050 },
  },
  {
    id: 'm6', name: 'The Tower Job', payout: 800,
    brief: 'Lift the ledger from Solmar Tower and vanish to the east end.',
    start: { x: TOWER.x, y: TOWER.y },
    finish: { x: 2850, y: 1550 },
  },
  {
    id: 'm7', name: 'Marina Heist', payout: 900,
    brief: 'Reach the speedboat, fuel it for 5 s under 2 stars, lose the heat, run for the pier.',
    start: { x: 1850, y: 2040 },
    finish: { x: 2850, y: 2070 },
  },
];

const RADIUS = 70;

export function makeMissionsApi(state) {
  const api = {
    defs: MISSION_DEFS,
    active: null, // {def, stage, picked, fuel, fuelStart}
    done: new Set(),

    jobsDone() {
      return api.done.size;
    },

    startMission(id) {
      const def = MISSION_DEFS.find((d) => d.id === id);
      if (!def || api.done.has(id) || api.active) return null;
      api.active = { def, stage: 'pickup', picked: false, fuel: 0, fuelStart: 0 };
      return api.active;
    },

    cancelMission() {
      api.active = null;
    },

    // Advance the active job. Returns 'complete' when it pays out, or null.
    // now is seconds since the game started.
    update(dt, now) {
      const job = api.active;
      if (!job) return null;
      const p = state.player;
      const dist = (pt) => Math.hypot(p.x - pt.x, p.y - pt.y);

      if (job.def.id === 'm7') {
        // Stage 1: reach the speedboat.
        if (job.stage === 'pickup') {
          if (dist(job.def.start) < RADIUS) {
            job.stage = 'fuel';
            job.fuelStart = now;
          }
          return null;
        }
        // Stage 2: hold 5 s fueling while wanted stays under 2 stars.
        if (job.stage === 'fuel') {
          if (state.police.wanted >= 2) {
            job.fuel = 0;
            job.fuelStart = now;
            return null;
          }
          job.fuel = now - job.fuelStart;
          if (job.fuel >= 5) job.stage = 'escape';
          return null;
        }
        // Stage 3: lose the heat, then reach the pier.
        if (job.stage === 'escape') {
          if (state.police.wanted === 0 && dist(job.def.finish) < RADIUS) {
            return api.finish(job);
          }
          return null;
        }
        return null;
      }

      // Ordinary jobs: reach the pickup, then the drop-off.
      if (job.stage === 'pickup') {
        if (dist(job.def.start) < RADIUS) {
          job.stage = 'dropoff';
          job.picked = true;
        }
        return null;
      }
      if (job.stage === 'dropoff') {
        if (dist(job.def.finish) < RADIUS) return api.finish(job);
        return null;
      }
      return null;
    },

    finish(job) {
      api.done.add(job.def.id);
      state.cash += job.def.payout;
      const paid = { id: job.def.id, name: job.def.name, payout: job.def.payout };
      api.active = null;
      api.lastPaid = paid;
      return 'complete';
    },

    statusText() {
      const job = api.active;
      if (!job) return 'No job. Press 1-7 to take a job.';
      const d = job.def;
      if (d.id === 'm7') {
        if (job.stage === 'pickup') return 'Marina Heist: reach the speedboat.';
        if (job.stage === 'fuel') {
          return `Marina Heist: fueling ${Math.max(0, 5 - job.fuel).toFixed(1)}s — stay under 2 stars!`;
        }
        return 'Marina Heist: lose the heat, then reach the pier.';
      }
      if (job.stage === 'pickup') return `${d.name}: pick up at the marker.`;
      return `${d.name}: deliver to the marker.`;
    },
  };
  return api;
}
