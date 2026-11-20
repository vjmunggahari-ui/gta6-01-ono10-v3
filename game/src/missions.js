// Solmar Bay — the seven crew jobs. Each definition carries its payout and
// its own objective steps; the tracker owns start / progress / completion
// and pays the player exactly once per job.
export const MISSION_DEFS = [
  {
    id: 'm1', name: 'First Fare', payout: 150,
    brief: 'Pick up the fare at the plaza and drop them at the tower.',
    steps: [
      { kind: 'goto', x: 820, y: 990, r: 60, text: 'Reach the plaza pickup' },
      { kind: 'goto', x: 1377, y: 978, r: 80, text: 'Drop the fare at Solmar Tower' },
    ],
  },
  {
    id: 'm2', name: 'Hot Package', payout: 300,
    brief: 'Grab the package from the docks and deliver it to the east garage.',
    steps: [
      { kind: 'goto', x: 350, y: 1950, r: 60, text: 'Collect the package at the docks' },
      { kind: 'goto', x: 2850, y: 750, r: 60, text: 'Deliver to the east garage' },
    ],
  },
  {
    id: 'm3', name: 'Bay Getaway', payout: 500,
    brief: 'Lose a 2-star tail, then reach the north bridge before the timer ends.',
    steps: [
      { kind: 'heat', max: 1, text: 'Drop your heat to 1 star or less' },
      { kind: 'goto', x: 1850, y: 350, r: 70, text: 'Reach the north bridge' },
    ],
  },
  {
    id: 'm4', name: 'Dockside Debt', payout: 420,
    brief: 'Collect from three debtors along the waterfront, then return to the plaza.',
    steps: [
      { kind: 'goto', x: 350, y: 1950, r: 60, text: 'Collect from debtor 1' },
      { kind: 'goto', x: 1350, y: 1950, r: 60, text: 'Collect from debtor 2' },
      { kind: 'goto', x: 2350, y: 1950, r: 60, text: 'Collect from debtor 3' },
      { kind: 'goto', x: 820, y: 990, r: 60, text: 'Return to the plaza' },
    ],
  },
  {
    id: 'm5', name: 'The Last Ferry', payout: 650,
    brief: 'Escort the ferry passenger to the pier before the boat leaves.',
    steps: [
      { kind: 'goto', x: 570, y: 990, r: 60, text: 'Meet the passenger at the west fountain' },
      { kind: 'goto', x: 1350, y: 2100, r: 80, text: 'Reach the ferry pier' },
    ],
  },
  {
    id: 'm6', name: 'The Tower Job', payout: 800,
    brief: 'Break into Solmar Tower, grab the ledger, and get out clean.',
    steps: [
      { kind: 'goto', x: 1377, y: 978, r: 80, text: 'Enter Solmar Tower' },
      { kind: 'wait', seconds: 6, text: 'Hold the office for 6s' },
      { kind: 'goto', x: 850, y: 750, r: 70, text: 'Escape to the getaway car' },
    ],
  },
  {
    id: 'm7', name: 'Marina Heist', payout: 900,
    brief: 'Reach the speedboat at the marina, fuel it for 5s under 2 stars, lose the heat, run for the pier.',
    steps: [
      { kind: 'goto', x: 1600, y: 2120, r: 70, text: 'Reach the speedboat at the marina' },
      { kind: 'fuel', seconds: 5, maxHeat: 1, text: 'Fuel the boat — hold 5s under 2 stars' },
      { kind: 'heat', max: 0, text: 'Lose all heat' },
      { kind: 'goto', x: 2850, y: 2100, r: 80, text: 'Run for the pier' },
    ],
  },
];

function dist(ax, ay, bx, by) {
  return Math.hypot(ax - bx, ay - by);
}

// The tracker: one active job at a time, step progress, exact payout once.
export function makeMissions(state) {
  const tracker = {
    defs: MISSION_DEFS,
    active: null,
    done: Object.create(null),
    banner: '',
    startMission(id) {
      const def = MISSION_DEFS.find((m) => m.id === id);
      if (!def || this.done[id] || (this.active && this.active.id === id)) return false;
      this.active = { id, def, step: 0, waitT: 0, fuelT: 0 };
      this.banner = `${def.name} — ${def.brief}`;
      return true;
    },
    jobsDone() {
      return Object.keys(this.done).length;
    },
    currentText() {
      if (!this.active) return 'No job active — press M for the next job';
      const step = this.active.def.steps[this.active.step];
      return step ? step.text : '';
    },
    // Advance the active job. `p` is the player {x,y}, `heat` the wanted
    // level, dt seconds. Returns the payout when a job completes, else 0.
    update(p, heat, dt) {
      if (!this.active) return 0;
      const job = this.active;
      const step = job.def.steps[job.step];
      if (!step) return 0;
      let advanced = false;
      if (step.kind === 'goto') {
        if (dist(p.x, p.y, step.x, step.y) <= step.r) advanced = true;
      } else if (step.kind === 'wait') {
        job.waitT += dt;
        if (job.waitT >= step.seconds) advanced = true;
      } else if (step.kind === 'fuel') {
        if (heat <= step.maxHeat) {
          job.fuelT += dt;
          if (job.fuelT >= step.seconds) advanced = true;
        } else {
          job.fuelT = 0;
        }
      } else if (step.kind === 'heat') {
        if (heat <= step.max) advanced = true;
      }
      if (!advanced) return 0;
      job.step += 1;
      job.waitT = 0;
      job.fuelT = 0;
      if (job.step >= job.def.steps.length) {
        const pay = job.def.payout;
        this.done[job.id] = true;
        this.banner = `${job.def.name} complete — $${pay} banked. Jobs done ${this.jobsDone()}/7`;
        this.active = null;
        return pay;
      }
      return 0;
    },
  };
  return tracker;
}
