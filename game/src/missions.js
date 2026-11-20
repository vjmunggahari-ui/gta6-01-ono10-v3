// Solmar Bay — the seven crew jobs. Exact payouts, event-driven.
// The API is pure: update(dt, snap) with snap { x, y, wanted, inCar } and
// it emits 'pickup' | 'boat' | 'fueled' | 'done' | 'failed'. main.js turns
// 'done' into cash. m7 (Marina Heist) fuels the speedboat only while the
// heat is under 2 stars, then the crew must lose all heat to finish.

export const MISSION_DEFS = [
  {
    id: 'm1',
    name: 'First Fare',
    payout: 150,
    kind: 'taxi',
    blurb: 'Pick up the fare at the plaza, drop them at Solmar Tower.',
    pickup: { x: 820, y: 990 },
    drop: { x: 1377, y: 978 },
  },
  {
    id: 'm2',
    name: 'Hot Package',
    payout: 300,
    kind: 'deliver',
    blurb: 'Grab the package at the docks, deliver it to the Tower.',
    pickup: { x: 350, y: 2050 },
    drop: { x: 1377, y: 978 },
  },
  {
    id: 'm3',
    name: 'Bay Getaway',
    payout: 500,
    kind: 'escape',
    blurb: 'Reach the east pier boat before the cops box you in.',
    target: { x: 2350, y: 2080 },
  },
  {
    id: 'm4',
    name: 'Dockside Debt',
    payout: 420,
    kind: 'collect',
    blurb: 'Collect from both dead-drops on the waterfront.',
    stops: [
      { x: 850, y: 1550 },
      { x: 1850, y: 750 },
    ],
  },
  {
    id: 'm5',
    name: 'The Last Ferry',
    payout: 650,
    kind: 'timed',
    blurb: 'Catch the last ferry at the marina. 75 seconds, no excuses.',
    target: { x: 2850, y: 2050 },
    limit: 75,
  },
  {
    id: 'm6',
    name: 'The Tower Job',
    payout: 800,
    kind: 'grab',
    blurb: 'Lift the case from the Tower, drop it at the north lot.',
    pickup: { x: 1377, y: 978 },
    drop: { x: 350, y: 350 },
  },
  {
    id: 'm7',
    name: 'Marina Heist',
    payout: 900,
    kind: 'heist',
    blurb: 'Reach the speedboat, fuel it 5s under 2 stars, lose the heat, run for the pier.',
    boat: { x: 2650, y: 2150 },
    pier: { x: 300, y: 2080 },
    fuelSeconds: 5,
  },
];

const REACH = 70; // px: close enough to count as "arrived"

function near(a, b, r = REACH) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy <= r * r;
}

export function makeMissionsApi() {
  const listeners = { pickup: [], boat: [], fueled: [], done: [], failed: [] };
  let active = null; // { def, stage, fuel, timer, stopIndex }
  const done = [];

  function on(evt, fn) {
    if (listeners[evt]) listeners[evt].push(fn);
  }

  function emit(evt, payload) {
    for (const fn of listeners[evt] ?? []) fn(payload);
  }

  function start(id) {
    const def = MISSION_DEFS.find((d) => d.id === id);
    if (!def) return false;
    if (done.includes(id)) return false;
    if (active) return false;
    active = { def, stage: 'go', fuel: 0, timer: 0, stopIndex: 0 };
    if (def.kind === 'heist') active.stage = 'reach';
    return true;
  }

  function finish() {
    const { def } = active;
    done.push(def.id);
    active = null;
    emit('done', { id: def.id, name: def.name, payout: def.payout });
  }

  function fail(reason) {
    const { def } = active;
    active = null;
    emit('failed', { id: def.id, name: def.name, reason });
  }

  // dt seconds; snap { x, y, wanted, inCar }.
  function update(dt, snap) {
    if (!active) return;
    const { def } = active;
    active.timer += dt;

    if (def.kind === 'timed' && active.timer > def.limit) {
      fail('out of time');
      return;
    }

    if (def.kind === 'taxi' || def.kind === 'deliver' || def.kind === 'grab') {
      if (active.stage === 'go' && near(snap, def.pickup)) {
        active.stage = 'drop';
        emit('pickup', { id: def.id, name: def.name });
      } else if (active.stage === 'drop' && near(snap, def.drop)) {
        finish();
      }
      return;
    }

    if (def.kind === 'escape') {
      if (near(snap, def.target)) finish();
      return;
    }

    if (def.kind === 'collect') {
      const stop = def.stops[active.stopIndex];
      if (stop && near(snap, stop)) {
        active.stopIndex += 1;
        emit('pickup', { id: def.id, name: def.name, stop: active.stopIndex });
        if (active.stopIndex >= def.stops.length) finish();
      }
      return;
    }

    if (def.kind === 'heist') {
      if (active.stage === 'reach') {
        if (near(snap, def.boat)) {
          active.stage = 'fuel';
          active.fuel = 0;
          emit('boat', { id: def.id, name: def.name });
        }
        return;
      }
      if (active.stage === 'fuel') {
        // Fuel only flows while the heat stays under 2 stars.
        if (snap.wanted < 2) active.fuel += dt;
        if (active.fuel >= def.fuelSeconds) {
          active.stage = 'flee';
          emit('fueled', { id: def.id, name: def.name });
        }
        return;
      }
      if (active.stage === 'flee') {
        // Must lose ALL heat before the pier counts.
        if (snap.wanted === 0 && near(snap, def.pier)) finish();
      }
    }
  }

  return {
    defs: MISSION_DEFS,
    done,
    on,
    start,
    update,
    get active() {
      return active;
    },
    get jobsDone() {
      return done.length;
    },
  };
}
