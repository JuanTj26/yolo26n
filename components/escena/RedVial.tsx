"use client";

import { useMemo } from "react";
import * as THREE from "three";
import { START } from "@/lib/traffic-sim";

function useTexturaCarretera() {
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

export default function RedVial() {
  const tex = useTexturaCarretera();

  // Rayas peatonales tipo cebra centradas en ±6.4
  const rayasCebra = useMemo(() => {
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

  // Líneas blancas de alto a ±7.8
  const lineasAlto = useMemo(() => {
    return [
      { x: 2.0, z: 7.8, w: 4.4, d: 0.4 },   // Carril Sur
      { x: 7.8, z: -2.0, w: 0.4, d: 4.4 },  // Carril Este
      { x: -2.0, z: -7.8, w: 4.4, d: 0.4 }, // Carril Norte
      { x: -7.8, z: 2.0, w: 0.4, d: 4.4 },  // Carril Oeste
    ];
  }, []);

  // Banquetas de las 4 esquinas del cruce
  const banquetas = useMemo(() => {
    return [
      { x: 13, z: 13 },
      { x: -13, z: 13 },
      { x: 13, z: -13 },
      { x: -13, z: -13 },
    ];
  }, []);

  return (
    <group>
      {/* Avenida Norte-Sur */}
      <mesh rotation-x={-Math.PI / 2} position-y={0.06} receiveShadow>
        <planeGeometry args={[10, START * 2.4]} />
        {tex ? (
          <meshStandardMaterial map={tex} roughness={0.9} />
        ) : (
          <meshStandardMaterial color="#c4c6ca" roughness={0.9} />
        )}
      </mesh>

      {/* Avenida Este-Oeste */}
      <mesh rotation-x={-Math.PI / 2} rotation-z={Math.PI / 2} position-y={0.062} receiveShadow>
        <planeGeometry args={[10, START * 2.4]} />
        {tex ? (
          <meshStandardMaterial map={tex} roughness={0.9} />
        ) : (
          <meshStandardMaterial color="#c4c6ca" roughness={0.9} />
        )}
      </mesh>

      {/* Placa central de la intersección */}
      <mesh rotation-x={-Math.PI / 2} position-y={0.064} receiveShadow>
        <planeGeometry args={[10, 10]} />
        <meshStandardMaterial color="#c4c6ca" roughness={0.9} />
      </mesh>

      {/* 4 Banquetas esquineras */}
      {banquetas.map((sw, i) => (
        <mesh key={"sw-" + i} position={[sw.x, 0.08, sw.z]} receiveShadow>
          <boxGeometry args={[16, 0.05, 16]} />
          <meshStandardMaterial color="#dedfe2" roughness={0.7} />
        </mesh>
      ))}

      {/* Pasos peatonales de cebra */}
      {rayasCebra.map((s, i) => (
        <mesh key={"stripe-" + i} rotation-x={-Math.PI / 2} position={[s.x, 0.09, s.z]}>
          <planeGeometry args={[s.w, s.d]} />
          <meshBasicMaterial color="#ffffff" />
        </mesh>
      ))}

      {/* Líneas sólidas de alto vehicular */}
      {lineasAlto.map((sl, i) => (
        <mesh key={"stop-" + i} rotation-x={-Math.PI / 2} position={[sl.x, 0.092, sl.z]}>
          <planeGeometry args={[sl.w, sl.d]} />
          <meshBasicMaterial color="#ffffff" />
        </mesh>
      ))}
    </group>
  );
}

