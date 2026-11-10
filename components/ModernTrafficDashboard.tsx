"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { simRef } from "@/components/TrafficScene";
import { queueLen } from "@/lib/traffic-sim";
import {
  EstadoTrafico,
  ModoVista,
  ModoDia,
  BarraSuperior,
  TarjetaVision,
  TarjetaEspera,
  TarjetaFlujo,
  PanelMovil,
  MenuCapas,
  BotonRecuadros,
} from "./panel";

// Dynamic import with SSR disabled for Three.js Canvas
const TrafficScene = dynamic(() => import("@/components/TrafficScene"), {
  ssr: false,
  loading: () => (
    <div className="fixed inset-0 flex items-center justify-center bg-white z-0">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 rounded-full border-2 border-[#f95721] border-t-transparent animate-spin" />
        <span className="text-xs font-mono text-zinc-500 uppercase tracking-widest">
          Cargando Simulación 3D...
        </span>
      </div>
    </div>
  ),
});

// Dynamic import for YOLO Background Camera view (replaces 3D scene in background)
const YoloBackgroundCamera = dynamic(() => import("@/components/YoloBackgroundCamera"), {
  ssr: false,
  loading: () => (
    <div className="fixed inset-0 flex items-center justify-center bg-zinc-950 z-0">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 rounded-full border-2 border-[#f95721] border-t-transparent animate-spin" />
        <span className="text-xs font-mono text-zinc-400 uppercase tracking-widest">
          Iniciando Cámara YOLO26n...
        </span>
      </div>
    </div>
  ),
});

export default function ModernTrafficDashboard() {
  const [s, setS] = useState<EstadoTrafico>({
    detected: 544,
    onScreen: 18,
    queues: [4, 6, 3, 5],
    green: "NS",
    yellow: false,
    allRed: false,
    flow: 2.4,
    hist: [14, 16, 18, 17, 19, 18],
    pedestrians: 2,
    pedestriansWaiting: 3,
    pedestrianGreen: true,
  });

  const [viewMode, setViewMode] = useState<ModoVista>("perspective");
  const [isPaused, setIsPaused] = useState(false);
  const [showDetections, setShowDetections] = useState(true);
  const [showLayerDrawer, setShowLayerDrawer] = useState(false);
  const [dayMode, setDayMode] = useState<ModoDia>("day");
  const [autoRotate, setAutoRotate] = useState(true);

  // Mobile: Bottom Sheet is collapsed by default so 3D intersection is 100% visible
  const [mobileExpanded, setMobileExpanded] = useState(false);
  const [mobileTab, setMobileTab] = useState<"vision" | "espera" | "flujo">("espera");

  useEffect(() => {
    const hist: number[] = [];
    let lastPassed = 480;
    let flowAvg = 2.4;

    const id = setInterval(() => {
      const sim = simRef.current;
      if (!sim) return;

      const passedDelta = sim.passed - lastPassed;
      lastPassed = sim.passed;
      flowAvg += (passedDelta * 4 - flowAvg) * 0.15;
      hist.push(sim.cars.length);
      if (hist.length > 40) hist.shift();

      setS({
        detected: sim.detected,
        onScreen: sim.cars.length,
        queues: [0, 1, 2, 3].map((l) => queueLen(sim, l)),
        green: sim.green,
        yellow: sim.yellow,
        allRed: sim.allRed,
        flow: Math.max(0, flowAvg),
        hist: [...hist],
        pedestrians: sim.pedestrians.filter((p) => !p.waiting).length,
        pedestriansWaiting: sim.pedestrians.filter((p) => p.waiting).length,
        pedestrianGreen: sim.green === "EW" ? sim.pedestrianGreenNS : sim.pedestrianGreenEW,
      });
    }, 250);

    return () => clearInterval(id);
  }, []);

  const totalWaiting = s.queues.reduce((a, b) => a + b, 0);

  // Compute smooth flow percentage
  const flowPercent = Math.max(
    35,
    Math.min(94, Math.round(58 + s.flow * 3.5 - totalWaiting * 1.2))
  );

  return (
    <div
      className={`relative min-h-screen w-full overflow-hidden select-none transition-colors duration-500 ${
        viewMode === "camera" || dayMode === "night"
          ? "bg-[#0d1511]"
          : dayMode === "sunset"
          ? "bg-[#c4b0ae]"
          : "bg-[#dfe6e1]"
      }`}
    >
      {/* ── Capa de Fondo: Escena 3D Three.js o Cámara YOLO ── */}
      {viewMode !== "camera" ? (
        <TrafficScene
          dashboard={true}
          detections={showDetections}
          paused={isPaused}
          overhead={viewMode === "overhead"}
          dayMode={dayMode}
          autoRotate={autoRotate}
        />
      ) : (
        <YoloBackgroundCamera
          onDetections={(count) => {
            setS((prev) => ({
              ...prev,
              onScreen: count,
            }));
          }}
        />
      )}

      {/* ── Barra Superior de Navegación y Controles ── */}
      <BarraSuperior
        modoDia={dayMode}
        alCambiarModoDia={setDayMode}
        giroAutomatico={autoRotate}
        alCambiarGiroAutomatico={setAutoRotate}
        modoVista={viewMode}
        alCambiarModoVista={setViewMode}
        estaPausado={isPaused}
        alAlternarPausa={() => setIsPaused((p) => !p)}
        alAlternarCapas={() => setShowLayerDrawer((v) => !v)}
      />

      {/* ── Tarjetas Flotantes en Escritorio (Desktop HUD Izquierda) ── */}
      <div
        className={`hidden md:flex fixed top-24 left-6 lg:left-8 z-20 flex-col gap-3 pointer-events-auto w-[250px] lg:w-[270px] select-text transition-all duration-300 ${
          viewMode === "camera"
            ? "opacity-0 pointer-events-none -translate-x-4"
            : "opacity-100 translate-x-0"
        }`}
      >
        <TarjetaVision s={s} />
        <TarjetaEspera s={s} totalEsperando={totalWaiting} />
      </div>

      {/* ── Tarjeta Flotante en Escritorio (Desktop HUD Derecha: Flujo) ── */}
      <div
        className={`hidden md:block fixed top-24 right-6 lg:right-8 z-20 pointer-events-auto w-[250px] lg:w-[270px] select-text transition-all duration-300 ${
          viewMode === "camera"
            ? "opacity-0 pointer-events-none translate-x-4"
            : "opacity-100 translate-x-0"
        }`}
      >
        <TarjetaFlujo s={s} porcentajeFlujo={flowPercent} />
      </div>

      {/* ── Panel Móvil (Inferior Desplegable) ── */}
      <PanelMovil
        s={s}
        totalEsperando={totalWaiting}
        porcentajeFlujo={flowPercent}
        pestanaMovil={mobileTab}
        alCambiarPestana={setMobileTab}
        expandido={mobileExpanded}
        alAlternarExpansion={() => setMobileExpanded((v) => !v)}
      />

      {/* ── Botón Flotante Recuadros (Modo 3D) ── */}
      <BotonRecuadros
        mostrar={viewMode !== "camera"}
        mostrarRecuadros={showDetections}
        alAlternarRecuadros={() => setShowDetections((prev) => !prev)}
      />

      {/* ── Menú Drawer: Capas y Opciones ── */}
      <MenuCapas
        mostrar={showLayerDrawer}
        alCerrar={() => setShowLayerDrawer(false)}
        mostrarRecuadros={showDetections}
        alAlternarRecuadros={() => setShowDetections((v) => !v)}
        modoVista={viewMode}
        alCambiarModoVista={setViewMode}
        estaPausado={isPaused}
        alAlternarPausa={() => setIsPaused((p) => !p)}
        giroAutomatico={autoRotate}
        alCambiarGiroAutomatico={setAutoRotate}
        modoDia={dayMode}
        alCambiarModoDia={setDayMode}
      />
    </div>
  );
}
