"use client";

import React from "react";
import type { EstadoTrafico } from "./tipos";

export interface TarjetaFlujoProps {
  porcentajeFlujo: number;
  s?: EstadoTrafico;
  estado?: EstadoTrafico;
}

export function TarjetaFlujo({ porcentajeFlujo, s, estado }: TarjetaFlujoProps) {
  const data = s || estado;
  const flowRate = data?.flow ? data.flow.toFixed(1) : "2.4";

  return (
    <div className="bg-[#12161a]/90 backdrop-blur-xl border border-white/10 rounded-2xl p-4 text-white shadow-xl transition-all duration-300 hover:border-white/20 select-text">
      <div className="flex items-center justify-between text-xs text-zinc-400">
        <span className="font-medium text-zinc-300">Flujo de la ciudad</span>
        <span className="text-[10px] font-mono text-[#f95721] font-semibold">
          {flowRate} autos/s
        </span>
      </div>

      <div className="mt-2 flex items-baseline justify-between">
        <span className="text-3xl font-bold tracking-tight text-white font-mono">
          {porcentajeFlujo}%
        </span>
        <span className="text-[11px] font-medium text-emerald-400">
          Fluido
        </span>
      </div>

      <div className="mt-2.5 h-1 w-full bg-zinc-800 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-[#f95721] to-[#ff7e36] rounded-full transition-all duration-500"
          style={{ width: `${porcentajeFlujo}%` }}
        />
      </div>
    </div>
  );
}

export default TarjetaFlujo;
