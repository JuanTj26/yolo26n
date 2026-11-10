"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three-stdlib";
import { LANES, axisOf } from "@/lib/traffic-sim";
import type { SimRefHolder } from "./tipos";

const ROJO = new THREE.Color("#ff3b30");
const VERDE = new THREE.Color("#22c55e");
const AMBAR = new THREE.Color("#ffb020");
const APAGADO = new THREE.Color("#1a1b1e");

const POSTES: [number, number][] = [
  [5.6, 8.6],
  [8.6, -5.6],
  [-5.6, -8.6],
  [-8.6, 5.6],
];

const GEO_POSTE = new THREE.CylinderGeometry(0.08, 0.1, 4.4, 10);
const GEO_CAJA = new RoundedBoxGeometry(0.6, 1.7, 0.45, 2, 0.12);
const GEO_LENTE = new THREE.SphereGeometry(0.17, 14, 10);
const MAT_POSTE = new THREE.MeshStandardMaterial({ color: "#1c1d20", metalness: 0.6, roughness: 0.35 });
const MAT_CAJA = new THREE.MeshStandardMaterial({ color: "#141517", roughness: 0.4 });

export default function Semaforos({ simRef }: { simRef: SimRefHolder }) {
  const lentes = useRef<THREE.MeshStandardMaterial[][]>([[], [], [], []]);
  const brillos = useRef<THREE.PointLight[]>([]);

  useFrame(() => {
    const sim = simRef.current;
    if (!sim) return;
    for (let l = 0; l < 4; l++) {
      const mio = sim.green === axisOf(l);
      const estado = sim.allRed ? 0 : mio ? (sim.yellow ? 1 : 2) : 0; // 0 rojo, 1 ámbar, 2 verde
      const colores = [ROJO, AMBAR, VERDE] as const;
      lentes.current[l]?.forEach((mat, i) => {
        if (!mat) return;
        const encendida = i === estado;
        mat.emissive.copy(encendida ? colores[i]! : APAGADO);
        mat.emissiveIntensity = encendida ? 3.2 : 0;
        mat.color.copy(encendida ? colores[i]! : APAGADO);
      });
      const g = brillos.current[l];
      if (g) g.color.copy(colores[estado]!);
    }
  });

  return (
    <group>
      {POSTES.map(([x, z], l) => {
        const [dx, dz] = LANES[l]!;
        const rot = Math.atan2(-dx, -dz);
        return (
          <group key={l} position={[x, 0, z]} rotation-y={rot}>
            <mesh position-y={2.2} castShadow geometry={GEO_POSTE} material={MAT_POSTE} />
            <mesh position={[0, 4.6, 0]} castShadow geometry={GEO_CAJA} material={MAT_CAJA} />
            {[0, 1, 2].map((i) => (
              <mesh key={i} position={[0, 5.12 - i * 0.52, 0.24]} geometry={GEO_LENTE}>
                <meshStandardMaterial
                  ref={(m) => {
                    if (m) {
                      if (!lentes.current[l]) lentes.current[l] = [];
                      lentes.current[l]![i] = m;
                    }
                  }}
                  toneMapped={false}
                />
              </mesh>
            ))}
            <pointLight
              ref={(p) => {
                if (p) brillos.current[l] = p;
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

