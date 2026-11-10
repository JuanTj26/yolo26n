"use client";

import { Environment, Lightformer } from "@react-three/drei";
import * as THREE from "three";
import type { DayMode } from "./tipos";

export default function AmbienteEscena({ modo }: { modo: DayMode }) {
  return (
    <>
      {/* ── Modo Día (Inspirado en la paleta limpia del Coyote) ── */}
      {modo === "day" && (
        <>
          <color attach="background" args={["#dfe6e1"]} />
          <fog attach="fog" args={["#dfe6e1", 95, 360]} />
          <hemisphereLight args={["#ffffff", "#8a8a80", 1.0]} />
          <directionalLight
            position={[70, 100, 45]}
            intensity={1.0}
            color="#fff1dc"
            castShadow
            shadow-mapSize={[1024, 1024]}
            shadow-camera-left={-45}
            shadow-camera-right={45}
            shadow-camera-top={45}
            shadow-camera-bottom={-45}
            shadow-bias={-0.0004}
          />
          <Environment resolution={64} environmentIntensity={0.5}>
            <Lightformer intensity={1.8} position={[0, 10, 0]} rotation-x={Math.PI / 2} scale={[20, 20, 1]} />
          </Environment>
        </>
      )}

      {/* ── Modo Atardecer (Tono exacto 0xc4b0ae con cielo y niebla melocotón cálido) ── */}
      {modo === "sunset" && (
        <>
          <color attach="background" args={["#c4b0ae"]} />
          <fog attach="fog" args={["#c4b0ae", 90, 340]} />
          <hemisphereLight args={["#ffd3b0", "#5a4038", 0.9]} />
          <directionalLight
            position={[60, 45, 30]}
            intensity={1.25}
            color="#ff9a5a"
            castShadow
            shadow-mapSize={[1024, 1024]}
            shadow-camera-left={-45}
            shadow-camera-right={45}
            shadow-camera-top={45}
            shadow-camera-bottom={-45}
            shadow-bias={-0.0004}
          />
          <Environment resolution={64} environmentIntensity={0.4}>
            <Lightformer intensity={1.5} position={[0, 10, 0]} color="#ff8855" rotation-x={Math.PI / 2} scale={[20, 20, 1]} />
          </Environment>
        </>
      )}

      {/* ── Modo Noche (Tono exacto 0x0d1511 pizarra oscura con luz lunar suave) ── */}
      {modo === "night" && (
        <>
          <color attach="background" args={["#0d1511"]} />
          <fog attach="fog" args={["#0d1511", 90, 340]} />
          <hemisphereLight args={["#304050", "#0a100d", 0.45]} />
          <directionalLight
            position={[40, 70, 30]}
            intensity={0.25}
            color="#88aacc"
            castShadow
            shadow-mapSize={[1024, 1024]}
            shadow-camera-left={-45}
            shadow-camera-right={45}
            shadow-camera-top={45}
            shadow-camera-bottom={-45}
            shadow-bias={-0.0004}
          />
          <Environment resolution={64} environmentIntensity={0.12}>
            <Lightformer intensity={0.4} position={[0, 10, 0]} color="#335588" rotation-x={Math.PI / 2} scale={[20, 20, 1]} />
          </Environment>
        </>
      )}

      {/* Suelo plano infinito con colores idénticos a la referencia */}
      <mesh rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[600, 600]} />
        <meshStandardMaterial
          color={modo === "night" ? "#111b15" : modo === "sunset" ? "#77716e" : "#dfe6e1"}
          roughness={0.9}
        />
      </mesh>
    </>
  );
}
