"use client";

import React from "react";
import Link from "next/link";
import { Sliders, X, Scan, Eye } from "lucide-react";
import { ModoVista, ModoDia } from "./tipos";

export interface MenuCapasProps {
  mostrar: boolean;
  alCerrar: () => void;
  mostrarRecuadros: boolean;
  alAlternarRecuadros: () => void;
  modoVista: ModoVista;
  alCambiarModoVista: (modo: ModoVista | ((prev: ModoVista) => ModoVista)) => void;
  estaPausado: boolean;
  alAlternarPausa: () => void;
  giroAutomatico: boolean;
  alCambiarGiroAutomatico: (giro: boolean) => void;
  modoDia?: ModoDia;
  alCambiarModoDia?: (modo: ModoDia) => void;
}

export const MenuCapas: React.FC<MenuCapasProps> = ({
  mostrar,
  alCerrar,
  mostrarRecuadros,
  alAlternarRecuadros,
  modoVista,
  alCambiarModoVista,
  estaPausado,
  alAlternarPausa,
  giroAutomatico,
  alCambiarGiroAutomatico,
}) => {
  if (!mostrar) return null;

  return (
    <div className="fixed top-16 right-3 sm:top-20 sm:right-6 z-40 w-64 sm:w-72 bg-white/95 backdrop-blur-xl border border-black/10 rounded-2xl p-4 shadow-2xl animate-in fade-in slide-in-from-top-3 duration-200">
      {/* Encabezado minimalista */}
      <div className="flex items-center justify-between pb-2.5 border-b border-zinc-100">
        <div className="flex items-center gap-1.5">
          <Sliders className="h-3.5 w-3.5 text-[#f95721]" />
          <span className="text-xs font-bold text-zinc-800 tracking-tight">Capas y visualización</span>
        </div>
        <button
          onClick={alCerrar}
          className="h-6 w-6 rounded-full flex items-center justify-center text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-colors"
          title="Cerrar panel"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Lista de controles limpia */}
      <div className="mt-3 space-y-2.5">
        {/* Recuadros */}
        <div className="flex items-center justify-between">
          <span className="text-xs text-zinc-600 font-medium">Recuadros</span>
          <button
            onClick={alAlternarRecuadros}
            className={`text-[11px] px-2.5 py-1 rounded-full font-semibold transition-all ${mostrarRecuadros ? "bg-[#f95721] text-white" : "bg-zinc-100 text-zinc-500 hover:bg-zinc-200"
              }`}
          >
            {mostrarRecuadros ? "Activado" : "Desactivado"}
          </button>
        </div>

        {/* Perspectiva */}
        <div className="flex items-center justify-between">
          <span className="text-xs text-zinc-600 font-medium">Cámara</span>
          <button
            onClick={() =>
              alCambiarModoVista((m) => (m === "perspective" ? "overhead" : "perspective"))
            }
            className="text-[11px] px-2.5 py-1 rounded-full font-semibold bg-zinc-100 hover:bg-zinc-200 text-zinc-800 transition-colors"
          >
            {modoVista === "overhead" ? "Cenital" : "3D Angular"}
          </button>
        </div>

        {/* Giro automático */}
        <div className="flex items-center justify-between">
          <span className="text-xs text-zinc-600 font-medium">Giro continuo 360°</span>
          <button
            onClick={() => alCambiarGiroAutomatico(!giroAutomatico)}
            className={`text-[11px] px-2.5 py-1 rounded-full font-semibold transition-all ${giroAutomatico ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-500 hover:bg-zinc-200"
              }`}
          >
            {giroAutomatico ? "ON" : "OFF"}
          </button>
        </div>

        {/* Simulación */}
        <div className="flex items-center justify-between">
          <span className="text-xs text-zinc-600 font-medium">Simulación</span>
          <button
            onClick={alAlternarPausa}
            className={`text-[11px] px-2.5 py-1 rounded-full font-semibold transition-colors ${estaPausado ? "bg-amber-500 text-white" : "bg-emerald-500 text-white"
              }`}
          >
            {estaPausado ? "Pausa" : "Activa"}
          </button>
        </div>
      </div>

      {/* Accesos directos a cámaras */}
      <div className="mt-4 pt-2.5 border-t border-zinc-100 flex flex-col gap-1.5">
        <button
          onClick={() => {
            alCambiarModoVista("camera_maqueta");
            alCerrar();
          }}
          className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-semibold transition-colors"
        >
          <Scan className="h-3 w-3" />
          <span>Cámara Maqueta (best.onnx)</span>
        </button>
        <button
          onClick={() => {
            alCambiarModoVista("camera_toycars");
            alCerrar();
          }}
          className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white text-[11px] font-semibold transition-colors"
        >
          <Scan className="h-3 w-3" />
          <span>Cámara ToyCars (toycars.onnx)</span>
        </button>
        <button
          onClick={() => {
            alCambiarModoVista("camera");
            alCerrar();
          }}
          className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white text-[11px] font-semibold transition-colors"
        >
          <Scan className="h-3 w-3" />
          <span>Cámara Dual (Carritos + Personas)</span>
        </button>
      </div>
    </div>
  );
};

export default MenuCapas;
