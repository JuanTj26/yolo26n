"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import {
  Scan,
  Activity,
  ArrowUpRight,
  Pause,
  Play,
  Layers,
  X,
  Leaf,
  Sliders,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import { simRef } from "@/components/TrafficScene";
import { queueLen } from "@/lib/traffic-sim";
import Link from "next/link";

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

type Snap = {
  detected: number;
  onScreen: number;
  queues: number[];
  green: "NS" | "EW";
  yellow: boolean;
  allRed: boolean;
  flow: number;
  hist: number[];
  pedestrians: number;
  pedestriansWaiting: number;
  pedestrianGreen: boolean;
};

export default function ModernTrafficDashboard() {
  const [s, setS] = useState<Snap>({
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

  const [viewMode, setViewMode] = useState<"perspective" | "overhead">("perspective");
  const [isPaused, setIsPaused] = useState(false);
  const [showDetections, setShowDetections] = useState(true);
  const [showLayerDrawer, setShowLayerDrawer] = useState(false);

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
    <div className="relative min-h-screen w-full overflow-hidden bg-white select-none">
      {/* ── 3D Scene in background ── */}
      <TrafficScene
        dashboard={true}
        detections={showDetections}
        paused={isPaused}
        overhead={viewMode === "overhead"}
      />

      {/* ── Top Navbar ── */}
      <header className="fixed top-0 inset-x-0 z-30 px-3 py-2.5 sm:px-6 sm:py-4 flex items-center justify-between pointer-events-none gap-2">
        {/* Brand logo & title */}
        <div className="pointer-events-auto flex items-center gap-2">
          <Link
            href="/demo"
            className="flex items-center gap-2 group transition-transform hover:scale-105"
            title="Ir a Cámara YOLO26n"
          >
            <div className="flex items-center justify-center h-7 w-7 sm:h-8 sm:w-8 rounded-lg bg-[#f95721]/10 text-[#f95721] transition-colors group-hover:bg-[#f95721] group-hover:text-white flex-shrink-0">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-4 w-4 sm:h-5 sm:w-5"
              >
                <polygon points="3 11 22 2 13 21 11 13 3 11" />
              </svg>
            </div>
            <span className="text-lg sm:text-xl font-bold tracking-tight text-zinc-900 font-display">
              Tráfico
            </span>
          </Link>
        </div>

        {/* Center pill navigation */}
        <div className="pointer-events-auto bg-white/85 hover:bg-white backdrop-blur-xl border border-black/5 shadow-sm rounded-full p-1 flex items-center gap-1 transition-all">
          <button
            onClick={() => setViewMode("perspective")}
            className={`px-3 py-1 sm:px-4 sm:py-1.5 rounded-full text-[11px] sm:text-xs font-semibold transition-all ${
              viewMode === "perspective"
                ? "bg-[#18181b] text-white shadow-sm"
                : "text-zinc-600 hover:text-zinc-900"
            }`}
          >
            Inicio
          </button>
          <button
            onClick={() => setViewMode("overhead")}
            className={`px-3 py-1 sm:px-4 sm:py-1.5 rounded-full text-[11px] sm:text-xs font-semibold transition-all ${
              viewMode === "overhead"
                ? "bg-[#18181b] text-white shadow-sm"
                : "text-zinc-600 hover:text-zinc-900"
            }`}
          >
            Vista aérea
          </button>
        </div>

        {/* Right controls */}
        <div className="pointer-events-auto flex items-center gap-1.5 sm:gap-2.5">
          {/* Active status pill (hidden on mobile, visible from sm up) */}
          <div className="hidden sm:flex items-center gap-2 text-xs font-medium text-zinc-700 bg-white/85 backdrop-blur-md border border-black/5 rounded-full px-3.5 py-1.5 shadow-sm">
            <span className="relative flex h-2 w-2">
              {!isPaused && (
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              )}
              <span
                className={`relative inline-flex rounded-full h-2 w-2 ${
                  isPaused ? "bg-amber-500" : "bg-emerald-500"
                }`}
              />
            </span>
            <span>{isPaused ? "Pausado" : "Ciudad activa"}</span>
          </div>

          {/* Pause / Play toggle */}
          <button
            onClick={() => setIsPaused((p) => !p)}
            className="h-8 w-8 sm:h-9 sm:w-9 rounded-full bg-white/90 hover:bg-white backdrop-blur-md border border-black/5 shadow-sm flex items-center justify-center text-zinc-800 transition-all hover:scale-105 active:scale-95"
            title={isPaused ? "Reanudar simulación" : "Pausar simulación"}
          >
            {isPaused ? <Play className="h-3.5 w-3.5 sm:h-4 sm:w-4 fill-zinc-800" /> : <Pause className="h-3.5 w-3.5 sm:h-4 sm:w-4" />}
          </button>

          {/* Layer switcher */}
          <button
            onClick={() => setShowLayerDrawer((prev) => !prev)}
            className={`h-8 w-8 sm:h-9 sm:w-9 rounded-full bg-white/90 hover:bg-white backdrop-blur-md border border-black/5 shadow-sm flex items-center justify-center transition-all hover:scale-105 active:scale-95 ${
              showLayerDrawer ? "text-[#f95721] ring-2 ring-[#f95721]/30" : "text-zinc-800"
            }`}
            title="Capas y opciones"
          >
            <Layers className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          </button>
        </div>
      </header>

      {/* ───────────────────────────────────────────────────────────
          DESKTOP VIEW (Visible on >= md screens)
          Left column: Visión conectada + En espera
          Right column: Flujo de la ciudad
      ─────────────────────────────────────────────────────────── */}
      <div className="hidden md:flex fixed top-24 left-6 lg:left-8 z-20 flex-col gap-3 pointer-events-auto w-[250px] lg:w-[270px]">
        {/* Desktop Card 1: Visión conectada */}
        <div className="bg-[#15171a]/95 backdrop-blur-xl border border-white/10 rounded-2xl p-5 text-white shadow-2xl transition-all duration-300 select-text hover:border-white/20">
          <div className="flex items-center justify-between text-xs text-zinc-400">
            <div className="flex items-center gap-1.5 font-medium text-zinc-200">
              <Scan className="h-3.5 w-3.5 text-[#f95721]" />
              <span>Visión conectada</span>
            </div>
            <Link href="/demo" title="Ver modelo YOLO en video/cámara">
              <ArrowUpRight className="h-3.5 w-3.5 text-zinc-400 hover:text-white transition-colors" />
            </Link>
          </div>

          <div className="mt-2 flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-[#f95721] ring-2 ring-[#f95721]/30" />
            <span className="h-2 w-2 rounded-full border border-zinc-600 bg-transparent" />
            <span className="h-2 w-2 rounded-full border border-zinc-600 bg-transparent" />
          </div>

          <div className="mt-2.5 flex items-baseline gap-3">
            <span className="text-4xl lg:text-5xl font-bold tracking-tight text-white font-mono">
              {s.detected}
            </span>
            <div className="h-7 w-[1px] bg-zinc-700/80" />
            <span className="text-[11px] leading-tight text-zinc-400 font-medium max-w-[70px]">
              Vehículos detectados
            </span>
          </div>

          <div className="mt-3 flex items-center justify-between text-[10px] font-mono tracking-wider text-zinc-400 uppercase border-t border-zinc-800/80 pt-2">
            <span>YOLO26n</span>
            <span className="flex items-center gap-1 text-emerald-400 font-semibold">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              {s.onScreen} EN ESCENA
            </span>
          </div>
        </div>

        {/* Desktop Card 2: En espera */}
        <div className="bg-white/95 backdrop-blur-xl border border-black/5 rounded-2xl p-5 text-zinc-900 shadow-xl transition-all duration-300 select-text">
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-zinc-900 tracking-tight">En espera</span>
            <Activity className="h-4 w-4 text-zinc-500" />
          </div>

          <div className="my-1.5 flex justify-center">
            <div className="relative flex items-center justify-center">
              <svg className="w-22 h-22 -rotate-90">
                <circle cx="44" cy="44" r="34" stroke="#f1f1f4" strokeWidth="6" fill="none" />
                <circle
                  cx="44"
                  cy="44"
                  r="34"
                  stroke="#f95721"
                  strokeWidth="6"
                  fill="none"
                  strokeLinecap="round"
                  strokeDasharray={213.6}
                  strokeDashoffset={213.6 * (1 - Math.min(1, Math.max(0.12, totalWaiting / 24)))}
                  style={{ transition: "stroke-dashoffset 0.6s ease" }}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="text-2xl font-bold tracking-tight text-zinc-900 leading-none">
                  {totalWaiting}
                </span>
                <span className="text-[10px] text-zinc-500 font-medium mt-0.5">vehículos</span>
              </div>
            </div>
          </div>

          <div className="mt-2.5 pt-2.5 border-t border-zinc-100 grid grid-cols-2 gap-1.5">
            {[
              { dir: "Norte", sem: "S1", q: s.queues[0] ?? 0, axis: "NS" },
              { dir: "Este",  sem: "S2", q: s.queues[1] ?? 0, axis: "EW" },
              { dir: "Sur",   sem: "S3", q: s.queues[2] ?? 0, axis: "NS" },
              { dir: "Oeste", sem: "S4", q: s.queues[3] ?? 0, axis: "EW" },
            ].map((item, idx) => {
              const isGreen = !s.allRed && s.green === item.axis;
              const isYellow = isGreen && s.yellow;
              const lightCls = s.allRed
                ? "bg-red-500"
                : isGreen
                ? isYellow
                  ? "bg-amber-400 shadow-[0_0_6px_#fbbf24]"
                  : "bg-emerald-500 shadow-[0_0_6px_#10b981]"
                : "bg-red-500";

              return (
                <div
                  key={idx}
                  className="bg-zinc-50/90 rounded-xl p-2 border border-black/5 flex items-center justify-between"
                >
                  <div className="flex items-center gap-1.5">
                    <span className={`h-2 w-2 rounded-full flex-shrink-0 transition-all ${lightCls}`} />
                    <div className="flex flex-col">
                      <span className="text-[11px] font-semibold text-zinc-800 leading-tight">
                        {item.dir}
                      </span>
                      <span className="text-[9px] font-mono text-zinc-400">
                        {item.sem}
                      </span>
                    </div>
                  </div>
                  <span className="text-xs font-bold font-mono text-zinc-900 bg-white px-1.5 py-0.5 rounded-md border border-black/5 shadow-2xs">
                    {item.q}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="mt-2.5 flex items-center gap-1.5 text-xs font-medium text-zinc-700">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            <span>Cruce adaptativo</span>
          </div>

          {/* Pedestrian status row */}
          <div className="mt-1.5 flex items-center justify-between text-xs font-medium text-zinc-600 bg-zinc-50 rounded-lg px-2.5 py-1.5 border border-black/5">
            <div className="flex items-center gap-1.5">
              {/* Walking person SVG icon */}
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5 text-blue-500">
                <circle cx="12" cy="5" r="1.5" fill="currentColor" stroke="none"/>
                <path d="M9 10l1.5 4L9 18" /><path d="M15 10l-1.5 4L15 18" /><path d="M9.5 10h5" />
              </svg>
              <span>Peatones</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span
                className={`h-2 w-2 rounded-full transition-colors ${
                  s.pedestrianGreen
                    ? "bg-blue-400 shadow-[0_0_6px_#60a5fa]"
                    : "bg-zinc-400"
                }`}
              />
              <span className="font-mono font-bold text-zinc-900">{s.pedestrians}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Desktop Card 3: Flujo de la ciudad */}
      <div className="hidden md:block fixed top-24 right-6 lg:right-8 z-20 pointer-events-auto w-[250px] lg:w-[270px] select-text">
        <div className="bg-[#15171a]/95 backdrop-blur-xl border border-white/10 rounded-2xl p-5 text-white shadow-2xl transition-all duration-300 hover:border-white/20">
          <div className="flex items-center justify-between text-xs text-zinc-400">
            <span className="font-medium text-zinc-200">Flujo de la ciudad</span>
          </div>

          <div className="mt-2.5 inline-flex items-center justify-center h-6 w-6 rounded-full bg-[#f95721]/20 text-[#f95721]">
            <Leaf className="h-3.5 w-3.5" />
          </div>

          <div className="mt-1 text-4xl font-bold tracking-tight text-white font-mono">
            {flowPercent}%
          </div>

          <div className="mt-2.5 h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[#f95721] to-[#ff7e36] rounded-full transition-all duration-500"
              style={{ width: `${flowPercent}%` }}
            />
          </div>

          <div className="mt-3 text-[11px] text-zinc-400 font-medium">Vehículos en movimiento</div>
        </div>
      </div>

      {/* ───────────────────────────────────────────────────────────
          MOBILE VIEW (Only on screens < md)
          1. 3D view is completely open and unobstructed!
          2. Bottom compact HUD capsule (doesn't block roads or cars)
          3. Tap expands into bottom sheet with details
      ─────────────────────────────────────────────────────────── */}
      <div className="md:hidden fixed bottom-3 inset-x-3 z-30 pointer-events-auto">
        {/* Expanded detail card on mobile (slides up when tapped) */}
        {mobileExpanded && (
          <div className="mb-2 bg-white/95 backdrop-blur-xl border border-black/10 rounded-2xl p-4 shadow-2xl animate-in slide-in-from-bottom-3 duration-200">
            <div className="flex items-center justify-between pb-2 border-b border-zinc-100">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setMobileTab("vision")}
                  className={`px-2.5 py-1 rounded-full text-xs font-semibold transition-all ${
                    mobileTab === "vision"
                      ? "bg-[#18181b] text-white"
                      : "text-zinc-600 hover:text-zinc-900 bg-zinc-100"
                  }`}
                >
                  Visión
                </button>
                <button
                  onClick={() => setMobileTab("espera")}
                  className={`px-2.5 py-1 rounded-full text-xs font-semibold transition-all ${
                    mobileTab === "espera"
                      ? "bg-[#18181b] text-white"
                      : "text-zinc-600 hover:text-zinc-900 bg-zinc-100"
                  }`}
                >
                  En espera
                </button>
                <button
                  onClick={() => setMobileTab("flujo")}
                  className={`px-2.5 py-1 rounded-full text-xs font-semibold transition-all ${
                    mobileTab === "flujo"
                      ? "bg-[#18181b] text-white"
                      : "text-zinc-600 hover:text-zinc-900 bg-zinc-100"
                  }`}
                >
                  Flujo
                </button>
              </div>

              <button
                onClick={() => setMobileExpanded(false)}
                className="h-7 w-7 rounded-full bg-zinc-100 flex items-center justify-center text-zinc-600"
                title="Minimizar"
              >
                <ChevronDown className="h-4 w-4" />
              </button>
            </div>

            {/* Tab content: Visión */}
            {mobileTab === "vision" && (
              <div className="mt-3 flex items-center justify-between bg-zinc-900 text-white rounded-xl p-3">
                <div>
                  <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400">
                    Vehículos detectados
                  </span>
                  <div className="text-3xl font-bold font-mono">{s.detected}</div>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-emerald-400">
                    {s.onScreen} en escena
                  </span>
                  <div className="text-xs text-zinc-400 font-mono">YOLO26n</div>
                </div>
              </div>
            )}

            {/* Tab content: En espera */}
            {mobileTab === "espera" && (
              <div className="mt-2.5 space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold text-zinc-800">
                  <span>Total en espera: <strong className="text-[#f95721] font-mono">{totalWaiting} autos</strong></span>
                  <span className="text-[10px] text-emerald-600 flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Cruce adaptativo
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  {[
                    { dir: "Norte", sem: "S1", q: s.queues[0] ?? 0, axis: "NS" },
                    { dir: "Este",  sem: "S2", q: s.queues[1] ?? 0, axis: "EW" },
                    { dir: "Sur",   sem: "S3", q: s.queues[2] ?? 0, axis: "NS" },
                    { dir: "Oeste", sem: "S4", q: s.queues[3] ?? 0, axis: "EW" },
                  ].map((item, idx) => {
                    const isGreen = !s.allRed && s.green === item.axis;
                    const isYellow = isGreen && s.yellow;
                    const lightCls = s.allRed
                      ? "bg-red-500"
                      : isGreen
                      ? isYellow
                        ? "bg-amber-400 shadow-[0_0_6px_#fbbf24]"
                        : "bg-emerald-500 shadow-[0_0_6px_#10b981]"
                      : "bg-red-500";

                    return (
                      <div
                        key={idx}
                        className="bg-zinc-50 rounded-lg p-1.5 border border-black/5 flex items-center justify-between"
                      >
                        <div className="flex items-center gap-1.5">
                          <span className={`h-2 w-2 rounded-full flex-shrink-0 ${lightCls}`} />
                          <span className="text-[11px] font-medium text-zinc-800">{item.dir} ({item.sem})</span>
                        </div>
                        <span className="text-xs font-bold font-mono text-zinc-900 bg-white px-1.5 py-0.5 rounded border border-black/5">
                          {item.q}
                        </span>
                      </div>
                    );
                  })}
                </div>
                {/* Mobile pedestrian row */}
                <div className="mt-2 flex items-center justify-between bg-blue-50 rounded-lg px-2.5 py-1.5 border border-blue-100">
                  <div className="flex items-center gap-1.5 text-[11px] font-medium text-blue-700">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5">
                      <circle cx="12" cy="5" r="1.5" fill="currentColor" stroke="none"/>
                      <path d="M9 10l1.5 4L9 18" /><path d="M15 10l-1.5 4L15 18" /><path d="M9.5 10h5" />
                    </svg>
                    <span>Peatones cruzando</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className={`h-2 w-2 rounded-full transition-colors ${s.pedestrianGreen ? "bg-blue-400 shadow-[0_0_5px_#60a5fa]" : "bg-zinc-400"}`} />
                    <span className="text-xs font-bold font-mono text-blue-900">{s.pedestrians}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Tab content: Flujo */}
            {mobileTab === "flujo" && (
              <div className="mt-3 bg-zinc-900 text-white rounded-xl p-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-zinc-300">Fluidez del tráfico</span>
                  <span className="text-2xl font-bold font-mono text-[#f95721]">{flowPercent}%</span>
                </div>
                <div className="mt-2 h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-[#f95721] to-[#ff7e36] rounded-full"
                    style={{ width: `${flowPercent}%` }}
                  />
                </div>
                <div className="mt-2 text-[10px] text-zinc-400">Vehículos en movimiento fluido</div>
              </div>
            )}
          </div>
        )}

        {/* ── Compact Bottom Capsule Bar (Clean 1-line HUD) ── */}
        <div className="bg-white/95 backdrop-blur-xl border border-black/10 rounded-full px-3 py-2 shadow-xl flex items-center justify-between gap-1">
          {/* Quick chip 1: Visión */}
          <button
            onClick={() => {
              setMobileTab("vision");
              setMobileExpanded((e) => (mobileTab === "vision" ? !e : true));
            }}
            className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-[11px] font-medium transition-all ${
              mobileExpanded && mobileTab === "vision" ? "bg-zinc-900 text-white" : "text-zinc-700 hover:bg-zinc-100"
            }`}
          >
            <Scan className="h-3 w-3 text-[#f95721]" />
            <span className="font-mono font-bold">{s.detected}</span>
          </button>

          <div className="h-4 w-[1px] bg-zinc-200" />

          {/* Quick chip 2: En espera */}
          <button
            onClick={() => {
              setMobileTab("espera");
              setMobileExpanded((e) => (mobileTab === "espera" ? !e : true));
            }}
            className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-[11px] font-medium transition-all ${
              mobileExpanded && mobileTab === "espera" ? "bg-zinc-900 text-white" : "text-zinc-700 hover:bg-zinc-100"
            }`}
          >
            <Activity className="h-3 w-3 text-emerald-500" />
            <span className="font-mono font-bold">{totalWaiting}</span>
            <span className="text-[10px] text-zinc-500 hidden xs:inline">espera</span>
          </button>

          <div className="h-4 w-[1px] bg-zinc-200" />

          {/* Quick chip 3: Flujo */}
          <button
            onClick={() => {
              setMobileTab("flujo");
              setMobileExpanded((e) => (mobileTab === "flujo" ? !e : true));
            }}
            className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-[11px] font-medium transition-all ${
              mobileExpanded && mobileTab === "flujo" ? "bg-zinc-900 text-white" : "text-zinc-700 hover:bg-zinc-100"
            }`}
          >
            <Leaf className="h-3 w-3 text-[#f95721]" />
            <span className="font-mono font-bold">{flowPercent}%</span>
          </button>

          {/* Chevron expand/collapse toggle */}
          <button
            onClick={() => setMobileExpanded((e) => !e)}
            className="h-6 w-6 rounded-full bg-zinc-100 flex items-center justify-center text-zinc-600 transition-colors"
            title={mobileExpanded ? "Ocultar panel" : "Ver detalles"}
          >
            {mobileExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>

      {/* ── Switch YOLO26n (Responsive positioning) ── */}
      <div className="fixed bottom-16 right-3 md:bottom-6 md:right-6 z-20 pointer-events-auto">
        <button
          onClick={() => setShowDetections((prev) => !prev)}
          className="flex items-center gap-2 sm:gap-3 bg-white/95 hover:bg-white backdrop-blur-md border border-black/10 shadow-lg rounded-full px-3 py-1.5 sm:px-4 sm:py-2 text-zinc-800 transition-all hover:shadow-xl active:scale-95"
        >
          <Scan className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-[#f95721]" />
          <span className="text-[11px] sm:text-xs font-semibold tracking-tight">Recuadros YOLO26n</span>
          <div
            className={`w-8 h-4.5 sm:w-9 sm:h-5 rounded-full transition-colors p-0.5 flex items-center ${
              showDetections ? "bg-[#38bdf8]" : "bg-zinc-300"
            }`}
          >
            <div
              className={`bg-white w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-full shadow-md transform transition-transform ${
                showDetections ? "translate-x-3.5 sm:translate-x-4" : "translate-x-0"
              }`}
            />
          </div>
        </button>
      </div>

      {/* ── Drawer: Capas y Opciones ── */}
      {showLayerDrawer && (
        <div className="fixed top-16 right-3 sm:top-20 sm:right-6 z-40 w-[calc(100vw-1.5rem)] sm:w-72 bg-white/95 backdrop-blur-xl border border-black/10 rounded-3xl p-4 sm:p-5 shadow-2xl animate-in fade-in slide-in-from-top-4 duration-200">
          <div className="flex items-center justify-between pb-3 border-b border-zinc-100">
            <div className="flex items-center gap-2">
              <Sliders className="h-4 w-4 text-[#f95721]" />
              <span className="text-sm font-bold text-zinc-900">Capas de visualización</span>
            </div>
            <button
              onClick={() => setShowLayerDrawer(false)}
              className="text-zinc-400 hover:text-zinc-700"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-zinc-700">Detecciones YOLO</span>
              <button
                onClick={() => setShowDetections((v) => !v)}
                className={`text-xs px-2.5 py-1 rounded-full font-semibold transition-colors ${
                  showDetections ? "bg-[#f95721] text-white" : "bg-zinc-100 text-zinc-600"
                }`}
              >
                {showDetections ? "Activado" : "Desactivado"}
              </button>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-zinc-700">Perspectiva</span>
              <button
                onClick={() =>
                  setViewMode((m) => (m === "perspective" ? "overhead" : "perspective"))
                }
                className="text-xs px-2.5 py-1 rounded-full font-semibold bg-zinc-100 hover:bg-zinc-200 text-zinc-800 transition-colors"
              >
                {viewMode === "overhead" ? "Cenital" : "3D Angular"}
              </button>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-zinc-700">Simulación</span>
              <button
                onClick={() => setIsPaused((p) => !p)}
                className={`text-xs px-2.5 py-1 rounded-full font-semibold transition-colors ${
                  isPaused ? "bg-amber-500 text-white" : "bg-emerald-500 text-white"
                }`}
              >
                {isPaused ? "Pausada" : "En curso"}
              </button>
            </div>
          </div>

          <div className="mt-5 pt-3 border-t border-zinc-100">
            <Link
              href="/demo"
              className="w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-zinc-900 text-white text-xs font-semibold hover:bg-zinc-800 transition-colors"
            >
              <Scan className="h-3.5 w-3.5" />
              <span>Abrir Detección de Video / Cámara</span>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
