"use client";

import React, { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { pedestrianPose, PEDESTRIAN_COLORS } from "@/lib/traffic-sim";
import type { SimRefHolder } from "./tipos";

export const MAX_PEATONES = 16;

const GEO_TORSO = new THREE.CapsuleGeometry(0.16, 0.38, 4, 8);
const GEO_CABEZA = new THREE.SphereGeometry(0.13, 10, 8);
const GEO_CABELLO = new THREE.SphereGeometry(0.12, 8, 8);
const GEO_PIERNA = new THREE.CapsuleGeometry(0.06, 0.42, 4, 6);
const GEO_BRAZO = new THREE.CapsuleGeometry(0.045, 0.28, 4, 6);

const MAT_CABEZA = new THREE.MeshStandardMaterial({ color: "#fcd34d", roughness: 0.6 });
const MAT_CABELLO = new THREE.MeshStandardMaterial({ color: "#1e293b", roughness: 0.9 });
const MAT_PANTALON = new THREE.MeshStandardMaterial({ color: "#334155", roughness: 0.8 });
const MAT_BRAZO = new THREE.MeshStandardMaterial({ color: "#64748b", roughness: 0.7 });

function EspacioPeaton({
  index,
  grupos,
  torsos,
  piernasIzq,
  piernasDer,
  brazosIzq,
  brazosDer,
}: {
  index: number;
  grupos: React.MutableRefObject<(THREE.Group | null)[]>;
  torsos: React.MutableRefObject<(THREE.MeshStandardMaterial | null)[]>;
  piernasIzq: React.MutableRefObject<(THREE.Group | null)[]>;
  piernasDer: React.MutableRefObject<(THREE.Group | null)[]>;
  brazosIzq: React.MutableRefObject<(THREE.Group | null)[]>;
  brazosDer: React.MutableRefObject<(THREE.Group | null)[]>;
}) {
  return (
    <group ref={(g) => void (grupos.current[index] = g)} visible={false}>
      {/* Torso con color dinámico */}
      <mesh position={[0, 0.95, 0]} castShadow geometry={GEO_TORSO}>
        <meshStandardMaterial
          ref={(m) => void (torsos.current[index] = m)}
          color="#3b82f6"
          roughness={0.7}
        />
      </mesh>
      {/* Cabeza */}
      <mesh position={[0, 1.42, 0]} castShadow geometry={GEO_CABEZA} material={MAT_CABEZA} />
      {/* Cabello / Gorra */}
      <mesh position={[0, 1.5, -0.015]} castShadow geometry={GEO_CABELLO} material={MAT_CABELLO} />
      {/* Pierna Izquierda */}
      <group ref={(g) => void (piernasIzq.current[index] = g)} position={[-0.08, 0.68, 0]}>
        <mesh position={[0, -0.32, 0]} castShadow geometry={GEO_PIERNA} material={MAT_PANTALON} />
      </group>
      {/* Pierna Derecha */}
      <group ref={(g) => void (piernasDer.current[index] = g)} position={[0.08, 0.68, 0]}>
        <mesh position={[0, -0.32, 0]} castShadow geometry={GEO_PIERNA} material={MAT_PANTALON} />
      </group>
      {/* Brazo Izquierdo */}
      <group ref={(g) => void (brazosIzq.current[index] = g)} position={[-0.22, 1.12, 0]}>
        <mesh position={[0, -0.2, 0]} castShadow geometry={GEO_BRAZO} material={MAT_BRAZO} />
      </group>
      {/* Brazo Derecho */}
      <group ref={(g) => void (brazosDer.current[index] = g)} position={[0.22, 1.12, 0]}>
        <mesh position={[0, -0.2, 0]} castShadow geometry={GEO_BRAZO} material={MAT_BRAZO} />
      </group>
    </group>
  );
}

export default function Peatones({
  grupos,
  simRef,
}: {
  grupos: React.MutableRefObject<(THREE.Group | null)[]>;
  simRef: SimRefHolder;
}) {
  const torsos = useRef<(THREE.MeshStandardMaterial | null)[]>([]);
  const piernasIzq = useRef<(THREE.Group | null)[]>([]);
  const piernasDer = useRef<(THREE.Group | null)[]>([]);
  const brazosIzq = useRef<(THREE.Group | null)[]>([]);
  const brazosDer = useRef<(THREE.Group | null)[]>([]);

  const espacioDe = useRef(new Map<number, number>());
  const libres = useRef<number[]>(Array.from({ length: MAX_PEATONES }, (_, i) => i));
  const faseCaminata = useRef<number[]>(new Array(MAX_PEATONES).fill(0));

  useFrame((_, delta) => {
    const sim = simRef.current;
    if (!sim) return;

    const activos = new Set<number>();
    for (const ped of sim.pedestrians) {
      activos.add(ped.id);
      let slot = espacioDe.current.get(ped.id);
      if (slot === undefined) {
        slot = libres.current.pop();
        if (slot === undefined) continue;
        espacioDe.current.set(ped.id, slot);
        faseCaminata.current[slot] = Math.random();
        torsos.current[slot]?.color.set(
          PEDESTRIAN_COLORS[ped.color % PEDESTRIAN_COLORS.length]!
        );
      }

      const g = grupos.current[slot];
      if (!g) continue;

      const pose = pedestrianPose(ped);
      g.visible = true;
      g.position.set(pose.x, 0.08, pose.z);
      g.rotation.y = pose.rot;

      if (!ped.waiting) {
        faseCaminata.current[slot] = (faseCaminata.current[slot]! + delta * ped.speed * 12) % (Math.PI * 2);
        const p = faseCaminata.current[slot]!;
        const balanceo = Math.sin(p) * 0.42;

        if (piernasIzq.current[slot]) piernasIzq.current[slot]!.rotation.x = balanceo;
        if (piernasDer.current[slot]) piernasDer.current[slot]!.rotation.x = -balanceo;
        if (brazosIzq.current[slot]) brazosIzq.current[slot]!.rotation.x = -balanceo * 0.85;
        if (brazosDer.current[slot]) brazosDer.current[slot]!.rotation.x = balanceo * 0.85;
      } else {
        if (piernasIzq.current[slot]) piernasIzq.current[slot]!.rotation.x = 0;
        if (piernasDer.current[slot]) piernasDer.current[slot]!.rotation.x = 0;
        if (brazosIzq.current[slot]) brazosIzq.current[slot]!.rotation.x = 0;
        if (brazosDer.current[slot]) brazosDer.current[slot]!.rotation.x = 0;
      }
    }

    for (const [id, slot] of espacioDe.current) {
      if (!activos.has(id)) {
        espacioDe.current.delete(id);
        libres.current.push(slot);
        const g = grupos.current[slot];
        if (g) g.visible = false;
      }
    }
  });

  return (
    <group>
      {Array.from({ length: MAX_PEATONES }, (_, i) => (
        <EspacioPeaton
          key={i}
          index={i}
          grupos={grupos}
          torsos={torsos}
          piernasIzq={piernasIzq}
          piernasDer={piernasDer}
          brazosIzq={brazosIzq}
          brazosDer={brazosDer}
        />
      ))}
    </group>
  );
}

