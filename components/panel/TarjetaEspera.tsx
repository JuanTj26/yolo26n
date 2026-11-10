"use client";

import React from "react";
import { Activity } from "lucide-react";
import type { EstadoTrafico } from "./tipos";

export interface TarjetaEsperaProps {
  estado?: EstadoTrafico;
  s?: EstadoTrafico;
  totalEnEspera?: number;
  totalEsperando?: number;
}

export function TarjetaEspera({
  estado,
  s,
  totalEnEspera,
  totalEsperando,
}: TarjetaEsperaProps) {
  const data = estado || s || {
    detected: 0,
    onScreen: 0,
    queues: [0, 0, 0, 0],
    green: "NS",
    yellow: false,
    allRed: false,
    flow: 0,
    hist: [],
    pedestrians: 0,
    pedestriansWaiting: 0,
    pedestrianGreen: false,
  };
  const waitingTotal = totalEnEspera ?? totalEsperando ?? (data.queues.reduce((a, b) => a + b, 0));

  const accesos = [
    { label: "N", sem: "S1", q: data.queues[0] ?? 0, axis: "NS" },
    { label: "E", sem: "S2", q: data.queues[1] ?? 0, axis: "EW" },
    { label: "S", sem: "S3", q: data.queues[2] ?? 0, axis: "NS" },
    { label: "O", sem: "S4", q: data.queues[3] ?? 0, axis: "EW" },
  ];

  return (
    <div className="bg-white/95 backdrop-blur-xl border border-black/5 rounded-2xl p-4 text-zinc-900 shadow-xl transition-all duration-300 select-text">
      {/* Encabezado limpio */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-800">
          <Activity className="h-3.5 w-3.5 text-[#f95721]" />
          <span>En espera</span>
        </div>
        <div className="flex items-baseline gap-1">
          <span className="text-xl font-bold font-mono text-zinc-900 leading-none">
            {waitingTotal}
          </span>
          <span className="text-[11px] text-zinc-400 font-medium">autos</span>
        </div>
      </div>

      {/* 4 Semáforos y colas en una fila compacta y minimalista */}
      <div className="mt-3 grid grid-cols-4 gap-1.5">
        {accesos.map((item, idx) => {
          const isGreen = !data.allRed && data.green === item.axis;
          const isYellow = isGreen && data.yellow;
          const lightCls = data.allRed
            ? "bg-red-500"
            : isGreen
            ? isYellow
              ? "bg-amber-400 shadow-[0_0_6px_#fbbf24]"
              : "bg-emerald-500 shadow-[0_0_6px_#10b981]"
            : "bg-red-500";

          return (
            <div
              key={idx}
              className="bg-zinc-50 rounded-xl py-2 px-1 text-center border border-black/5 flex flex-col items-center gap-1"
            >
              <div className="flex items-center gap-1">
                <span className={`h-1.5 w-1.5 rounded-full ${lightCls}`} />
                <span className="text-[10px] font-bold text-zinc-600">{item.label}</span>
              </div>
              <span className="text-xs font-bold font-mono text-zinc-900">
                {item.q}
              </span>
            </div>
          );
        })}
      </div>

      {/* Peatones y cruce en una línea sutil */}
      <div className="mt-2.5 pt-2 border-t border-zinc-100 flex items-center justify-between text-[11px] text-zinc-500">
        <span className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          <span>Cruce dinámico</span>
        </span>
        <span className="flex items-center gap-1 font-medium text-zinc-700">
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              data.pedestrianGreen ? "bg-blue-500" : "bg-zinc-300"
            }`}
          />
          <span>{data.pedestrians} peatones</span>
        </span>
      </div>
    </div>
  );
}

export default TarjetaEspera;
