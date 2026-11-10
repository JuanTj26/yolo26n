"use client";

import React from "react";
import { Scan } from "lucide-react";

interface BotonRecuadrosProps {
  mostrar: boolean;
  mostrarRecuadros: boolean;
  alAlternarRecuadros: () => void;
}

export const BotonRecuadros: React.FC<BotonRecuadrosProps> = ({
  mostrar,
  mostrarRecuadros,
  alAlternarRecuadros,
}) => {
  if (!mostrar) return null;

  return (
    <div className="fixed bottom-16 right-3 md:bottom-6 md:right-6 z-20 pointer-events-auto">
      <button
        onClick={alAlternarRecuadros}
        className="flex items-center gap-2 sm:gap-3 bg-white/95 hover:bg-white backdrop-blur-md border border-black/10 shadow-lg rounded-full px-3 py-1.5 sm:px-4 sm:py-2 text-zinc-800 transition-all hover:shadow-xl active:scale-95"
      >
        <Scan className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-[#f95721]" />
        <span className="text-[11px] sm:text-xs font-semibold tracking-tight">Recuadros</span>
        <div
          className={`w-8 h-4.5 sm:w-9 sm:h-5 rounded-full transition-colors p-0.5 flex items-center ${
            mostrarRecuadros ? "bg-[#38bdf8]" : "bg-zinc-300"
          }`}
        >
          <div
            className={`bg-white w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-full shadow-md transform transition-transform ${
              mostrarRecuadros ? "translate-x-3.5 sm:translate-x-4" : "translate-x-0"
            }`}
          />
        </div>
      </button>
    </div>
  );
};

export default BotonRecuadros;

