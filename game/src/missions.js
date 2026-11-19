// Solmar Bay — the crew's jobs: three stories, plus street fares for cash.
// One job: tell the player where to go, and pay them when they get there.

const DEFS = [
  {
    id: 'm1',
    title: 'First Fare',
    pay: 150,
    brief: 'A fare is waiting downtown. Pick them up, then drop them at the marina. Drive clean — the crew is watching.',
    steps: [
      { kind: 'reach', x: 1320, y: 700, label: 'Pick up the fare downtown', timer: 70 },
      { kind: 'reach', x: 2980, y: 1220, label: 'Drop the fare at Solmar Marina', timer: 80 },
    ],
  },
  {
    id: 'm2',
    title: 'Hot Package',
    pay: 300,
    brief: 'A package is stashed downtown. Grab it and run it to the East Docks — the PD will be on you the moment you touch it.',
    steps: [
      { kind: 'reach', x: 1320, y: 1220, label: 'Grab the package downtown', timer: 90 },
      { kind: 'reach', x: 2920, y: 1680, label: 'Deliver to the East Docks', timer: 100 },
    ],
  },
  {
    id: 'm3',
    title: 'Bay Getaway',
    pay: 500,
    brief: 'The whole department is coming. Lose them and reach the safehouse in the north-west before they box you in.',
    steps: [
      { kind: 'reach', x: 320, y: 300, label: 'Reach the safehouse', timer: 150 },
    ],
  },
];

export function createMissions(game) {
  const state = {
    done: [],
    current: null,
    defs: DEFS,
  };

  function nextAvailable() {
    return DEFS.find((d) => !state.done.includes(d.id)) || null;
  }

  function start(id) {
    const def = DEFS.find((d) => d.id === id);
    if (!def || state.current) return false;
    state.current = { def, step: 0, timer: 0 };
    if (id === 'm3') {
      game.wanted = 4;
      game.lastCrime = 'Bay Getaway';
      game.lastCrimeT = game.time;
    }
    game.message(`New job: ${def.title} — ${def.brief}`);
    game.sfx.pickup();
    return true;
  }

  function startTaxi() {
    if (state.current) return false;
    const def = {
      id: 'taxi',
      title: 'Street Fare',
      pay: 60,
      brief: 'A fare flagged you down. Pick them up downtown and drop them at the marina.',
      steps: [
        { kind: 'reach', x: 1320, y: 700, label: 'Pick up the fare downtown', timer: 90 },
        { kind: 'reach', x: 2980, y: 1220, label: 'Drop the fare at Solmar Marina', timer: 100 },
      ],
    };
    state.current = { def, step: 0, timer: 0 };
    game.message(`New job: ${def.title} — ${def.brief}`);
    game.sfx.pickup();
    return true;
  }

  function complete(m) {
    game.player.cash += m.def.pay;
    if (m.def.id !== 'taxi' && !state.done.includes(m.def.id)) state.done.push(m.def.id);
    game.message(`${m.def.title} done — $${m.def.pay} in your pocket.`, '#7ddc7d');
    game.sfx.cash();
    game.saveGame();
    state.current = null;
  }

  function fail(m, reason) {
    game.message(reason, '#ff5c5c');
    state.current = null;
  }

  function update(dt) {
    const m = state.current;
    if (!m) return;
    m.timer += dt;
    const step = m.def.steps[m.step];
    if (!step) return;
    if (step.kind === 'reach') {
      const d = Math.hypot(game.player.x - step.x, game.player.y - step.y);
      if (d < 70) {
        m.step += 1;
        m.timer = 0;
        if (m.def.id === 'm2' && m.step === 1) {
          game.wanted = Math.max(game.wanted, 2);
          game.lastCrime = 'Hot Package';
          game.lastCrimeT = game.time;
        }
        if (m.step >= m.def.steps.length) {
          complete(m);
        } else {
          game.message(`${m.def.title}: ${m.def.steps[m.step].label}.`);
        }
        return;
      }
    }
    if (step.timer !== undefined && m.timer > step.timer) {
      fail(m, 'Too slow — the job moved on without you.');
    }
  }

  return {
    done: state.done,
    get current() { return state.current; },
    set current(v) { state.current = v; },
    defs: DEFS,
    nextAvailable,
    start,
    startTaxi,
    update,
  };
}
