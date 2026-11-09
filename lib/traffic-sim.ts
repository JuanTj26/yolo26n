export type Car = {
  id: number;
  lane: number;
  s: number;
  speed: number;
  color: number;
  targetSpeed: number;
};

/** Pedestrian walking across or waiting at a crosswalk.
 *  crosswalk: 0=North, 1=East, 2=South, 3=West
 *  t: 0..1 progress across the crossing (0=start curb, 1=destination curb)
 *  side: -1 = walks negative to positive, +1 = walks positive to negative
 */
export type Pedestrian = {
  id: number;
  crosswalk: number;  // 0=N, 1=E, 2=S, 3=W
  t: number;          // 0..1
  side: -1 | 1;
  color: number;
  waiting: boolean;   // true = waiting at sidewalk curb
  speed: number;      // progress per second
};

export type Sim = {
  cars: Car[];
  nextId: number;
  green: "NS" | "EW";
  yellow: boolean;
  allRed: boolean;
  yellowTimer: number;
  allRedTimer: number;
  greenTimer: number;
  mode: "fixed" | "jam" | "adaptive";
  detected: number;
  passed: number;
  spawnTimer: number[];
  // Pedestrian state
  pedestrians: Pedestrian[];
  pedestrianGreenNS: boolean; // walk signal for crosswalks 0 & 2 (crossing NS road)
  pedestrianGreenEW: boolean; // walk signal for crosswalks 1 & 3 (crossing EW road)
  pedestrianNextId: number;
};

export const START = 55;
export const STOP = 10.0; // Stop line position: car center at 10.0 => front bumper at 7.9, cleanly before zebra at 6.4

export const LANES: [number, number][] = [
  [0, -1],  // 0: South-bound (from +z to -z, x=+2.0)
  [-1, 0],  // 1: West-bound (from +x to -x, z=-2.0)
  [0, 1],   // 2: North-bound (from -z to +z, x=-2.0)
  [1, 0],   // 3: East-bound (from -x to +x, z=+2.0)
];

export const PEDESTRIAN_COLORS = [
  "#e0533c", // Terracotta
  "#3b82f6", // Denim blue
  "#10b981", // Emerald green
  "#f59e0b", // Amber mustard
  "#8b5cf6", // Purple violet
  "#ec4899", // Rose
  "#e2e8f0", // Clean light slate
  "#1e293b", // Navy charcoal
];

export function axisOf(lane: number): "NS" | "EW" {
  return lane === 0 || lane === 2 ? "NS" : "EW";
}

export function queueLen(sim: Sim, lane: number): number {
  return sim.cars.filter(
    (c) => c.lane === lane && c.s >= STOP - 0.5 && c.s <= STOP + 35 && c.speed < 2.0
  ).length;
}

export function lanePose(lane: number, s: number): { x: number; z: number; rot: number } {
  switch (lane) {
    case 0:
      // South-bound (heading towards -z)
      return { x: 2.0, z: s, rot: Math.PI };
    case 1:
      // West-bound (heading towards -x)
      return { x: s, z: -2.0, rot: -Math.PI / 2 };
    case 2:
      // North-bound (heading towards +z)
      return { x: -2.0, z: -s, rot: 0 };
    case 3:
      // East-bound (heading towards +x)
      return { x: -s, z: 2.0, rot: Math.PI / 2 };
    default:
      return { x: 0, z: 0, rot: 0 };
  }
}

/**
 * Returns world-space [x, z] position and facing rotation (rot) of a pedestrian.
 * Crosswalks are centered at ±6.4 (matching the road zebra stripes).
 * Sidewalk curbs are at ±5.6.
 * t = 0 => pedestrian stands on start curb (sidewalk)
 * t = 1 => pedestrian arrives at destination curb (sidewalk)
 */
export function pedestrianPose(
  ped: Pedestrian
): { x: number; z: number; rot: number } {
  const { crosswalk, t, side } = ped;
  // span from -5.6 to +5.6
  const curb = 5.6;
  const posAcross = side < 0 ? -curb + t * (curb * 2) : curb - t * (curb * 2);

  switch (crosswalk) {
    case 0: // North crosswalk (z = +6.4, spans X from curb to curb)
      return {
        x: posAcross,
        z: 6.4,
        rot: side < 0 ? Math.PI / 2 : -Math.PI / 2,
      };
    case 1: // East crosswalk (x = +6.4, spans Z from curb to curb)
      return {
        x: 6.4,
        z: posAcross,
        rot: side < 0 ? 0 : Math.PI,
      };
    case 2: // South crosswalk (z = -6.4, spans X from curb to curb)
      return {
        x: -posAcross,
        z: -6.4,
        rot: side < 0 ? -Math.PI / 2 : Math.PI / 2,
      };
    case 3: // West crosswalk (x = -6.4, spans Z from curb to curb)
      return {
        x: -6.4,
        z: -posAcross,
        rot: side < 0 ? Math.PI : 0,
      };
    default:
      return { x: 0, z: 0, rot: 0 };
  }
}

export function createSim(): Sim {
  const sim: Sim = {
    cars: [],
    nextId: 1,
    green: "NS",
    yellow: false,
    allRed: false,
    yellowTimer: 0,
    allRedTimer: 0,
    greenTimer: 0,
    mode: "adaptive",
    detected: 540,
    passed: 480,
    spawnTimer: [0, 0, 0, 0],
    pedestrians: [],
    pedestrianGreenNS: false,
    pedestrianGreenEW: true,
    pedestrianNextId: 1,
  };

  // Pre-populate lanes with safely spaced cars
  const initialDistances = [
    [10.2, 16.2, 22.4, 28.6, 35.5],
    [10.2, 16.5, 23.0, 30.5, 41.0],
    [10.2, 16.4, 23.2, 32.0],
    [10.2, 16.6, 23.5, 33.5],
  ];

  for (let l = 0; l < 4; l++) {
    for (const dist of initialDistances[l] || []) {
      sim.cars.push({
        id: sim.nextId++,
        lane: l,
        s: dist,
        speed: 0,
        color: Math.floor(Math.random() * 8),
        targetSpeed: 8 + Math.random() * 3,
      });
      sim.detected++;
    }
  }

  // Pre-populate some pedestrians waiting at the curbs
  const initialPeds: [number, -1 | 1, number][] = [
    [1, -1, 0], // EW crosswalk (starts walking since EW pedestrian signal is green!)
    [1, 1, 0.4],
    [3, 1, 0.2],
    [0, -1, 0], // NS crosswalk (waiting at curb)
    [2, 1, 0],  // NS crosswalk (waiting at curb)
  ];

  for (const [cw, side, t] of initialPeds) {
    const isGreen = cw === 1 || cw === 3;
    sim.pedestrians.push({
      id: sim.pedestrianNextId++,
      crosswalk: cw,
      t: isGreen ? t : 0,
      side: side as -1 | 1,
      color: Math.floor(Math.random() * PEDESTRIAN_COLORS.length),
      waiting: !isGreen,
      speed: 0.07 + Math.random() * 0.03,
    });
  }

  return sim;
}

export function step(sim: Sim, delta: number): void {
  const dt = Math.min(delta, 0.08);

  // ───────────────────────────────────────────────────────────
  // 1. Traffic light controller: Green -> Yellow -> All-Red -> Next Green
  // ───────────────────────────────────────────────────────────
  sim.greenTimer += dt;

  if (sim.allRed) {
    sim.allRedTimer += dt;
    // All-Red clearance interval (1.8s) allows cars in intersection to fully clear
    if (sim.allRedTimer >= 1.8) {
      sim.allRed = false;
      sim.allRedTimer = 0;
      sim.greenTimer = 0;
      sim.green = sim.green === "NS" ? "EW" : "NS";
    }
  } else if (sim.yellow) {
    sim.yellowTimer += dt;
    if (sim.yellowTimer >= 2.5) {
      sim.yellow = false;
      sim.yellowTimer = 0;
      sim.allRed = true; // Enter all-red clearance phase
      sim.allRedTimer = 0;
    }
  } else {
    // Green phase timing
    let switchNeeded = false;
    if (sim.mode === "adaptive") {
      const qNS = queueLen(sim, 0) + queueLen(sim, 2);
      const qEW = queueLen(sim, 1) + queueLen(sim, 3);
      const currentQ = sim.green === "NS" ? qNS : qEW;
      const otherQ = sim.green === "NS" ? qEW : qNS;

      // Pedestrians waiting at red crossing also influence switch!
      const pedsWaitingCurrentAxis = sim.pedestrians.filter(
        (p) => p.waiting && (sim.green === "NS" ? p.crosswalk === 0 || p.crosswalk === 2 : p.crosswalk === 1 || p.crosswalk === 3)
      ).length;

      if (sim.greenTimer >= 18) {
        switchNeeded = true;
      } else if (sim.greenTimer >= 8 && (otherQ > currentQ + 1 || pedsWaitingCurrentAxis >= 2)) {
        switchNeeded = true;
      }
    } else if (sim.mode === "jam") {
      if (sim.green === "NS" && sim.greenTimer >= 24) switchNeeded = true;
      if (sim.green === "EW" && sim.greenTimer >= 6) switchNeeded = true;
    } else {
      if (sim.greenTimer >= 13) switchNeeded = true;
    }

    if (switchNeeded) {
      sim.yellow = true;
      sim.yellowTimer = 0;
    }
  }

  // ───────────────────────────────────────────────────────────
  // 2. Pedestrian walk signals (synchronized with vehicle signals)
  // ───────────────────────────────────────────────────────────
  // Crosswalks 0 & 2 cross NS road: WALK only when NS vehicles have RED (and not changing)
  sim.pedestrianGreenNS = sim.green === "EW" && !sim.yellow && !sim.allRed;
  // Crosswalks 1 & 3 cross EW road: WALK only when EW vehicles have RED (and not changing)
  sim.pedestrianGreenEW = sim.green === "NS" && !sim.yellow && !sim.allRed;

  // ───────────────────────────────────────────────────────────
  // 3. Pedestrian spawning and movement
  // ───────────────────────────────────────────────────────────
  const MAX_PEDESTRIANS = 14;
  if (sim.pedestrians.length < MAX_PEDESTRIANS && Math.random() < dt * 0.7) {
    const crosswalk = Math.floor(Math.random() * 4) as 0 | 1 | 2 | 3;
    const side = (Math.random() < 0.5 ? -1 : 1) as -1 | 1;
    // Only spawn if no one is already waiting at this specific curb
    const alreadyAtCurb = sim.pedestrians.some(
      (p) => p.crosswalk === crosswalk && p.side === side && p.waiting
    );
    if (!alreadyAtCurb) {
      const isGreenNow = crosswalk === 0 || crosswalk === 2 ? sim.pedestrianGreenNS : sim.pedestrianGreenEW;
      sim.pedestrians.push({
        id: sim.pedestrianNextId++,
        crosswalk,
        t: 0,
        side,
        color: Math.floor(Math.random() * PEDESTRIAN_COLORS.length),
        waiting: !isGreenNow,
        speed: 0.08 + Math.random() * 0.035, // walks across in ~10-12 seconds
      });
    }
  }

  // Update pedestrians
  const activePeds: Pedestrian[] = [];
  for (const ped of sim.pedestrians) {
    const isWalkSignalGreen =
      ped.crosswalk === 0 || ped.crosswalk === 2 ? sim.pedestrianGreenNS : sim.pedestrianGreenEW;

    if (ped.waiting) {
      // Start walking when pedestrian walk signal turns green
      if (isWalkSignalGreen) {
        ped.waiting = false;
      }
      activePeds.push(ped);
    } else {
      // Walking across the street
      ped.t += ped.speed * dt;
      if (ped.t < 1.0) {
        activePeds.push(ped);
      }
      // Reach destination curb -> pedestrian safely departs
    }
  }
  sim.pedestrians = activePeds;

  // ───────────────────────────────────────────────────────────
  // 4. Vehicle spawning per lane (safe distance check)
  // ───────────────────────────────────────────────────────────
  for (let l = 0; l < 4; l++) {
    sim.spawnTimer[l] = (sim.spawnTimer[l] || 0) + dt;
    const laneCars = sim.cars.filter((c) => c.lane === l);
    const closestToSpawn = laneCars.reduce((maxS, c) => (c.s > maxS ? c.s : maxS), 0);

    const spawnInterval = sim.mode === "jam" && (l === 1 || l === 3) ? 1.5 : 2.4 + (l % 2) * 0.5;
    if (sim.spawnTimer[l]! >= spawnInterval && closestToSpawn < START - 8.0) {
      sim.spawnTimer[l] = 0;
      if (sim.cars.length < 44) {
        sim.cars.push({
          id: sim.nextId++,
          lane: l,
          s: START,
          speed: 6.5 + Math.random() * 2,
          color: Math.floor(Math.random() * 8),
          targetSpeed: 8 + Math.random() * 2.5,
        });
        sim.detected++;
      }
    }
  }

  // ───────────────────────────────────────────────────────────
  // 5. Vehicle physics & collision avoidance
  // ───────────────────────────────────────────────────────────
  // Check which cars are currently inside the central intersection box (|s| < 9.5)
  const carsInIntersection = sim.cars.filter((c) => c.s > -9.5 && c.s < 9.5);
  const nsInIntersection = carsInIntersection.some((c) => axisOf(c.lane) === "NS");
  const ewInIntersection = carsInIntersection.some((c) => axisOf(c.lane) === "EW");

  for (let l = 0; l < 4; l++) {
    const laneCars = sim.cars
      .filter((c) => c.lane === l)
      .sort((a, b) => a.s - b.s); // Front cars have smaller s (heading towards -START)

    const isMyAxis = sim.green === axisOf(l);
    const isLightGreen = isMyAxis && !sim.yellow && !sim.allRed;
    const isLightYellow = isMyAxis && sim.yellow;
    const conflictingAxisCarsInIntersection = axisOf(l) === "NS" ? ewInIntersection : nsInIntersection;

    // Check pedestrians crossing in this lane's path
    // Lane 0: x=2.0 (crosswalk 0 at z=6.4, crosswalk 2 at z=-6.4)
    // Lane 1: z=-2.0 (crosswalk 1 at x=6.4, crosswalk 3 at x=-6.4)
    // Lane 2: x=-2.0
    // Lane 3: z=2.0
    const pedInEntryPath = sim.pedestrians.some((p) => {
      if (p.waiting || p.t <= 0.05 || p.t >= 0.95) return false;
      const pose = pedestrianPose(p);
      if (l === 0) return p.crosswalk === 0 && Math.abs(pose.x - 2.0) < 2.5;
      if (l === 1) return p.crosswalk === 1 && Math.abs(pose.z - (-2.0)) < 2.5;
      if (l === 2) return p.crosswalk === 2 && Math.abs(pose.x - (-2.0)) < 2.5;
      if (l === 3) return p.crosswalk === 3 && Math.abs(pose.z - 2.0) < 2.5;
      return false;
    });

    for (let i = 0; i < laneCars.length; i++) {
      const car = laneCars[i]!;
      const lead = i > 0 ? laneCars[i - 1]! : null;

      // Determine target stop line / reason to stop
      let stopTarget = -START - 10;
      let mustStopAtIntersection = false;

      // 1. Red / All-Red / Yellow light
      if (!isLightGreen) {
        if (isLightYellow) {
          // Dilemma zone: if too close and fast to stop safely, clear the intersection
          if (car.s > STOP + 2.0) {
            mustStopAtIntersection = true;
          }
        } else {
          // Red or All-Red: must stop at stop line
          mustStopAtIntersection = true;
        }
      }

      // 2. Intersection conflict lock: NEVER enter if perpendicular cars are inside
      if (conflictingAxisCarsInIntersection && car.s >= STOP - 0.5) {
        mustStopAtIntersection = true;
      }

      // 3. Pedestrian yielding: stop if pedestrian is crossing in front of entry
      if (pedInEntryPath && car.s >= STOP - 0.5) {
        mustStopAtIntersection = true;
      }

      if (mustStopAtIntersection && car.s >= STOP - 0.5) {
        stopTarget = STOP;
      }

      // 4. Same-lane following logic (Intelligent Driver Model - zero rear-end collisions)
      if (lead) {
        const gap = car.s - lead.s;
        const minGap = 5.5; // car length 4.2 + 1.3m bumper gap
        const safeGap = minGap + Math.max(0, car.speed * 0.65);

        if (gap < safeGap) {
          // Slow down smoothly behind lead vehicle
          const leadTarget = lead.s + minGap;
          if (stopTarget < leadTarget) {
            stopTarget = leadTarget;
          }
          const safeSpeed = Math.max(0, lead.speed * Math.max(0, (gap - minGap) / Math.max(0.1, safeGap - minGap)));
          if (car.speed > safeSpeed) {
            car.speed = Math.max(safeSpeed, car.speed - 16 * dt);
          }
        }

        // Hard collision prevention: clamp position and speed so car NEVER penetrates lead car
        if (car.s < lead.s + 5.2) {
          car.s = lead.s + 5.2;
          car.speed = Math.min(car.speed, Math.max(0, lead.speed));
        }
      }

      // 5. Speed acceleration / braking towards stopTarget
      const distToStop = car.s - stopTarget;

      if (stopTarget > -START) {
        // There is an obstacle or stop line ahead
        if (distToStop <= 0.15) {
          // Parked at stop line or behind lead car
          car.speed = Math.max(0, car.speed - 22 * dt);
          if (car.s < stopTarget) car.s = stopTarget;
        } else if (distToStop < 7.0) {
          // Smooth deceleration zone
          const desiredSpeed = Math.max(0, (distToStop / 7.0) * car.targetSpeed * 0.45);
          if (car.speed > desiredSpeed) {
            car.speed = Math.max(desiredSpeed, car.speed - 15 * dt);
          } else {
            car.speed = Math.min(desiredSpeed, car.speed + 3 * dt);
          }
        } else {
          // Clear road ahead
          car.speed = Math.min(car.targetSpeed, car.speed + 4 * dt);
        }
      } else {
        // Green light, clear road ahead -> accelerate smoothly
        car.speed = Math.min(car.targetSpeed, car.speed + 4.5 * dt);
      }

      // 6. Update position
      car.s -= car.speed * dt;
    }
  }

  // ───────────────────────────────────────────────────────────
  // 6. Remove vehicles that have exited the scene
  // ───────────────────────────────────────────────────────────
  const remaining: Car[] = [];
  for (const car of sim.cars) {
    if (car.s < -START) {
      sim.passed++;
    } else {
      remaining.push(car);
    }
  }
  sim.cars = remaining;
}
