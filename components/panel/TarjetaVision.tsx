"use client";

import React from "react";
import Link from "next/link";
import { Scan, ArrowUpRight } from "lucide-react";
import type { EstadoTrafico } from "./tipos";

export interface TarjetaVisionProps {
  estado?: EstadoTrafico;
  s?: EstadoTrafico;
}

export function TarjetaVision({ estado, s }: TarjetaVisionProps) {
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

  return (
    <div className="bg-[#12161a]/90 backdrop-blur-xl border border-white/10 rounded-2xl p-4 text-white shadow-xl transition-all duration-300 select-text hover:border-white/20">
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-1.5 font-medium text-zinc-300">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#f95721] opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-[#f95721]" />
          </span>
        </div>
        <Link
          href="/demo"
          className="text-zinc-400 hover:text-white transition-colors"
          title="Ver cámara en tiempo real"
        >
          <ArrowUpRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      <div className="mt-2 flex items-baseline justify-between">
        <span className="text-3xl font-bold tracking-tight text-white font-mono">
          {data.detected}
        </span>
        <span className="text-xs font-mono font-medium text-emerald-400 flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
          {data.onScreen} en escena
        </span>
      </div>

      <div className="mt-1 text-[11px] text-zinc-400 font-normal">
        Vehículos registrados
      </div>
    </div>
  );
}

export default TarjetaVision;
