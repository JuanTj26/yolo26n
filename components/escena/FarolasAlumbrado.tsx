"use client";

import { useMemo } from "react";
import * as THREE from "three";
import type { DayMode } from "./tipos";

interface PosicionFarola {
  x: number;
  z: number;
  rotY: number;
}

const POSICIONES_FAROLAS: PosicionFarola[] = [
  // 4 Esquinas del cruce
  { x: 7.2, z: 9.5, rotY: Math.PI / 2 },
  { x: -7.2, z: 9.5, rotY: -Math.PI / 2 },
  { x: 7.2, z: -9.5, rotY: Math.PI / 2 },
  { x: -7.2, z: -9.5, rotY: -Math.PI / 2 },

  // Avenida Norte
  { x: 6.2, z: -20, rotY: -Math.PI / 2 },
  { x: -6.2, z: -20, rotY: Math.PI / 2 },
  { x: 6.2, z: -34, rotY: -Math.PI / 2 },
  { x: -6.2, z: -34, rotY: Math.PI / 2 },

  // Avenida Sur
  { x: 6.2, z: 20, rotY: -Math.PI / 2 },
  { x: -6.2, z: 20, rotY: Math.PI / 2 },
  { x: 6.2, z: 34, rotY: -Math.PI / 2 },
  { x: -6.2, z: 34, rotY: Math.PI / 2 },

  // Avenida Este
  { x: 20, z: 6.2, rotY: 0 },
  { x: 20, z: -6.2, rotY: Math.PI },
  { x: 34, z: 6.2, rotY: 0 },
  { x: 34, z: -6.2, rotY: Math.PI },

  // Avenida Oeste
  { x: -20, z: 6.2, rotY: 0 },
  { x: -20, z: -6.2, rotY: Math.PI },
  { x: -34, z: 6.2, rotY: 0 },
  { x: -34, z: -6.2, rotY: Math.PI },
];

/* Geometrías estáticas */
const GEO_BASE = new THREE.CylinderGeometry(0.22, 0.28, 0.35, 10);
const GEO_POSTE = new THREE.CylinderGeometry(0.10, 0.13, 5.2, 8);
const GEO_BRAZO = new THREE.CylinderGeometry(0.06, 0.08, 1.6, 8);
const GEO_CABEZAL = new THREE.BoxGeometry(0.32, 0.14, 0.72);
const GEO_FOCO = new THREE.SphereGeometry(0.34, 12, 10);

const MAT_POSTE = new THREE.MeshLambertMaterial({
  color: 0x4a4f55,
});

/* Generador de textura radial idéntica a la referencia de Glorieta del Coyote */
function useTexturaResplandor() {
  return useMemo(() => {
    if (typeof document === "undefined") return null;
    const canvas = document.createElement("canvas");
    canvas.width = 64;
    canvas.height = 64;
    const g = canvas.getContext("2d")!;
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, "rgba(255,225,150,1)");
    gr.addColorStop(0.35, "rgba(255,200,110,.35)");
    gr.addColorStop(1, "rgba(255,200,110,0)");
    g.fillStyle = gr;
    g.fillRect(0, 0, 64, 64);
    const tex = new THREE.CanvasTexture(canvas);
    return tex;
  }, []);
}

export default function FarolasAlumbrado({ modo }: { modo: DayMode }) {
  const glowTex = useTexturaResplandor();
  const esNoche = modo === "night";
  const esAtardecer = modo === "sunset";
  const lucesActivas = esNoche || esAtardecer;

  // Material de la bombilla física del foco
  const matFoco = useMemo(() => {
    return new THREE.MeshBasicMaterial({
      color: esNoche ? 0xfff4d6 : esAtardecer ? 0xffe0b0 : 0xcfc9b0,
    });
  }, [esNoche, esAtardecer]);

  // Sprite material con mezcla aditiva como en la demo
  const matResplandor = useMemo(() => {
    if (!glowTex) return null;
    return new THREE.SpriteMaterial({
      map: glowTex,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      opacity: esNoche ? 0.95 : esAtardecer ? 0.65 : 0,
    });
  }, [glowTex, esNoche, esAtardecer]);

  const escalaGlow = esNoche ? 7.2 : esAtardecer ? 5.2 : 0;

  return (
    <group>
      {POSICIONES_FAROLAS.map((pos, idx) => (
        <group key={`farola-${idx}`} position={[pos.x, 0, pos.z]} rotation-y={pos.rotY}>
          {/* Base */}
          <mesh position={[0, 0.175, 0]} castShadow geometry={GEO_BASE} material={MAT_POSTE} />

          {/* Poste vertical */}
          <mesh position={[0, 2.7, 0]} castShadow geometry={GEO_POSTE} material={MAT_POSTE} />

          {/* Brazo superior curvado hacia la avenida */}
          <mesh
            position={[0, 5.4, 0.65]}
            rotation-x={Math.PI / 4}
            castShadow
            geometry={GEO_BRAZO}
            material={MAT_POSTE}
          />

          {/* Cabezal de la luminaria */}
          <mesh position={[0, 5.85, 1.25]} castShadow geometry={GEO_CABEZAL} material={MAT_POSTE} />

          {/* Foco esférico (bombilla) */}
          <mesh position={[0, 5.75, 1.25]} geometry={GEO_FOCO} material={matFoco} />

          {/* Halo Sprite luminoso (directamente en el foco, sin tocar el piso) */}
          {lucesActivas && matResplandor && (
            <sprite
              position={[0, 5.75, 1.25]}
              material={matResplandor}
              scale={[escalaGlow, escalaGlow, 1]}
            />
          )}
        </group>
      ))}
    </group>
  );
}
