"use client";

import { useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { story } from "@/lib/story";

export type CuadroClave = { p: number; pos: [number, number, number]; look: [number, number, number] };

export const CUADROS_CLAVE: CuadroClave[] = [
  { p: 0, pos: [28, 25, 28], look: [0, 0.8, 0] },
  { p: 0.12, pos: [24, 16, 26], look: [0, 0.8, 0] },
  { p: 0.27, pos: [38, 12, 10], look: [8, 0.8, -2] },
  { p: 0.49, pos: [0.01, 74, 9], look: [0, 0, 0] },
  { p: 0.69, pos: [-36, 30, 28], look: [2, 0, 0] },
  { p: 0.9, pos: [42, 24, -20], look: [0, 0, 0] },
  { p: 1, pos: [40, 26, -26], look: [0, 0, 0] },
];

export default function CamaraOrbital({
  dashboard = false,
  vistaAerea = false,
  giroAutomatico = true,
}: {
  dashboard?: boolean;
  vistaAerea?: boolean;
  giroAutomatico?: boolean;
}) {
  const { camera, size } = useThree();
  const pos = useMemo(() => new THREE.Vector3(...CUADROS_CLAVE[0]!.pos), []);
  const look = useMemo(() => new THREE.Vector3(0, 0.8, 0), []);
  const tp = useMemo(() => new THREE.Vector3(), []);
  const tl = useMemo(() => new THREE.Vector3(), []);

  useFrame(({ clock }, delta) => {
    const ct = clock.elapsedTime;

    if (giroAutomatico && dashboard) {
      if (vistaAerea) {
        // Órbita cenital suave (estilo vista desde arriba de la referencia)
        const radio = 14;
        const altura = 72;
        const angulo = ct * 0.12;
        tp.set(Math.sin(angulo) * radio, altura, Math.cos(angulo) * radio);
        tl.set(0, 0, 0);
      } else {
        // Giro orbital continuo panorámico 360° (estilo Glorieta del Coyote)
        const radio = 42;
        const altura = 26;
        const angulo = ct * 0.15;
        tp.set(Math.sin(angulo) * radio, altura, Math.cos(angulo) * radio);
        tl.set(0, 0.8, 0);
      }
      const k = 1 - Math.exp(-4.5 * Math.min(delta, 0.05));
      pos.lerp(tp, k);
      look.lerp(tl, k);
      camera.position.copy(pos);
      camera.lookAt(look);
    } else {
      const p = dashboard ? (vistaAerea ? 0.49 : 0) : story.p;
      let i = 0;
      while (i < CUADROS_CLAVE.length - 2 && p > CUADROS_CLAVE[i + 1]!.p) i++;
      const a = CUADROS_CLAVE[i]!;
      const b = CUADROS_CLAVE[i + 1]!;
      let t = Math.min(1, Math.max(0, (p - a.p) / (b.p - a.p)));
      t = t * t * (3 - 2 * t);
      tp.set(...a.pos).lerp(new THREE.Vector3(...b.pos), t);
      tl.set(...a.look).lerp(new THREE.Vector3(...b.look), t);
      const estrecho = size.width < size.height;
      if (estrecho) tp.sub(tl).multiplyScalar(1.55).add(tl);
      tp.x += Math.sin(ct * 0.12) * 1.2 + story.mouse.x * 2.2;
      tp.y += story.mouse.y * -1.2;
      tp.z += Math.cos(ct * 0.1) * 1.2;

      const k = 1 - Math.exp(-3.5 * Math.min(delta, 0.05));
      pos.lerp(tp, k);
      look.lerp(tl, k);
      camera.position.copy(pos);
      camera.lookAt(look);
    }
  });

  return null;
}
