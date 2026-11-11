"use client";

import Link from "next/link";
import { Camera, Sun, Sunset, Moon, Pause, Play, Layers } from "lucide-react";
import type { ModoVista, ModoDia } from "./tipos";

export interface BarraSuperiorProps {
  modoVista: ModoVista;
  alCambiarModoVista: (modo: ModoVista) => void;
  modoDia: ModoDia;
  alCambiarModoDia: (modo: ModoDia) => void;
  giroAutomatico: boolean;
  alCambiarGiroAutomatico: (activo: boolean) => void;
  estaPausado: boolean;
  alCambiarPausa?: () => void;
  alAlternarPausa?: () => void;
  mostrarMenuCapas?: boolean;
  alAlternarMenuCapas?: () => void;
  alAlternarCapas?: () => void;
}

export function BarraSuperior({
  modoVista,
  alCambiarModoVista,
  modoDia,
  alCambiarModoDia,
  giroAutomatico,
  alCambiarGiroAutomatico,
  estaPausado,
  alCambiarPausa,
  alAlternarPausa,
  mostrarMenuCapas = false,
  alAlternarMenuCapas,
  alAlternarCapas,
}: BarraSuperiorProps) {
  const togglePausa = alAlternarPausa || alCambiarPausa || (() => { });
  const toggleCapas = alAlternarCapas || alAlternarMenuCapas || (() => { });
  return (
    <header className="fixed top-0 inset-x-0 z-30 px-3 py-2.5 sm:px-6 sm:py-4 flex items-center justify-between pointer-events-none gap-2">
      {/* Logo y título */}
      <div className="pointer-events-auto flex items-center gap-2">
        <Link
          href="/demo"
          className="flex items-center gap-2 group transition-transform hover:scale-105"
          title="Ir a Cámara en vivo"
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

      {/* Píldora de navegación central (Inicio / Vista aérea / Cámara / Maqueta) */}
      <div className="pointer-events-auto bg-white/85 hover:bg-white backdrop-blur-xl border border-black/5 shadow-sm rounded-full p-1 flex items-center gap-1 transition-all max-w-[calc(100vw-85px)] sm:max-w-none overflow-x-auto no-scrollbar flex-shrink">
        <button
          onClick={() => alCambiarModoVista("perspective")}
          className={`px-2.5 py-1 sm:px-4 sm:py-1.5 rounded-full text-[11px] sm:text-xs font-semibold transition-all whitespace-nowrap flex-shrink-0 ${modoVista === "perspective"
            ? "bg-[#18181b] text-white shadow-sm"
            : "text-zinc-600 hover:text-zinc-900"
            }`}
        >
          Inicio
        </button>
        <button
          onClick={() => alCambiarModoVista("overhead")}
          className={`px-2.5 py-1 sm:px-4 sm:py-1.5 rounded-full text-[11px] sm:text-xs font-semibold transition-all whitespace-nowrap flex-shrink-0 ${modoVista === "overhead"
            ? "bg-[#18181b] text-white shadow-sm"
            : "text-zinc-600 hover:text-zinc-900"
            }`}
        >
          <span className="hidden sm:inline">Vista </span>Aérea
        </button>
        <button
          onClick={() => alCambiarModoVista(modoVista === "neza" ? "perspective" : "neza")}
          className={`px-2.5 py-1 sm:px-4 sm:py-1.5 rounded-full text-[11px] sm:text-xs font-semibold transition-all whitespace-nowrap flex-shrink-0 active:scale-95 ${modoVista === "neza"
            ? "bg-[#c4501f] text-white shadow-sm ring-2 ring-[#c4501f]/30"
            : "text-zinc-600 hover:text-zinc-900"
            }`}
          title="Glorieta del Coyote — Neza"
        >
          Neza
        </button>
        <button
          onClick={() => alCambiarModoVista(modoVista === "camera" ? "perspective" : "camera")}
          className={`px-2.5 py-1 sm:px-4 sm:py-1.5 rounded-full text-[11px] sm:text-xs font-semibold transition-all whitespace-nowrap flex-shrink-0 flex items-center gap-1 active:scale-95 ${modoVista === "camera"
            ? "bg-[#f95721] text-white shadow-sm ring-2 ring-[#f95721]/30"
            : "text-zinc-600 hover:text-zinc-900"
            }`}
          title="Cámara Dual (Carritos + Personas)"
        >
          <Camera className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
          <span>Cámara</span>
        </button>
        <button
          onClick={() => alCambiarModoVista(modoVista === "camera_maqueta" ? "perspective" : "camera_maqueta")}
          className={`px-2.5 py-1 sm:px-4 sm:py-1.5 rounded-full text-[11px] sm:text-xs font-semibold transition-all whitespace-nowrap flex-shrink-0 flex items-center gap-1 active:scale-95 ${modoVista === "camera_maqueta"
            ? "bg-emerald-600 text-white shadow-sm ring-2 ring-emerald-500/30"
            : "text-zinc-600 hover:text-zinc-900"
            }`}
          title="Cámara Maqueta — Modelo best.onnx (YOLO26n 640px)"
        >
          <Camera className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-emerald-300" />
          <span><span className="hidden sm:inline">Cámara </span>Maqueta</span>
        </button>
        <button
          onClick={() => alCambiarModoVista(modoVista === "camera_toycars" ? "perspective" : "camera_toycars")}
          className={`px-2.5 py-1 sm:px-4 sm:py-1.5 rounded-full text-[11px] sm:text-xs font-semibold transition-all whitespace-nowrap flex-shrink-0 flex items-center gap-1 active:scale-95 ${modoVista === "camera_toycars"
            ? "bg-cyan-600 text-white shadow-sm ring-2 ring-cyan-500/30"
            : "text-zinc-600 hover:text-zinc-900"
            }`}
          title="Cámara ToyCars — Modelo toycars.onnx (YOLO 640px)"
        >
          <Camera className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-cyan-300" />
          <span><span className="hidden sm:inline">Cámara </span>ToyCars</span>
        </button>
      </div>

      {/* Selector de Iluminación Ambiental (Día / Atardecer / Noche) */}
      {modoVista !== "camera" && modoVista !== "camera_maqueta" && modoVista !== "camera_toycars" && (
        <div className="pointer-events-auto hidden md:flex items-center bg-white/90 hover:bg-white backdrop-blur-xl border border-black/5 shadow-sm rounded-full p-1 gap-1 transition-all">
          <button
            onClick={() => alCambiarModoDia("day")}
            className={`flex items-center gap-1.5 px-3 py-1 sm:py-1.5 rounded-full text-[11px] sm:text-xs font-semibold transition-all ${modoDia === "day"
              ? "bg-amber-500 text-white shadow-sm"
              : "text-zinc-600 hover:text-zinc-900"
              }`}
            title="Modo Día soleado"
          >
            <Sun className="h-3.5 w-3.5" />
            <span>Día</span>
          </button>
          <button
            onClick={() => alCambiarModoDia("sunset")}
            className={`flex items-center gap-1.5 px-3 py-1 sm:py-1.5 rounded-full text-[11px] sm:text-xs font-semibold transition-all ${modoDia === "sunset"
              ? "bg-gradient-to-r from-[#f95721] to-[#ea580c] text-white shadow-sm"
              : "text-zinc-600 hover:text-zinc-900"
              }`}
            title="Modo Atardecer dorado"
          >
            <Sunset className="h-3.5 w-3.5" />
            <span>Atardecer</span>
          </button>
          <button
            onClick={() => alCambiarModoDia("night")}
            className={`flex items-center gap-1.5 px-3 py-1 sm:py-1.5 rounded-full text-[11px] sm:text-xs font-semibold transition-all ${modoDia === "night"
              ? "bg-[#0b1329] text-cyan-300 shadow-sm ring-1 ring-cyan-500/40"
              : "text-zinc-600 hover:text-zinc-900"
              }`}
            title="Modo Noche con edificios y faros iluminados"
          >
            <Moon className="h-3.5 w-3.5" />
            <span>Noche</span>
          </button>
        </div>
      )}

      {/* Checkbox: Giro automático */}
      {modoVista !== "camera" && modoVista !== "camera_maqueta" && modoVista !== "camera_toycars" && (
        <label
          className={`pointer-events-auto hidden md:flex items-center gap-2 bg-white/90 hover:bg-white backdrop-blur-xl border border-black/5 shadow-sm rounded-full px-3.5 py-1.5 cursor-pointer text-xs font-semibold select-none transition-all hover:scale-105 active:scale-95 ${giroAutomatico ? "text-[#f95721] ring-2 ring-[#f95721]/30" : "text-zinc-700"
            }`}
          title="Activar/Desactivar giro continuo 360°"
        >
          <input
            type="checkbox"
            checked={giroAutomatico}
            onChange={(e) => alCambiarGiroAutomatico(e.target.checked)}
            className="h-3.5 w-3.5 rounded border-zinc-300 text-[#f95721] focus:ring-[#f95721] accent-[#f95721] cursor-pointer"
          />
          <span className="text-[11px] sm:text-xs font-semibold text-zinc-700">
            Giro automático
          </span>
        </label>
      )}

      {/* Controles de la derecha */}
      <div className="pointer-events-auto flex items-center gap-1.5 sm:gap-2.5">


        {/* Botón de Pausa / Reanudar */}
        <button
          onClick={togglePausa}
          className="h-8 w-8 sm:h-9 sm:w-9 rounded-full bg-white/90 hover:bg-white backdrop-blur-md border border-black/5 shadow-sm flex items-center justify-center text-zinc-800 transition-all hover:scale-105 active:scale-95"
          title={estaPausado ? "Reanudar simulación" : "Pausar simulación"}
        >
          {estaPausado ? (
            <Play className="h-3.5 w-3.5 sm:h-4 sm:w-4 fill-zinc-800" />
          ) : (
            <Pause className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          )}
        </button>

        {/* Botón de Capas */}
        <button
          onClick={toggleCapas}
          className={`h-8 w-8 sm:h-9 sm:w-9 rounded-full bg-white/90 hover:bg-white backdrop-blur-md border border-black/5 shadow-sm flex items-center justify-center transition-all hover:scale-105 active:scale-95 ${mostrarMenuCapas ? "text-[#f95721] ring-2 ring-[#f95721]/30" : "text-zinc-800"
            }`}
          title="Capas y opciones"
        >
          <Layers className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
        </button>
      </div>
    </header>
  );
}

export default BarraSuperior;

