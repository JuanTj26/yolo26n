"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Environment, Lightformer } from "@react-three/drei";
import { RoundedBoxGeometry } from "three-stdlib";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import {
  createSim,
  lanePose,
  step,
  axisOf,
  LANES,
  START,
  STOP,
  type Sim,
  pedestrianPose,
  PEDESTRIAN_COLORS,
} from "@/lib/traffic-sim";
import { story, factors } from "@/lib/story";
import { screenBounds, VEHICLE_BOUNDS } from "@/lib/vehicle-detection";

export const simRef: { current: Sim | null } = { current: null };

const MAX_CARS = 48;
const MAX_PEDS = 16;
const PALETTE = [
  "#f8fafc", // Pearl White
  "#1e293b", // Slate Navy Metallic
  "#94a3b8", // Billet Silver Metallic
  "#0f172a", // Obsidian Black Metallic
  "#b91c1c", // Crimson Red Metallic
  "#0284c7", // Electric Blue Metallic
  "#eab308", // Taxi Gold
  "#475569", // Charcoal Grey Metallic
];
const RED = new THREE.Color("#ff3b30");
const GREEN = new THREE.Color("#22c55e");
const AMBER = new THREE.Color("#ffb020");
const OFF = new THREE.Color("#1a1b1e");

/* ---------- Road texture ---------- */
function useRoadTexture() {
  return useMemo(() => {
    if (typeof document === "undefined") return null;
    const c = document.createElement("canvas");
    c.width = 256;
    c.height = 1024;
    const g = c.getContext("2d")!;
    g.fillStyle = "#c4c6ca";
    g.fillRect(0, 0, 256, 1024);
    for (let i = 0; i < 4000; i++) {
      g.fillStyle = `rgba(0,0,0,${Math.random() * 0.04})`;
      g.fillRect(Math.random() * 256, Math.random() * 1024, 2, 2);
    }
    g.fillStyle = "#ffffff";
    g.fillRect(6, 0, 4, 1024);
    g.fillRect(246, 0, 4, 1024);
    for (let y = 0; y < 1024; y += 128) g.fillRect(126, y, 4, 64);
    const t = new THREE.CanvasTexture(c);
    t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(1, 8);
    t.anisotropy = 8;
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, []);
}

function Roads() {
  const tex = useRoadTexture();

  // Zebra stripes centered at ±6.4
  const stripes = useMemo(() => {
    const out: { x: number; z: number; w: number; d: number }[] = [];
    for (let k = 0; k < 4; k++) {
      const [ax, az] = ([
        [0, 1],
        [1, 0],
        [0, -1],
        [-1, 0],
      ] as const)[k]!;
      for (let i = -4; i <= 4; i++) {
        const off = i * 0.95;
        if (ax === 0) out.push({ x: off, z: az * 6.4, w: 0.52, d: 2.2 });
        else out.push({ x: ax * 6.4, z: off, w: 2.2, d: 0.52 });
      }
    }
    return out;
  }, []);

  // Solid white stop lines at ±7.8 (safely in front of the zebra crossings)
  const stopLines = useMemo(() => {
    return [
      { x: 2.0, z: 7.8, w: 4.4, d: 0.4 },   // Approach Lane 0 (South)
      { x: 7.8, z: -2.0, w: 0.4, d: 4.4 },  // Approach Lane 1 (East)
      { x: -2.0, z: -7.8, w: 4.4, d: 0.4 }, // Approach Lane 2 (North)
      { x: -7.8, z: 2.0, w: 0.4, d: 4.4 },  // Approach Lane 3 (West)
    ];
  }, []);

  // Corner sidewalks (curbs at the 4 intersection quadrants)
  const sidewalks = useMemo(() => {
    return [
      { x: 13, z: 13 },
      { x: -13, z: 13 },
      { x: 13, z: -13 },
      { x: -13, z: -13 },
    ];
  }, []);

  return (
    <group>
      {/* North-South Road */}
      <mesh rotation-x={-Math.PI / 2} position-y={0.06} receiveShadow>
        <planeGeometry args={[10, START * 2.4]} />
        {tex ? (
          <meshStandardMaterial map={tex} roughness={0.9} />
        ) : (
          <meshStandardMaterial color="#c4c6ca" roughness={0.9} />
        )}
      </mesh>

      {/* East-West Road */}
      <mesh rotation-x={-Math.PI / 2} rotation-z={Math.PI / 2} position-y={0.062} receiveShadow>
        <planeGeometry args={[10, START * 2.4]} />
        {tex ? (
          <meshStandardMaterial map={tex} roughness={0.9} />
        ) : (
          <meshStandardMaterial color="#c4c6ca" roughness={0.9} />
        )}
      </mesh>

      {/* Center Intersection Plate */}
      <mesh rotation-x={-Math.PI / 2} position-y={0.064} receiveShadow>
        <planeGeometry args={[10, 10]} />
        <meshStandardMaterial color="#c4c6ca" roughness={0.9} />
      </mesh>

      {/* 4 Corner Sidewalk Pads */}
      {sidewalks.map((sw, i) => (
        <mesh key={"sw-" + i} position={[sw.x, 0.08, sw.z]} receiveShadow>
          <boxGeometry args={[16, 0.05, 16]} />
          <meshStandardMaterial color="#dedfe2" roughness={0.7} />
        </mesh>
      ))}

      {/* Painted Zebra Crosswalk Stripes */}
      {stripes.map((s, i) => (
        <mesh key={"stripe-" + i} rotation-x={-Math.PI / 2} position={[s.x, 0.09, s.z]}>
          <planeGeometry args={[s.w, s.d]} />
          <meshBasicMaterial color="#ffffff" />
        </mesh>
      ))}

      {/* Painted Solid Stop Bars */}
      {stopLines.map((sl, i) => (
        <mesh key={"stop-" + i} rotation-x={-Math.PI / 2} position={[sl.x, 0.092, sl.z]}>
          <planeGeometry args={[sl.w, sl.d]} />
          <meshBasicMaterial color="#ffffff" />
        </mesh>
      ))}
    </group>
  );
}

/* ---------- Architecture (instanced buildings) ---------- */
function Buildings() {
  const ref = useRef<THREE.InstancedMesh>(null);
  const items = useMemo(() => {
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const out: { x: number; z: number; w: number; d: number; h: number }[] = [];
    for (const sx of [-1, 1])
      for (const sz of [-1, 1])
        for (let i = 0; i < 14; i++) {
          const x = sx * (12 + rnd() * 40);
          const z = sz * (12 + rnd() * 40);
          const w = 4 + rnd() * 6;
          const d = 4 + rnd() * 6;
          const near = Math.max(Math.abs(x), Math.abs(z));
          const h = 1.5 + rnd() * (near < 22 ? 4 : 14);
          out.push({ x, z, w, d, h });
        }
    return out;
  }, []);

  useEffect(() => {
    if (!ref.current) return;
    const m = new THREE.Matrix4();
    items.forEach((b, i) => {
      m.compose(
        new THREE.Vector3(b.x, b.h / 2, b.z),
        new THREE.Quaternion(),
        new THREE.Vector3(b.w, b.h, b.d)
      );
      ref.current!.setMatrixAt(i, m);
    });
    ref.current.instanceMatrix.needsUpdate = true;
  }, [items]);

  return (
    <instancedMesh ref={ref} args={[undefined, undefined, items.length]} castShadow receiveShadow>
      <boxGeometry />
      <meshStandardMaterial color="#fbfbfa" roughness={0.6} />
    </instancedMesh>
  );
}

/* ---------- Traffic lights ---------- */
const POLES: [number, number][] = [
  [5.6, 8.6],
  [8.6, -5.6],
  [-5.6, -8.6],
  [-8.6, 5.6],
];

// Traffic light shared singletons
const TL_POLE_GEO = new THREE.CylinderGeometry(0.08, 0.1, 4.4, 10);
const TL_BOX_GEO = new RoundedBoxGeometry(0.6, 1.7, 0.45, 2, 0.12);
const TL_LAMP_GEO = new THREE.SphereGeometry(0.17, 14, 10);
const TL_POLE_MAT = new THREE.MeshStandardMaterial({ color: "#1c1d20", metalness: 0.6, roughness: 0.35 });
const TL_BOX_MAT = new THREE.MeshStandardMaterial({ color: "#141517", roughness: 0.4 });

function TrafficLights() {
  const lamps = useRef<THREE.MeshStandardMaterial[][]>([[], [], [], []]);
  const glow = useRef<THREE.PointLight[]>([]);

  useFrame(() => {
    const sim = simRef.current;
    if (!sim) return;
    for (let l = 0; l < 4; l++) {
      const mine = sim.green === axisOf(l);
      // If allRed is active, all poles show red (state 0)
      const state = sim.allRed ? 0 : mine ? (sim.yellow ? 1 : 2) : 0; // 0 red, 1 amber, 2 green
      const cols = [RED, AMBER, GREEN] as const;
      lamps.current[l]?.forEach((mat, i) => {
        if (!mat) return;
        const on = i === state;
        mat.emissive.copy(on ? cols[i]! : OFF);
        mat.emissiveIntensity = on ? 3.2 : 0;
        mat.color.copy(on ? cols[i]! : OFF);
      });
      const g = glow.current[l];
      if (g) g.color.copy(cols[state]!);
    }
  });

  return (
    <group>
      {POLES.map(([x, z], l) => {
        const [dx, dz] = LANES[l]!;
        const rot = Math.atan2(-dx, -dz);
        return (
          <group key={l} position={[x, 0, z]} rotation-y={rot}>
            <mesh position-y={2.2} castShadow geometry={TL_POLE_GEO} material={TL_POLE_MAT} />
            <mesh position={[0, 4.6, 0]} castShadow geometry={TL_BOX_GEO} material={TL_BOX_MAT} />
            {[0, 1, 2].map((i) => (
              <mesh key={i} position={[0, 5.12 - i * 0.52, 0.24]} geometry={TL_LAMP_GEO}>
                <meshStandardMaterial
                  ref={(m) => {
                    if (m) {
                      if (!lamps.current[l]) lamps.current[l] = [];
                      lamps.current[l]![i] = m;
                    }
                  }}
                  toneMapped={false}
                />
              </mesh>
            ))}
            <pointLight
              ref={(p) => {
                if (p) glow.current[l] = p;
              }}
              position={[0, 4.6, 1.2]}
              intensity={6}
              distance={7}
            />
          </group>
        );
      })}
    </group>
  );
}

/* =========================================================================
   OPTIMIZED STATIC VEHICLE & MOTO SINGLETONS (Shared across 48 vehicle slots)
   Reduces ~1,500 dynamic GPU buffer allocations down to static buffers.
   ========================================================================= */

// Car Wheel Singletons
const WHEEL_TIRE_GEO = new THREE.CylinderGeometry(0.34, 0.34, 0.22, 14);
const WHEEL_RIM_GEO = new THREE.CylinderGeometry(0.23, 0.23, 0.23, 10);
const WHEEL_HUB_GEO = new THREE.CylinderGeometry(0.08, 0.08, 0.24, 6);
const WHEEL_TIRE_MAT = new THREE.MeshStandardMaterial({ color: "#1a1a1a", roughness: 0.9, metalness: 0.1 });
const WHEEL_RIM_MAT = new THREE.MeshStandardMaterial({ color: "#e2e8f0", metalness: 0.88, roughness: 0.18 });
const WHEEL_HUB_MAT = new THREE.MeshStandardMaterial({ color: "#0f172a", roughness: 0.5 });

// Car Body Geometries & Cabin Material
const SEDAN_BODY_GEO = new RoundedBoxGeometry(1.94, 0.58, 4.25, 2, 0.22);
const SEDAN_CABIN_GEO = new RoundedBoxGeometry(1.60, 0.52, 2.30, 2, 0.22);
const SUV_BODY_GEO = new RoundedBoxGeometry(2.02, 0.68, 4.30, 2, 0.22);
const SUV_CABIN_GEO = new RoundedBoxGeometry(1.70, 0.58, 2.45, 2, 0.22);
const CABIN_MAT = new THREE.MeshPhysicalMaterial({
  color: "#0f172a",
  metalness: 0.9,
  roughness: 0.08,
  clearcoat: 1,
  clearcoatRoughness: 0.05,
});

// Car Accessory Singletons
const CAR_GRILLE_GEO = new THREE.BoxGeometry(1.35, 0.16, 0.04);
const CAR_GRILLE_MAT = new THREE.MeshStandardMaterial({ color: "#090a0f", roughness: 0.8 });
const CAR_HEADLIGHT_GEO = new THREE.BoxGeometry(0.38, 0.10, 0.04);
const CAR_HEADLIGHT_MAT = new THREE.MeshStandardMaterial({
  color: "#e0f2fe",
  emissive: "#e0f2fe",
  emissiveIntensity: 3,
  toneMapped: false,
});
const CAR_TAILLIGHT_GEO = new THREE.BoxGeometry(1.72, 0.10, 0.04);
const CAR_MIRROR_GEO = new THREE.BoxGeometry(0.16, 0.10, 0.20);
const CAR_MIRROR_MAT = new THREE.MeshStandardMaterial({ color: "#1e293b", roughness: 0.5 });
const SUV_ROOF_RAIL_GEO = new THREE.BoxGeometry(0.06, 0.05, 1.8);
const SUV_ROOF_RAIL_MAT = new THREE.MeshStandardMaterial({ color: "#94a3b8", metalness: 0.9, roughness: 0.2 });
const TAXI_SIGN_GEO = new THREE.BoxGeometry(0.48, 0.15, 0.22);
const TAXI_SIGN_MAT = new THREE.MeshStandardMaterial({
  color: "#fef08a",
  emissive: "#eab308",
  emissiveIntensity: 2.0,
  roughness: 0.3,
  toneMapped: false,
});

// Motorcycle Geometries & Materials Singletons
const MOTO_FRONT_TIRE_GEO = new THREE.CylinderGeometry(0.32, 0.32, 0.12, 14);
const MOTO_FRONT_RIM_GEO = new THREE.CylinderGeometry(0.22, 0.22, 0.13, 10);
const MOTO_REAR_TIRE_GEO = new THREE.CylinderGeometry(0.32, 0.32, 0.16, 14);
const MOTO_REAR_RIM_GEO = new THREE.CylinderGeometry(0.22, 0.22, 0.17, 10);
const MOTO_FORK_GEO = new THREE.CylinderGeometry(0.025, 0.025, 0.65, 8);
const MOTO_SWINGARM_GEO = new THREE.BoxGeometry(0.16, 0.06, 0.72);
const MOTO_ENGINE_GEO = new THREE.BoxGeometry(0.26, 0.30, 0.50);
const MOTO_EXHAUST_GEO = new THREE.CylinderGeometry(0.045, 0.055, 0.75, 8);
const MOTO_TANK_GEO = new RoundedBoxGeometry(0.38, 0.32, 0.68, 2, 0.12);
const MOTO_SEAT_GEO = new RoundedBoxGeometry(0.28, 0.10, 0.56, 2, 0.04);
const MOTO_BAR_GEO = new THREE.CylinderGeometry(0.02, 0.02, 0.64, 8);
const MOTO_GRIP_GEO = new THREE.CylinderGeometry(0.03, 0.03, 0.08, 6);
const MOTO_HEADLIGHT_GEO = new THREE.SphereGeometry(0.08, 10, 8);
const MOTO_TAILLIGHT_GEO = new THREE.BoxGeometry(0.16, 0.06, 0.04);

// Rider Singletons
const RIDER_TORSO_GEO = new THREE.CapsuleGeometry(0.14, 0.32, 4, 8);
const RIDER_HELMET_GEO = new THREE.SphereGeometry(0.14, 12, 10);
const RIDER_VISOR_GEO = new THREE.BoxGeometry(0.17, 0.07, 0.06);
const RIDER_ARM_GEO = new THREE.CylinderGeometry(0.04, 0.04, 0.36, 6);
const RIDER_LEG_GEO = new THREE.CapsuleGeometry(0.05, 0.34, 4, 6);

const MOTO_TIRE_MAT = new THREE.MeshStandardMaterial({ color: "#18181b", roughness: 0.9 });
const MOTO_RIM_MAT = new THREE.MeshStandardMaterial({ color: "#e2e8f0", metalness: 0.9, roughness: 0.18 });
const MOTO_FORK_MAT = new THREE.MeshStandardMaterial({ color: "#475569", metalness: 0.8, roughness: 0.2 });
const MOTO_SWINGARM_MAT = new THREE.MeshStandardMaterial({ color: "#1e293b", metalness: 0.7 });
const MOTO_ENGINE_MAT = new THREE.MeshStandardMaterial({ color: "#090a0f", metalness: 0.85, roughness: 0.25 });
const MOTO_EXHAUST_MAT = new THREE.MeshStandardMaterial({ color: "#cbd5e1", metalness: 0.95, roughness: 0.1 });
const MOTO_SEAT_MAT = new THREE.MeshStandardMaterial({ color: "#18181b", roughness: 0.9 });
const MOTO_BAR_MAT = new THREE.MeshStandardMaterial({ color: "#334155", metalness: 0.8 });
const MOTO_GRIP_MAT = new THREE.MeshStandardMaterial({ color: "#09090b", roughness: 0.9 });
const MOTO_HEADLIGHT_MAT = new THREE.MeshStandardMaterial({
  color: "#e0f2fe",
  emissive: "#e0f2fe",
  emissiveIntensity: 3.2,
  toneMapped: false,
});
const RIDER_JACKET_MAT = new THREE.MeshStandardMaterial({ color: "#1e293b", roughness: 0.7 });
const RIDER_HELMET_MAT = new THREE.MeshStandardMaterial({ color: "#0f172a", roughness: 0.3, metalness: 0.5 });
const RIDER_VISOR_MAT = new THREE.MeshStandardMaterial({ color: "#020617", roughness: 0.05, metalness: 0.9 });
const RIDER_PANTS_MAT = new THREE.MeshStandardMaterial({ color: "#334155" });

/* ---------- Wheel Assembly (Shared Geometries & Materials) ---------- */
function Wheel({ position, isRight = false }: { position: [number, number, number]; isRight?: boolean }) {
  return (
    <group position={position} rotation-z={Math.PI / 2}>
      <mesh castShadow geometry={WHEEL_TIRE_GEO} material={WHEEL_TIRE_MAT} />
      <mesh position={[0, isRight ? 0.02 : -0.02, 0]} geometry={WHEEL_RIM_GEO} material={WHEEL_RIM_MAT} />
      <mesh position={[0, isRight ? 0.03 : -0.03, 0]} geometry={WHEEL_HUB_GEO} material={WHEEL_HUB_MAT} />
    </group>
  );
}

/* ---------- Motorcycle Model (Shared Geometries & Materials) ---------- */
function MotoModel({
  bodyRef,
  tailRef,
}: {
  bodyRef: (m: THREE.MeshPhysicalMaterial | null) => void;
  tailRef: (m: THREE.MeshStandardMaterial | null) => void;
}) {
  return (
    <group>
      {/* Front Wheel */}
      <group position={[0, 0.32, 0.88]} rotation-z={Math.PI / 2}>
        <mesh castShadow geometry={MOTO_FRONT_TIRE_GEO} material={MOTO_TIRE_MAT} />
        <mesh geometry={MOTO_FRONT_RIM_GEO} material={MOTO_RIM_MAT} />
      </group>

      {/* Front Suspension Fork */}
      <group position={[0, 0.6, 0.76]} rotation-x={-0.24}>
        <mesh position={[-0.08, 0, 0]} geometry={MOTO_FORK_GEO} material={MOTO_FORK_MAT} />
        <mesh position={[0.08, 0, 0]} geometry={MOTO_FORK_GEO} material={MOTO_FORK_MAT} />
      </group>

      {/* Rear Wheel */}
      <group position={[0, 0.32, -0.88]} rotation-z={Math.PI / 2}>
        <mesh castShadow geometry={MOTO_REAR_TIRE_GEO} material={MOTO_TIRE_MAT} />
        <mesh geometry={MOTO_REAR_RIM_GEO} material={MOTO_RIM_MAT} />
      </group>

      {/* Rear Swingarm */}
      <mesh position={[0, 0.34, -0.44]} rotation-x={0.08} geometry={MOTO_SWINGARM_GEO} material={MOTO_SWINGARM_MAT} />

      {/* Engine Block */}
      <mesh position={[0, 0.38, -0.05]} castShadow geometry={MOTO_ENGINE_GEO} material={MOTO_ENGINE_MAT} />

      {/* Chrome Exhaust Pipe */}
      <mesh position={[0.17, 0.25, -0.45]} rotation-x={0.08} castShadow geometry={MOTO_EXHAUST_GEO} material={MOTO_EXHAUST_MAT} />

      {/* Fuel Tank (Dynamic paint color) */}
      <mesh position={[0, 0.72, 0.22]} castShadow geometry={MOTO_TANK_GEO}>
        <meshPhysicalMaterial
          ref={bodyRef}
          color="#dc2626"
          metalness={0.6}
          roughness={0.2}
          clearcoat={1}
          clearcoatRoughness={0.06}
        />
      </mesh>

      {/* Motorcycle Seat */}
      <mesh position={[0, 0.66, -0.32]} castShadow geometry={MOTO_SEAT_GEO} material={MOTO_SEAT_MAT} />

      {/* Handlebars & Grips */}
      <mesh position={[0, 0.92, 0.54]} rotation-z={Math.PI / 2} geometry={MOTO_BAR_GEO} material={MOTO_BAR_MAT} />
      <mesh position={[-0.3, 0.92, 0.54]} rotation-z={Math.PI / 2} geometry={MOTO_GRIP_GEO} material={MOTO_GRIP_MAT} />
      <mesh position={[0.3, 0.92, 0.54]} rotation-z={Math.PI / 2} geometry={MOTO_GRIP_GEO} material={MOTO_GRIP_MAT} />

      {/* Front Headlight */}
      <mesh position={[0, 0.76, 0.92]} geometry={MOTO_HEADLIGHT_GEO} material={MOTO_HEADLIGHT_MAT} />

      {/* Rear Taillight / Brake Light (Dynamic emissive) */}
      <mesh position={[0, 0.7, -0.92]} geometry={MOTO_TAILLIGHT_GEO}>
        <meshStandardMaterial
          ref={tailRef}
          color="#dc2626"
          emissive="#dc2626"
          emissiveIntensity={1.2}
          toneMapped={false}
        />
      </mesh>

      {/* Rider */}
      <group position={[0, 0.95, -0.08]} rotation-x={0.22}>
        <mesh position={[0, 0.16, 0]} castShadow geometry={RIDER_TORSO_GEO} material={RIDER_JACKET_MAT} />
        <mesh position={[0, 0.44, 0.02]} castShadow geometry={RIDER_HELMET_GEO} material={RIDER_HELMET_MAT} />
        <mesh position={[0, 0.43, 0.12]} geometry={RIDER_VISOR_GEO} material={RIDER_VISOR_MAT} />
        <mesh position={[-0.18, 0.18, 0.22]} rotation-x={-0.6} rotation-z={-0.2} geometry={RIDER_ARM_GEO} material={RIDER_JACKET_MAT} />
        <mesh position={[0.18, 0.18, 0.22]} rotation-x={-0.6} rotation-z={0.2} geometry={RIDER_ARM_GEO} material={RIDER_JACKET_MAT} />
      </group>

      {/* Legs */}
      <group position={[-0.14, 0.5, -0.15]}>
        <mesh rotation-x={0.4} geometry={RIDER_LEG_GEO} material={RIDER_PANTS_MAT} />
      </group>
      <group position={[0.14, 0.5, -0.15]}>
        <mesh rotation-x={0.4} geometry={RIDER_LEG_GEO} material={RIDER_PANTS_MAT} />
      </group>
    </group>
  );
}

/* ---------- Upgraded Cars & Motos Slot (Shared Singletons) ---------- */
function CarSlot({
  index,
  groups,
  carGroups,
  motoGroups,
  bodies,
  motoBodies,
  taillights,
  motoTaillights,
}: {
  index: number;
  groups: React.MutableRefObject<(THREE.Group | null)[]>;
  carGroups: React.MutableRefObject<(THREE.Group | null)[]>;
  motoGroups: React.MutableRefObject<(THREE.Group | null)[]>;
  bodies: React.MutableRefObject<(THREE.MeshPhysicalMaterial | null)[]>;
  motoBodies: React.MutableRefObject<(THREE.MeshPhysicalMaterial | null)[]>;
  taillights: React.MutableRefObject<(THREE.MeshStandardMaterial | null)[]>;
  motoTaillights: React.MutableRefObject<(THREE.MeshStandardMaterial | null)[]>;
}) {
  const isSUV = index % 3 === 1;
  const isTaxi = index % 3 === 2;

  return (
    <group ref={(g) => void (groups.current[index] = g)} visible={false}>
      {/* 4-Wheeled Car Model (Sedan, SUV, Taxi) */}
      <group ref={(g) => void (carGroups.current[index] = g)} visible={true}>
        {/* Main Chassis Body */}
        <mesh
          geometry={isSUV ? SUV_BODY_GEO : SEDAN_BODY_GEO}
          position-y={isSUV ? 0.68 : 0.6}
          castShadow
          receiveShadow
        >
          <meshPhysicalMaterial
            ref={(m) => void (bodies.current[index] = m)}
            color="#f4f4f2"
            metalness={0.55}
            roughness={0.22}
            clearcoat={1}
            clearcoatRoughness={0.06}
          />
        </mesh>

        {/* Aerodynamic Cabin & Tinted Windows */}
        <mesh
          geometry={isSUV ? SUV_CABIN_GEO : SEDAN_CABIN_GEO}
          material={CABIN_MAT}
          position={[0, isSUV ? 1.24 : 1.1, isSUV ? -0.15 : -0.22]}
          castShadow
        />

        {/* Lower Front Grille */}
        <mesh position={[0, isSUV ? 0.44 : 0.4, 2.14]} geometry={CAR_GRILLE_GEO} material={CAR_GRILLE_MAT} />

        {/* Front Dual LED Headlights */}
        <mesh position={[-0.72, isSUV ? 0.74 : 0.66, 2.14]} geometry={CAR_HEADLIGHT_GEO} material={CAR_HEADLIGHT_MAT} />
        <mesh position={[0.72, isSUV ? 0.74 : 0.66, 2.14]} geometry={CAR_HEADLIGHT_GEO} material={CAR_HEADLIGHT_MAT} />

        {/* Rear Lightbar with Dynamic Brake Glow */}
        <mesh position={[0, isSUV ? 0.82 : 0.74, -2.14]} geometry={CAR_TAILLIGHT_GEO}>
          <meshStandardMaterial
            ref={(m) => void (taillights.current[index] = m)}
            color="#dc2626"
            emissive="#dc2626"
            emissiveIntensity={1.2}
            toneMapped={false}
          />
        </mesh>

        {/* Dual Side Rearview Mirrors */}
        <mesh position={[-1.04, isSUV ? 1.05 : 0.94, 0.42]} castShadow geometry={CAR_MIRROR_GEO} material={CAR_MIRROR_MAT} />
        <mesh position={[1.04, isSUV ? 1.05 : 0.94, 0.42]} castShadow geometry={CAR_MIRROR_GEO} material={CAR_MIRROR_MAT} />

        {/* 4 Independent Wheels */}
        <Wheel position={[-0.96, 0.34, 1.32]} isRight={false} />
        <Wheel position={[0.96, 0.34, 1.32]} isRight={true} />
        <Wheel position={[-0.96, 0.34, -1.32]} isRight={false} />
        <Wheel position={[0.96, 0.34, -1.32]} isRight={true} />

        {/* SUV Roof Rails */}
        {isSUV && (
          <group position={[0, 1.56, -0.15]}>
            <mesh position={[-0.68, 0, 0]} geometry={SUV_ROOF_RAIL_GEO} material={SUV_ROOF_RAIL_MAT} />
            <mesh position={[0.68, 0, 0]} geometry={SUV_ROOF_RAIL_GEO} material={SUV_ROOF_RAIL_MAT} />
          </group>
        )}

        {/* Taxi Roof Sign */}
        {isTaxi && (
          <group position={[0, 1.4, 0]}>
            <mesh castShadow geometry={TAXI_SIGN_GEO} material={TAXI_SIGN_MAT} />
          </group>
        )}
      </group>

      {/* 2-Wheeled Motorcycle Model with Rider */}
      <group ref={(g) => void (motoGroups.current[index] = g)} visible={false}>
        <MotoModel
          bodyRef={(m) => void (motoBodies.current[index] = m)}
          tailRef={(m) => void (motoTaillights.current[index] = m)}
        />
      </group>
    </group>
  );
}

function Cars({
  groups,
  slotTypes,
  dashboard = false,
  paused = false,
}: {
  groups: React.MutableRefObject<(THREE.Group | null)[]>;
  slotTypes: React.MutableRefObject<string[]>;
  dashboard?: boolean;
  paused?: boolean;
}) {
  const carGroups = useRef<(THREE.Group | null)[]>([]);
  const motoGroups = useRef<(THREE.Group | null)[]>([]);
  const bodies = useRef<(THREE.MeshPhysicalMaterial | null)[]>([]);
  const motoBodies = useRef<(THREE.MeshPhysicalMaterial | null)[]>([]);
  const taillights = useRef<(THREE.MeshStandardMaterial | null)[]>([]);
  const motoTaillights = useRef<(THREE.MeshStandardMaterial | null)[]>([]);

  const slotOf = useRef(new Map<number, number>());
  const free = useRef<number[]>(Array.from({ length: MAX_CARS }, (_, i) => i));

  useFrame((_, delta) => {
    const sim = simRef.current;
    if (!sim) return;
    const p = story.p;
    sim.mode = dashboard ? "adaptive" : p < 0.14 ? "fixed" : p < 0.8 ? "jam" : "adaptive";
    if (!paused) step(sim, Math.min(delta, 0.05));

    const alive = new Set<number>();
    for (const car of sim.cars) {
      alive.add(car.id);
      let slot = slotOf.current.get(car.id);
      if (slot === undefined) {
        slot = free.current.pop();
        if (slot === undefined) continue;
        slotOf.current.set(car.id, slot);

        const isMoto = car.vType === "moto";
        slotTypes.current[slot] = car.vType;

        if (carGroups.current[slot]) carGroups.current[slot]!.visible = !isMoto;
        if (motoGroups.current[slot]) motoGroups.current[slot]!.visible = isMoto;

        if (isMoto) {
          motoBodies.current[slot]?.color.set(PALETTE[car.color % PALETTE.length]!);
        } else {
          const isTaxi = car.vType === "taxi";
          bodies.current[slot]?.color.set(isTaxi ? "#eab308" : PALETTE[car.color % PALETTE.length]!);
        }
      }
      const g = groups.current[slot];
      if (!g) continue;
      const pose = lanePose(car.lane, car.s);
      g.visible = true;
      g.position.set(pose.x, 0, pose.z);
      g.rotation.y = pose.rot;

      // Dynamic brake lights for cars and motorcycles
      const isBraking = car.speed < 2.0;
      const isMoto = car.vType === "moto";
      const tail = isMoto ? motoTaillights.current[slot] : taillights.current[slot];
      if (tail) {
        tail.emissiveIntensity = isBraking ? 3.8 : 0.9;
        tail.color.set(isBraking ? "#ff0033" : "#991b1b");
      }
    }
    for (const [id, slot] of slotOf.current) {
      if (!alive.has(id)) {
        slotOf.current.delete(id);
        free.current.push(slot);
        const g = groups.current[slot];
        if (g) g.visible = false;
      }
    }
  });

  return (
    <group>
      {Array.from({ length: MAX_CARS }, (_, i) => (
        <CarSlot
          key={i}
          index={i}
          groups={groups}
          carGroups={carGroups}
          motoGroups={motoGroups}
          bodies={bodies}
          motoBodies={motoBodies}
          taillights={taillights}
          motoTaillights={motoTaillights}
        />
      ))}
    </group>
  );
}

/* =========================================================================
   OPTIMIZED STATIC PEDESTRIAN SINGLETONS (Shared across 16 pedestrian slots)
   ========================================================================= */
const PED_TORSO_GEO = new THREE.CapsuleGeometry(0.16, 0.38, 4, 8);
const PED_HEAD_GEO = new THREE.SphereGeometry(0.13, 10, 8);
const PED_HAIR_GEO = new THREE.SphereGeometry(0.12, 8, 8);
const PED_LEG_GEO = new THREE.CapsuleGeometry(0.06, 0.42, 4, 6);
const PED_ARM_GEO = new THREE.CapsuleGeometry(0.045, 0.28, 4, 6);

const PED_HEAD_MAT = new THREE.MeshStandardMaterial({ color: "#fcd34d", roughness: 0.6 });
const PED_HAIR_MAT = new THREE.MeshStandardMaterial({ color: "#1e293b", roughness: 0.9 });
const PED_PANTS_MAT = new THREE.MeshStandardMaterial({ color: "#334155", roughness: 0.8 });
const PED_ARM_MAT = new THREE.MeshStandardMaterial({ color: "#64748b", roughness: 0.7 });

/* ---------- Pedestrians (pooled animated figures, zero re-renders) ---------- */
function PedestrianSlot({
  index,
  groups,
  torsos,
  leftLegs,
  rightLegs,
  leftArms,
  rightArms,
}: {
  index: number;
  groups: React.MutableRefObject<(THREE.Group | null)[]>;
  torsos: React.MutableRefObject<(THREE.MeshStandardMaterial | null)[]>;
  leftLegs: React.MutableRefObject<(THREE.Group | null)[]>;
  rightLegs: React.MutableRefObject<(THREE.Group | null)[]>;
  leftArms: React.MutableRefObject<(THREE.Group | null)[]>;
  rightArms: React.MutableRefObject<(THREE.Group | null)[]>;
}) {
  return (
    <group ref={(g) => void (groups.current[index] = g)} visible={false}>
      {/* Torso (Dynamic palette color) */}
      <mesh position={[0, 0.95, 0]} castShadow geometry={PED_TORSO_GEO}>
        <meshStandardMaterial
          ref={(m) => void (torsos.current[index] = m)}
          color="#3b82f6"
          roughness={0.7}
        />
      </mesh>
      {/* Head */}
      <mesh position={[0, 1.42, 0]} castShadow geometry={PED_HEAD_GEO} material={PED_HEAD_MAT} />
      {/* Hair / Cap */}
      <mesh position={[0, 1.5, -0.015]} castShadow geometry={PED_HAIR_GEO} material={PED_HAIR_MAT} />
      {/* Left Leg (pivot at hip y=0.68) */}
      <group ref={(g) => void (leftLegs.current[index] = g)} position={[-0.08, 0.68, 0]}>
        <mesh position={[0, -0.32, 0]} castShadow geometry={PED_LEG_GEO} material={PED_PANTS_MAT} />
      </group>
      {/* Right Leg (pivot at hip y=0.68) */}
      <group ref={(g) => void (rightLegs.current[index] = g)} position={[0.08, 0.68, 0]}>
        <mesh position={[0, -0.32, 0]} castShadow geometry={PED_LEG_GEO} material={PED_PANTS_MAT} />
      </group>
      {/* Left Arm (pivot at shoulder y=1.12) */}
      <group ref={(g) => void (leftArms.current[index] = g)} position={[-0.22, 1.12, 0]}>
        <mesh position={[0, -0.2, 0]} castShadow geometry={PED_ARM_GEO} material={PED_ARM_MAT} />
      </group>
      {/* Right Arm (pivot at shoulder y=1.12) */}
      <group ref={(g) => void (rightArms.current[index] = g)} position={[0.22, 1.12, 0]}>
        <mesh position={[0, -0.2, 0]} castShadow geometry={PED_ARM_GEO} material={PED_ARM_MAT} />
      </group>
    </group>
  );
}

function Pedestrians({
  groups,
}: {
  groups: React.MutableRefObject<(THREE.Group | null)[]>;
}) {
  const torsos = useRef<(THREE.MeshStandardMaterial | null)[]>([]);
  const leftLegs = useRef<(THREE.Group | null)[]>([]);
  const rightLegs = useRef<(THREE.Group | null)[]>([]);
  const leftArms = useRef<(THREE.Group | null)[]>([]);
  const rightArms = useRef<(THREE.Group | null)[]>([]);

  const slotOf = useRef(new Map<number, number>());
  const free = useRef<number[]>(Array.from({ length: MAX_PEDS }, (_, i) => i));
  const walkPhase = useRef<number[]>(new Array(MAX_PEDS).fill(0));

  useFrame((_, delta) => {
    const sim = simRef.current;
    if (!sim) return;

    const alive = new Set<number>();
    for (const ped of sim.pedestrians) {
      alive.add(ped.id);
      let slot = slotOf.current.get(ped.id);
      if (slot === undefined) {
        slot = free.current.pop();
        if (slot === undefined) continue;
        slotOf.current.set(ped.id, slot);
        walkPhase.current[slot] = Math.random();
        torsos.current[slot]?.color.set(
          PEDESTRIAN_COLORS[ped.color % PEDESTRIAN_COLORS.length]!
        );
      }

      const g = groups.current[slot];
      if (!g) continue;

      const pose = pedestrianPose(ped);
      g.visible = true;
      g.position.set(pose.x, 0.08, pose.z);
      g.rotation.y = pose.rot;

      // Animate limb movements
      if (!ped.waiting) {
        walkPhase.current[slot] = (walkPhase.current[slot]! + delta * ped.speed * 12) % (Math.PI * 2);
        const p = walkPhase.current[slot]!;
        const swing = Math.sin(p) * 0.42;

        if (leftLegs.current[slot]) leftLegs.current[slot]!.rotation.x = swing;
        if (rightLegs.current[slot]) rightLegs.current[slot]!.rotation.x = -swing;
        if (leftArms.current[slot]) leftArms.current[slot]!.rotation.x = -swing * 0.85;
        if (rightArms.current[slot]) rightArms.current[slot]!.rotation.x = swing * 0.85;
      } else {
        // Standing still waiting at sidewalk curb
        if (leftLegs.current[slot]) leftLegs.current[slot]!.rotation.x = 0;
        if (rightLegs.current[slot]) rightLegs.current[slot]!.rotation.x = 0;
        if (leftArms.current[slot]) leftArms.current[slot]!.rotation.x = 0;
        if (rightArms.current[slot]) rightArms.current[slot]!.rotation.x = 0;
      }
    }

    // Recycle slots for departed pedestrians
    for (const [id, slot] of slotOf.current) {
      if (!alive.has(id)) {
        slotOf.current.delete(id);
        free.current.push(slot);
        const g = groups.current[slot];
        if (g) g.visible = false;
      }
    }
  });

  return (
    <group>
      {Array.from({ length: MAX_PEDS }, (_, i) => (
        <PedestrianSlot
          key={i}
          index={i}
          groups={groups}
          torsos={torsos}
          leftLegs={leftLegs}
          rightLegs={rightLegs}
          leftArms={leftArms}
          rightArms={rightArms}
        />
      ))}
    </group>
  );
}

/* ---------- YOLO AI Detection Overlay (Vehicles in Orange, Motos in Amber, Pedestrians in Cyan) ---------- */
function DetectionOverlay({
  carGroups,
  pedGroups,
  slotTypes,
  canvas,
  dashboard = false,
  detections = true,
}: {
  carGroups: React.MutableRefObject<(THREE.Group | null)[]>;
  pedGroups: React.MutableRefObject<(THREE.Group | null)[]>;
  slotTypes: React.MutableRefObject<string[]>;
  canvas: React.RefObject<HTMLCanvasElement | null>;
  dashboard?: boolean;
  detections?: boolean;
}) {
  const carCorners = useMemo(() => {
    const { halfWidth, height, halfLength } = VEHICLE_BOUNDS;
    return [-halfWidth, halfWidth].flatMap((x) =>
      [0, height].flatMap((y) =>
        [-halfLength, halfLength].map((z) => new THREE.Vector3(x, y, z))
      )
    );
  }, []);
  const carProjected = useMemo(() => carCorners.map(() => new THREE.Vector3()), [carCorners]);

  const motoCorners = useMemo(() => {
    const hw = 0.42;
    const h = 1.55;
    const hl = 1.15;
    return [-hw, hw].flatMap((x) =>
      [0, h].flatMap((y) =>
        [-hl, hl].map((z) => new THREE.Vector3(x, y, z))
      )
    );
  }, []);
  const motoProjected = useMemo(() => motoCorners.map(() => new THREE.Vector3()), [motoCorners]);

  const pedCorners = useMemo(() => {
    const hw = 0.32;
    const h = 1.62;
    const hl = 0.32;
    return [-hw, hw].flatMap((x) =>
      [0, h].flatMap((y) =>
        [-hl, hl].map((z) => new THREE.Vector3(x, y, z))
      )
    );
  }, []);
  const pedProjected = useMemo(() => pedCorners.map(() => new THREE.Vector3()), [pedCorners]);

  useFrame(({ camera, size }) => {
    const el = canvas.current;
    const ctx = el?.getContext("2d");
    if (!el || !ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (el.width !== Math.round(size.width * dpr) || el.height !== Math.round(size.height * dpr)) {
      el.width = Math.round(size.width * dpr);
      el.height = Math.round(size.height * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size.width, size.height);
    const alpha = detections ? (dashboard ? 1 : factors(story.p).intel) : 0;
    if (alpha < 0.02) return;

    camera.updateMatrixWorld();
    ctx.globalAlpha = alpha;
    ctx.lineWidth = 1.5;
    ctx.font = "bold 9px ui-monospace, SFMono-Regular, monospace";

    // 1. Vehicles: AUTO (Orange #f95721) or MOTO (Amber #f59e0b)
    for (let i = 0; i < carGroups.current.length; i++) {
      const group = carGroups.current[i];
      if (!group?.visible) continue;
      const isMoto = slotTypes.current[i] === "moto";
      const corners = isMoto ? motoCorners : carCorners;
      const projected = isMoto ? motoProjected : carProjected;
      const boxColor = isMoto ? "#f59e0b" : "#f95721";
      const label = isMoto ? "MOTO" : "AUTO";

      ctx.strokeStyle = boxColor;
      ctx.fillStyle = boxColor;

      group.updateWorldMatrix(true, false);
      corners.forEach((corner, cIdx) =>
        projected[cIdx]?.copy(corner).applyMatrix4(group.matrixWorld).project(camera)
      );
      const bounds = screenBounds(projected, size.width, size.height);
      if (bounds) {
        ctx.strokeRect(bounds.left, bounds.top, bounds.width, bounds.height);
        const len = 4;
        ctx.fillRect(bounds.left - 1, bounds.top - 1, len, 2);
        ctx.fillRect(bounds.left - 1, bounds.top - 1, 2, len);
        ctx.fillRect(bounds.left + bounds.width - len + 1, bounds.top - 1, len, 2);
        ctx.fillRect(bounds.left + bounds.width - 1, bounds.top - 1, 2, len);
        ctx.fillText(label, bounds.left + 2, bounds.top - 3);
      }
    }

    // 2. Pedestrians: PEATÓN (Cyan #06b6d4)
    const pedColor = "#06b6d4";
    ctx.strokeStyle = pedColor;
    ctx.fillStyle = pedColor;

    for (const group of pedGroups.current) {
      if (!group?.visible) continue;
      group.updateWorldMatrix(true, false);
      pedCorners.forEach((corner, i) =>
        pedProjected[i]?.copy(corner).applyMatrix4(group.matrixWorld).project(camera)
      );
      const bounds = screenBounds(pedProjected, size.width, size.height);
      if (bounds) {
        ctx.strokeRect(bounds.left, bounds.top, bounds.width, bounds.height);
        const len = 3;
        ctx.fillRect(bounds.left - 1, bounds.top - 1, len, 2);
        ctx.fillRect(bounds.left - 1, bounds.top - 1, 2, len);
        ctx.fillRect(bounds.left + bounds.width - len + 1, bounds.top - 1, len, 2);
        ctx.fillRect(bounds.left + bounds.width - 1, bounds.top - 1, 2, len);
        ctx.fillText("PEATÓN", bounds.left + 2, bounds.top - 3);
      }
    }

    ctx.globalAlpha = 1;
  });

  return null;
}

/* ---------- Analysis overlays (Story mode only) ---------- */
function Analysis() {
  const ew = useRef<THREE.MeshBasicMaterial[]>([]);
  const ns = useRef<THREE.MeshBasicMaterial[]>([]);
  const ring = useRef<THREE.Mesh>(null);
  const ringMat = useRef<THREE.MeshBasicMaterial>(null);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const f = factors(story.p);
    const pulse = 0.6 + 0.4 * Math.sin(t * 3);
    ew.current.forEach((m) => {
      if (m) m.opacity = (f.decision * 0.4 + f.solution * 0.12) * pulse;
    });
    ns.current.forEach((m) => {
      if (m) m.opacity = f.decision * 0.2;
    });
    if (ring.current && ringMat.current) {
      const k = (t * 0.45) % 1;
      ring.current.scale.setScalar(4 + k * 70);
      ringMat.current.opacity = f.intel * (1 - f.solution * 0.7) * (1 - k) * 0.5;
    }
  });

  return (
    <group position-y={0.1}>
      {[1, -1].map((s, i) => (
        <mesh key={"e" + s} rotation-x={-Math.PI / 2} position={[s * 38, 0.01, -s * 2]}>
          <planeGeometry args={[60, 3.4]} />
          <meshBasicMaterial
            ref={(m) => void (m && (ew.current[i] = m))}
            color="#22c55e"
            transparent
            opacity={0}
            depthWrite={false}
          />
        </mesh>
      ))}
      {[1, -1].map((s, i) => (
        <mesh key={"n" + s} rotation-x={-Math.PI / 2} position={[s * 2, 0.01, s * 38]}>
          <planeGeometry args={[3.4, 60]} />
          <meshBasicMaterial
            ref={(m) => void (m && (ns.current[i] = m))}
            color="#ff3b30"
            transparent
            opacity={0}
            depthWrite={false}
          />
        </mesh>
      ))}
      <mesh ref={ring} rotation-x={-Math.PI / 2} position-y={0.02}>
        <ringGeometry args={[0.97, 1, 96]} />
        <meshBasicMaterial ref={ringMat} color="#0a0a0a" transparent opacity={0} depthWrite={false} />
      </mesh>
    </group>
  );
}

/* ---------- Liquid glass overlay shader (Story mode) ---------- */
const liquidFrag = /* glsl */ `
precision highp float;
uniform float uTime; uniform float uP; uniform vec2 uMouse; uniform vec2 uRes;
uniform float uJam; uniform float uSol; uniform float uTrans;
varying vec2 vUv;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
 return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<5;i++){v+=a*noise(p);p=p*2.03+vec2(1.7,9.2);a*=.5;}return v;}
void main(){
  vec2 uv=vUv; float asp=uRes.x/uRes.y; vec2 q=vec2(uv.x*asp,uv.y);
  vec2 m=vec2(uMouse.x*.5+.5,uMouse.y*.5+.5); m.x*=asp;
  float md=length(q-m);
  float t=uTime*.06+uP*3.;
  vec2 w=vec2(fbm(q*1.4+t),fbm(q*1.4-t+4.));
  w+=0.25*exp(-md*3.)*vec2(sin(uTime),cos(uTime));
  float n=fbm(q*2.+w*2.2+uP*4.);
  float bands=smoothstep(.55,.95,n);
  float caustic=pow(abs(sin(n*18.+uTime*.4)),24.)*.5;
  vec3 tint=mix(vec3(1.),vec3(1.,.42,.38),uJam*.7);
  tint=mix(tint,vec3(.45,.95,.62),uSol*.7);
  float edge=smoothstep(.15,0.,uv.y)+smoothstep(.85,1.,uv.y);
  float a=(bands*.16+caustic*.12)*(.45+uTrans*1.2)+edge*.25*(1.-uP*.5);
  vec3 col=mix(vec3(1.),tint,bands*.9);
  col+=caustic;
  gl_FragColor=vec4(col,clamp(a,0.,.55));
}`;

function LiquidOverlay() {
  const mat = useRef<THREE.ShaderMaterial>(null);
  const { size } = useThree();
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uP: { value: 0 },
      uMouse: { value: new THREE.Vector2() },
      uRes: { value: new THREE.Vector2(1, 1) },
      uJam: { value: 0 },
      uSol: { value: 0 },
      uTrans: { value: 0 },
    }),
    []
  );

  useFrame(({ clock }) => {
    const u = uniforms;
    const p = story.p;
    const f = factors(p);
    u.uTime.value = clock.elapsedTime;
    u.uP.value = p;
    u.uMouse.value.lerp(new THREE.Vector2(story.mouse.x, -story.mouse.y), 0.06);
    u.uRes.value.set(size.width, size.height);
    u.uJam.value = f.jam;
    u.uSol.value = f.solution;
    let tr = 0;
    for (const b of [0.14, 0.37, 0.59, 0.8]) tr = Math.max(tr, Math.exp(-Math.pow((p - b) / 0.03, 2)));
    u.uTrans.value = tr;
  });

  return (
    <mesh frustumCulled={false} renderOrder={999}>
      <planeGeometry args={[2, 2]} />
      <shaderMaterial
        ref={mat}
        uniforms={uniforms}
        transparent
        depthTest={false}
        depthWrite={false}
        vertexShader={`varying vec2 vUv; void main(){vUv=uv; gl_Position=vec4(position.xy,0.,1.);}`}
        fragmentShader={liquidFrag}
      />
    </mesh>
  );
}

/* ---------- Camera Rig ---------- */
type KF = { p: number; pos: [number, number, number]; look: [number, number, number] };
const KEYS: KF[] = [
  { p: 0, pos: [30, 21, 34], look: [0, 0, 2] },
  { p: 0.12, pos: [24, 14, 28], look: [0, 0, 0] },
  { p: 0.27, pos: [38, 7, 10], look: [12, 0.6, -2] },
  { p: 0.49, pos: [0.01, 78, 9], look: [0, 0, 0] },
  { p: 0.69, pos: [-38, 32, 30], look: [4, 0, 0] },
  { p: 0.9, pos: [46, 20, -22], look: [0, 0, 0] },
  { p: 1, pos: [44, 28, -30], look: [0, 0, 0] },
];

function CameraRig({
  dashboard = false,
  overhead = false,
}: {
  dashboard?: boolean;
  overhead?: boolean;
}) {
  const { camera, size } = useThree();
  const pos = useMemo(() => new THREE.Vector3(...KEYS[0]!.pos), []);
  const look = useMemo(() => new THREE.Vector3(), []);
  const tp = useMemo(() => new THREE.Vector3(), []);
  const tl = useMemo(() => new THREE.Vector3(), []);

  useFrame(({ clock }, delta) => {
    const p = dashboard ? (overhead ? 0.49 : 0) : story.p;
    let i = 0;
    while (i < KEYS.length - 2 && p > KEYS[i + 1]!.p) i++;
    const a = KEYS[i]!;
    const b = KEYS[i + 1]!;
    let t = Math.min(1, Math.max(0, (p - a.p) / (b.p - a.p)));
    t = t * t * (3 - 2 * t);
    tp.set(...a.pos).lerp(new THREE.Vector3(...b.pos), t);
    tl.set(...a.look).lerp(new THREE.Vector3(...b.look), t);
    const narrow = size.width < size.height;
    if (narrow) tp.sub(tl).multiplyScalar(1.55).add(tl);
    const ct = clock.elapsedTime;
    tp.x += Math.sin(ct * 0.12) * 1.2 + story.mouse.x * 2.2;
    tp.y += story.mouse.y * -1.2;
    tp.z += Math.cos(ct * 0.1) * 1.2;
    const k = 1 - Math.exp(-3.5 * Math.min(delta, 0.05));
    pos.lerp(tp, k);
    look.lerp(tl, k);
    camera.position.copy(pos);
    camera.lookAt(look);
  });

  return null;
}

function Ready({ onReady }: { onReady: () => void }) {
  const done = useRef(false);
  useFrame(() => {
    if (!done.current) {
      done.current = true;
      onReady();
    }
  });
  return null;
}

export default function TrafficScene({
  dashboard = false,
  detections = true,
  paused = false,
  overhead = false,
}: {
  dashboard?: boolean;
  detections?: boolean;
  paused?: boolean;
  overhead?: boolean;
}) {
  if (!simRef.current) simRef.current = createSim();
  const wrap = useRef<HTMLDivElement>(null);
  const detectionCanvas = useRef<HTMLCanvasElement>(null);
  const carGroups = useRef<(THREE.Group | null)[]>([]);
  const pedGroups = useRef<(THREE.Group | null)[]>([]);
  const slotTypes = useRef<string[]>(new Array(MAX_CARS).fill("sedan"));

  return (
    <div ref={wrap} className="fixed inset-0 z-0">
      <Canvas
        shadows
        flat
        dpr={[1, 1.5]}
        camera={{ fov: 32, near: 1, far: 240, position: KEYS[0]!.pos }}
        gl={{ antialias: true, powerPreference: "high-performance" }}
      >
        <color attach="background" args={["#ffffff"]} />
        <fog attach="fog" args={["#ffffff", 60, 150]} />
        <ambientLight intensity={0.25} />
        <hemisphereLight args={["#ffffff", "#dfe2e6", 0.35]} />
        <directionalLight
          position={[30, 50, 20]}
          intensity={1.15}
          castShadow
          shadow-mapSize={[1024, 1024]}
          shadow-camera-left={-42}
          shadow-camera-right={42}
          shadow-camera-top={42}
          shadow-camera-bottom={-42}
          shadow-bias={-0.0004}
        />
        <Environment resolution={64} environmentIntensity={0.6}>
          <Lightformer intensity={2} position={[0, 10, 0]} rotation-x={Math.PI / 2} scale={[20, 20, 1]} />
          <Lightformer intensity={1.2} position={[-10, 3, 0]} rotation-y={Math.PI / 2} scale={[30, 2, 1]} />
          <Lightformer intensity={1.2} position={[10, 3, 4]} rotation-y={-Math.PI / 2} scale={[30, 2, 1]} />
        </Environment>
        <mesh rotation-x={-Math.PI / 2} receiveShadow>
          <planeGeometry args={[500, 500]} />
          <meshStandardMaterial color="#ffffff" roughness={1} emissive="#ffffff" emissiveIntensity={0.55} />
        </mesh>
        <Roads />
        <Buildings />
        <TrafficLights />
        <Cars groups={carGroups} slotTypes={slotTypes} dashboard={dashboard} paused={paused} />
        <Pedestrians groups={pedGroups} />
        {!dashboard && <Analysis />}
        <CameraRig dashboard={dashboard} overhead={overhead} />
        <DetectionOverlay
          carGroups={carGroups}
          pedGroups={pedGroups}
          slotTypes={slotTypes}
          canvas={detectionCanvas}
          dashboard={dashboard}
          detections={detections}
        />
        {!dashboard && <LiquidOverlay />}
        <Ready onReady={() => wrap.current?.setAttribute("data-scene-ready", "")} />
      </Canvas>
      <canvas
        ref={detectionCanvas}
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 h-full w-full"
      />
    </div>
  );
}
