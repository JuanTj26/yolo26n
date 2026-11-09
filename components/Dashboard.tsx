"use client";

import { useEffect, useState } from "react";
import { simRef } from "./TrafficScene";
import { queueLen } from "@/lib/traffic-sim";

type Snap = {
  detected: number;
  onScreen: number;
  queues: number[];
  green: "NS" | "EW";
  yellow: boolean;
  flow: number;
  hist: number[];
};

const DIRS = ["N", "E", "S", "O"];

export function Dashboard() {
  const [s, setS] = useState<Snap | null>(null);
  useEffect(() => {
    const hist: number[] = [];
    let lastPassed = 0;
    let flowAvg = 0;
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
        flow: flowAvg,
        hist: [...hist],
      });
    }, 250);
    return () => clearInterval(id);
  }, []);
  if (!s) return null;

  const maxQ = Math.max(8, ...s.queues);
  const totalQ = s.queues.reduce((a, b) => a + b, 0);
  const density = Math.min(100, Math.round((totalQ / 24) * 100));
  const optim = Math.max(0, Math.min(99, Math.round(100 - density * 0.85 + s.flow * 3)));
  const hMax = Math.max(...s.hist, 1);
  const path = s.hist
    .map((v, i) => `${i === 0 ? "M" : "L"}${(i / 39) * 140},${36 - (v / hMax) * 32}`)
    .join(" ");
  const busiest = s.queues.indexOf(Math.max(...s.queues));

  return (
    <div className="pointer-events-none fixed inset-0 z-20">
      {/* Vehicles detected */}
      <div
        data-range="0.38,0.98"
        className="absolute left-4 top-20 md:left-10 md:top-28"
        style={{ opacity: 0 }}
      >
        <div data-tilt="1" className="glass-panel w-[160px] p-3 md:w-[230px] md:p-5">
          <div className="mono-label text-muted-foreground">Vehículos detectados</div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-semibold tracking-tight md:text-5xl">{s.detected}</span>
            <span className="mono-label text-live">● activo</span>
          </div>
          <svg viewBox="0 0 140 38" className="mt-3 h-8 w-full md:h-10">
            <path d={path} fill="none" stroke="var(--live)" strokeWidth="1.5" />
          </svg>
          <div className="mono-label mt-1 text-muted-foreground">{s.onScreen} en escena · YOLO26n</div>
        </div>
      </div>

      {/* Density */}
      <div data-range="0.4,0.98" className="absolute right-4 top-20 md:right-10 md:top-28" style={{ opacity: 0 }}>
        <div data-tilt="1.3" className="glass-panel w-[160px] p-3 md:w-[230px] md:p-5">
          <div className="mono-label text-muted-foreground">Densidad del tráfico</div>
          <div className="mt-2 text-3xl font-semibold tracking-tight md:text-5xl">
            {density}
            <span className="text-base text-muted-foreground">%</span>
          </div>
          <div className="mt-3 space-y-1.5">
            {s.queues.map((q, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="mono-label w-3 text-muted-foreground">{DIRS[i]}</span>
                <div className="h-[3px] flex-1 overflow-hidden rounded-full bg-hairline">
                  <div
                    className={i === busiest && q > 2 ? "h-full bg-live" : "h-full bg-foreground"}
                    style={{ width: `${(q / maxQ) * 100}%`, transition: "width .4s ease" }}
                  />
                </div>
                <span className="mono-label w-4 text-right">{q}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Intersection status */}
      <div data-range="0.6,0.98" className="absolute bottom-6 left-4 hidden md:bottom-10 md:left-10 md:block" style={{ opacity: 0 }}>
        <div data-tilt="0.8" className="glass-panel w-[230px] p-5">
          <div className="mono-label text-muted-foreground">Estado del cruce</div>
          <div className="mt-3 grid grid-cols-2 gap-3">
            {(["NS", "EW"] as const).map((ax) => {
              const on = s.green === ax;
              const cls = on ? (s.yellow ? "bg-signal-amber" : "bg-signal-green") : "bg-signal-red";
              return (
                <div key={ax} className="flex items-center gap-2">
                  <span className={`h-2.5 w-2.5 rounded-full ${cls}`} />
                  <span className="text-sm font-medium">{ax === "NS" ? "Norte–Sur" : "Este–Oeste"}</span>
                </div>
              );
            })}
          </div>
          <div className="mono-label mt-3 text-muted-foreground">
            Prioridad → <span className="text-live">Acceso {DIRS[busiest]}</span>
          </div>
        </div>
      </div>

      {/* Optimization */}
      <div data-range="0.62,1.5" className="absolute bottom-6 right-4 md:bottom-10 md:right-10" style={{ opacity: 0 }}>
        <div data-tilt="1.1" className="glass-panel w-[160px] p-3 md:w-[230px] md:p-5">
          <div className="mono-label text-muted-foreground">Optimización de señales</div>
          <div className="mt-2 flex items-center gap-3">
            <svg viewBox="0 0 40 40" className="h-10 w-10 -rotate-90 md:h-14 md:w-14">
              <circle cx="20" cy="20" r="16" fill="none" stroke="var(--hairline)" strokeWidth="3" />
              <circle
                cx="20"
                cy="20"
                r="16"
                fill="none"
                stroke="var(--live)"
                strokeWidth="3"
                strokeLinecap="round"
                strokeDasharray={`${(optim / 100) * 100.5} 100.5`}
                style={{ transition: "stroke-dasharray .6s ease" }}
              />
            </svg>
            <span className="text-3xl font-semibold tracking-tight md:text-4xl">{optim}</span>
          </div>
          <div className="mono-label mt-2 text-muted-foreground">{s.flow.toFixed(1)} vehículos/s</div>
        </div>
      </div>
    </div>
  );
}
export default Dashboard;

