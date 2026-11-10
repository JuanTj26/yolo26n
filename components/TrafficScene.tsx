"use client";

import { useRef } from "react";
import { Canvas } from "@react-three/fiber";
import * as THREE from "three";
import { createSim, type Sim } from "@/lib/traffic-sim";
import type { DayMode } from "./escena/tipos";
import AmbienteEscena from "./escena/AmbienteEscena";
import RedVial from "./escena/RedVial";
import EdificiosCiudad from "./escena/EdificiosCiudad";
import FarolasAlumbrado from "./escena/FarolasAlumbrado";
import Semaforos from "./escena/Semaforos";
import FlotaVehicular, { MAX_AUTOS } from "./escena/FlotaVehicular";
import Peatones from "./escena/Peatones";
import CamaraOrbital, { CUADROS_CLAVE } from "./escena/CamaraOrbital";
import CajasDeteccion from "./escena/CajasDeteccion";
import { CapaAnalisis, CapaLiquida, EscenaLista } from "./escena/CapasHistoria";

export type { DayMode };
export const simRef: { current: Sim | null } = { current: null };

export default function TrafficScene({
  dashboard = false,
  detections = true,
  paused = false,
  overhead = false,
  dayMode = "day",
  autoRotate = true,
}: {
  dashboard?: boolean;
  detections?: boolean;
  paused?: boolean;
  overhead?: boolean;
  dayMode?: DayMode;
  autoRotate?: boolean;
}) {
  if (!simRef.current) simRef.current = createSim();

  const wrap = useRef<HTMLDivElement>(null);
  const canvasDetecciones = useRef<HTMLCanvasElement>(null);
  const gruposAutos = useRef<(THREE.Group | null)[]>([]);
  const gruposPeatones = useRef<(THREE.Group | null)[]>([]);
  const tiposEspacio = useRef<string[]>(new Array(MAX_AUTOS).fill("sedan"));

  return (
    <div ref={wrap} className="fixed inset-0 z-0">
      <Canvas
        shadows="percentage"
        flat
        dpr={[1, 1.5]}
        camera={{ fov: 32, near: 1, far: 320, position: CUADROS_CLAVE[0]!.pos }}
        gl={{ antialias: true, powerPreference: "high-performance" }}
        onCreated={({ gl }) => {
          gl.shadowMap.enabled = true;
          gl.shadowMap.type = THREE.PCFShadowMap;
        }}
      >
        {/* ── Iluminación Ambiental, Niebla, Sol y Suelo Infinito ── */}
        <AmbienteEscena modo={dayMode} />

        {/* ── Infraestructura Urbana ── */}
        <RedVial />
        <EdificiosCiudad modo={dayMode} />
        <FarolasAlumbrado modo={dayMode} />
        <Semaforos simRef={simRef} />

        {/* ── Vehículos y Peatones en Movimiento ── */}
        <FlotaVehicular
          grupos={gruposAutos}
          tiposEspacio={tiposEspacio}
          dashboard={dashboard}
          pausado={paused}
          simRef={simRef}
        />
        <Peatones grupos={gruposPeatones} simRef={simRef} />

        {/* ── Capas de Modo Presentación / Historia ── */}
        {!dashboard && <CapaAnalisis />}
        {!dashboard && <CapaLiquida />}

        {/* ── Cámara Orbital Cinemática 360° ── */}
        <CamaraOrbital dashboard={dashboard} vistaAerea={overhead} giroAutomatico={autoRotate} />

        {/* ── Recuadros de Detección YOLO AI ── */}
        <CajasDeteccion
          gruposAutos={gruposAutos}
          gruposPeatones={gruposPeatones}
          tiposEspacio={tiposEspacio}
          canvas={canvasDetecciones}
          dashboard={dashboard}
          detecciones={detections}
        />

        <EscenaLista alEstarLista={() => wrap.current?.setAttribute("data-scene-ready", "")} />
      </Canvas>

      {/* Canvas 2D superior para recuadros de visión artificial */}
      <canvas
        ref={canvasDetecciones}
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 h-full w-full"
      />
    </div>
  );
}
