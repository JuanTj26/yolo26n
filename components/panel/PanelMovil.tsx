"use client";

import React from "react";
import { Scan, Activity, Leaf, ChevronDown, ChevronUp, Sun, Sunset, Moon } from "lucide-react";
import type { EstadoTrafico, ModoVista, ModoDia } from "./tipos";

export interface PanelMovilProps {
  estado?: EstadoTrafico;
  s?: EstadoTrafico;
  totalEnEspera?: number;
  totalEsperando?: number;
  porcentajeFlujo: number;
  modoVista?: ModoVista;
  modoDia?: ModoDia;
  alCambiarModoDia?: (modo: ModoDia) => void;
  expandido: boolean;
  alCambiarExpandido?: (expandido: boolean | ((prev: boolean) => boolean)) => void;
  alAlternarExpansion?: () => void;
  pestanaActiva?: "vision" | "espera" | "flujo";
  pestanaMovil?: "vision" | "espera" | "flujo";
  alCambiarPestana: (pestana: "vision" | "espera" | "flujo") => void;
}

export function PanelMovil({
  estado,
  s,
  totalEnEspera,
  totalEsperando,
  porcentajeFlujo,
  modoVista = "perspective",
  modoDia = "day",
  alCambiarModoDia,
  expandido,
  alCambiarExpandido,
  alAlternarExpansion,
  pestanaActiva,
  pestanaMovil,
  alCambiarPestana,
}: PanelMovilProps) {
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
  const activeTab = pestanaActiva || pestanaMovil || "espera";

  const cambiarExpandidoVal = (valOrFn: boolean | ((prev: boolean) => boolean)) => {
    if (alCambiarExpandido) {
      alCambiarExpandido(valOrFn);
    } else if (alAlternarExpansion) {
      alAlternarExpansion();
    }
  };

  const alternarExpansion = () => {
    if (alAlternarExpansion) {
      alAlternarExpansion();
    } else if (alCambiarExpandido) {
      alCambiarExpandido((prev) => !prev);
    }
  };

  return (
    <>
      {/* ── MODO CÁMARA ESCRITORIO (Alineado a la IZQUIERDA para no estorbar el selector de cámara) ── */}
      {(modoVista === "camera" || modoVista === "camera_maqueta") && (
        <div className="hidden md:block fixed bottom-4 sm:bottom-6 left-4 sm:left-6 z-30 pointer-events-auto max-w-fit">
          {expandido && (
            <div className="mb-3 bg-black/80 backdrop-blur-xl border border-white/15 rounded-2xl p-4 shadow-2xl animate-in fade-in slide-in-from-bottom-3 duration-200 text-white">
              <div className="flex items-center justify-between pb-2 border-b border-white/10 mb-3">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => alCambiarPestana("vision")}
                    className={`px-2.5 py-1 rounded-full text-xs font-semibold transition-all ${activeTab === "vision"
                        ? "bg-white text-zinc-900"
                        : "text-zinc-400 hover:text-white bg-white/10"
                      }`}
                  >
                    Visión
                  </button>
                  <button
                    onClick={() => alCambiarPestana("espera")}
                    className={`px-2.5 py-1 rounded-full text-xs font-semibold transition-all ${activeTab === "espera"
                        ? "bg-white text-zinc-900"
                        : "text-zinc-400 hover:text-white bg-white/10"
                      }`}
                  >
                    En espera
                  </button>
                  <button
                    onClick={() => alCambiarPestana("flujo")}
                    className={`px-2.5 py-1 rounded-full text-xs font-semibold transition-all ${activeTab === "flujo"
                        ? "bg-white text-zinc-900"
                        : "text-zinc-400 hover:text-white bg-white/10"
                      }`}
                  >
                    Flujo
                  </button>
                </div>
                <button
                  onClick={() => cambiarExpandidoVal(false)}
                  className="h-7 w-7 rounded-full bg-white/10 flex items-center justify-center text-zinc-300 hover:bg-white/20 transition-colors"
                >
                  <ChevronDown className="h-4 w-4" />
                </button>
              </div>

              {activeTab === "vision" && (
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-white/10 rounded-xl p-3 text-center">
                    <div className="text-3xl font-bold font-mono">{data.detected}</div>
                    <div className="text-[10px] text-zinc-400 mt-0.5">Detectados total</div>
                  </div>
                  <div className="bg-white/10 rounded-xl p-3 text-center">
                    <div className="text-3xl font-bold font-mono text-emerald-400">
                      {data.onScreen}
                    </div>
                    <div className="text-[10px] text-zinc-400 mt-0.5">En escena</div>
                  </div>
                  <div className="bg-white/10 rounded-xl p-3 text-center">
                    <div className="text-3xl font-bold font-mono text-[#f95721]">
                      {porcentajeFlujo}%
                    </div>
                    <div className="text-[10px] text-zinc-400 mt-0.5">Fluidez</div>
                  </div>
                </div>
              )}

              {activeTab === "espera" && (
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { dir: "Norte", sem: "S1", q: data.queues[0] ?? 0, axis: "NS" },
                    { dir: "Este", sem: "S2", q: data.queues[1] ?? 0, axis: "EW" },
                    { dir: "Sur", sem: "S3", q: data.queues[2] ?? 0, axis: "NS" },
                    { dir: "Oeste", sem: "S4", q: data.queues[3] ?? 0, axis: "EW" },
                  ].map((item, idx) => {
                    const isGreen = !data.allRed && data.green === item.axis;
                    const isYellow = isGreen && data.yellow;
                    const lightCls = data.allRed
                      ? "bg-red-500"
                      : isGreen
                        ? isYellow
                          ? "bg-amber-400 shadow-[0_0_6px_#fbbf24]"
                          : "bg-emerald-500 shadow-[0_0_6px_#10b981]"
                        : "bg-red-500";

                    // En modo cámara no mostramos este panel porque la cámara tiene su propio HUD flotante
  if (modoVista === "camera" || modoVista === "camera_maqueta") {
    return null;
  }

  return (
                      <div key={idx} className="bg-white/10 rounded-xl p-2.5 text-center">
                        <div className="flex items-center justify-center gap-1 mb-1">
                          <span className={`h-2 w-2 rounded-full ${lightCls}`} />
                          <span className="text-[11px] font-semibold">{item.dir}</span>
                        </div>
                        <div className="text-xl font-bold font-mono">{item.q}</div>
                        <div className="text-[9px] text-zinc-400 font-mono">{item.sem}</div>
                      </div>
                    );
                  })}
                </div>
              )}

              {activeTab === "flujo" && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-zinc-300">Fluidez del tráfico</span>
                    <span className="text-2xl font-bold font-mono text-[#f95721]">
                      {porcentajeFlujo}%
                    </span>
                  </div>
                  <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-[#f95721] to-[#ff7e36] rounded-full transition-all duration-500"
                      style={{ width: `${porcentajeFlujo}%` }}
                    />
                  </div>
                  <div className="mt-2 text-[11px] text-zinc-500">Vehículos en movimiento activo</div>
                </div>
              )}
            </div>
          )}

          {/* Barra cápsula compacta en modo cámara */}
          <div className="bg-black/80 backdrop-blur-xl border border-white/15 rounded-full px-4 py-2.5 shadow-2xl flex items-center justify-between gap-2 text-white">
            <div className="flex items-center gap-1">
              <button
                onClick={() => {
                  alCambiarPestana("vision");
                  cambiarExpandidoVal((e) => (activeTab === "vision" ? !e : true));
                }}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium transition-all ${expandido && activeTab === "vision"
                    ? "bg-white text-zinc-900"
                    : "text-zinc-300 hover:bg-white/15"
                  }`}
              >
                <Scan className="h-3 w-3 text-[#f95721]" />
                <span className="font-mono font-bold">{data.detected}</span>
              </button>

              <div className="h-4 w-[1px] bg-white/20" />

              <button
                onClick={() => {
                  alCambiarPestana("espera");
                  cambiarExpandidoVal((e) => (activeTab === "espera" ? !e : true));
                }}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium transition-all ${expandido && activeTab === "espera"
                    ? "bg-white text-zinc-900"
                    : "text-zinc-300 hover:bg-white/15"
                  }`}
              >
                <Activity className="h-3 w-3 text-emerald-400" />
                <span className="font-mono font-bold">{waitingTotal}</span>
                <span className="text-[10px] text-zinc-400">espera</span>
              </button>

              <div className="h-4 w-[1px] bg-white/20" />

              <button
                onClick={() => {
                  alCambiarPestana("flujo");
                  cambiarExpandidoVal((e) => (activeTab === "flujo" ? !e : true));
                }}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium transition-all ${expandido && activeTab === "flujo"
                    ? "bg-white text-zinc-900"
                    : "text-zinc-300 hover:bg-white/15"
                  }`}
              >
                <Leaf className="h-3 w-3 text-[#f95721]" />
                <span className="font-mono font-bold">{porcentajeFlujo}%</span>
              </button>
            </div>

            <button
              onClick={alternarExpansion}
              className="h-7 w-7 rounded-full bg-white/10 flex items-center justify-center text-zinc-300 hover:bg-white/20 transition-colors flex-shrink-0"
              title={expandido ? "Ocultar panel" : "Ver detalles"}
            >
              {expandido ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
            </button>
          </div>
        </div>
      )}

      {/* ── VISTA MÓVIL (Pantallas < md, solo modo 3D) ── */}
      {modoVista !== "camera" && modoVista !== "camera_maqueta" && (
        <div className="md:hidden fixed bottom-3 inset-x-3 z-30 pointer-events-auto">
        {expandido && (
          <div className="mb-2 bg-white/95 backdrop-blur-xl border border-black/10 rounded-2xl p-4 shadow-2xl animate-in slide-in-from-bottom-3 duration-200">
            <div className="flex items-center justify-between pb-2 border-b border-zinc-100">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => alCambiarPestana("vision")}
                  className={`px-2.5 py-1 rounded-full text-xs font-semibold transition-all ${activeTab === "vision"
                      ? "bg-[#18181b] text-white"
                      : "text-zinc-600 hover:text-zinc-900 bg-zinc-100"
                    }`}
                >
                  Visión
                </button>
                <button
                  onClick={() => alCambiarPestana("espera")}
                  className={`px-2.5 py-1 rounded-full text-xs font-semibold transition-all ${activeTab === "espera"
                      ? "bg-[#18181b] text-white"
                      : "text-zinc-600 hover:text-zinc-900 bg-zinc-100"
                    }`}
                >
                  En espera
                </button>
                <button
                  onClick={() => alCambiarPestana("flujo")}
                  className={`px-2.5 py-1 rounded-full text-xs font-semibold transition-all ${activeTab === "flujo"
                      ? "bg-[#18181b] text-white"
                      : "text-zinc-600 hover:text-zinc-900 bg-zinc-100"
                    }`}
                >
                  Flujo
                </button>
              </div>

              <button
                onClick={() => cambiarExpandidoVal(false)}
                className="h-7 w-7 rounded-full bg-zinc-100 flex items-center justify-center text-zinc-600"
                title="Minimizar"
              >
                <ChevronDown className="h-4 w-4" />
              </button>
            </div>

            {/* Pestaña: Visión */}
            {activeTab === "vision" && (
              <div className="mt-3 flex flex-col gap-2">
                <div className="flex items-center justify-between bg-zinc-900 text-white rounded-xl p-3">
                  <div>
                    <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400">
                      Vehículos detectados
                    </span>
                    <div className="text-3xl font-bold font-mono">{data.detected}</div>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-emerald-400">
                      {data.onScreen} en escena
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Pestaña: En espera */}
            {activeTab === "espera" && (
              <div className="mt-2.5 space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold text-zinc-800">
                  <span>
                    Total en espera:{" "}
                    <strong className="text-[#f95721] font-mono">{waitingTotal} autos</strong>
                  </span>
                  <span className="text-[10px] text-emerald-600 flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Cruce adaptativo
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  {[
                    { dir: "Norte", sem: "S1", q: data.queues[0] ?? 0, axis: "NS" },
                    { dir: "Este", sem: "S2", q: data.queues[1] ?? 0, axis: "EW" },
                    { dir: "Sur", sem: "S3", q: data.queues[2] ?? 0, axis: "NS" },
                    { dir: "Oeste", sem: "S4", q: data.queues[3] ?? 0, axis: "EW" },
                  ].map((item, idx) => {
                    const isGreen = !data.allRed && data.green === item.axis;
                    const isYellow = isGreen && data.yellow;
                    const lightCls = data.allRed
                      ? "bg-red-500"
                      : isGreen
                        ? isYellow
                          ? "bg-amber-400 shadow-[0_0_6px_#fbbf24]"
                          : "bg-emerald-500 shadow-[0_0_6px_#10b981]"
                        : "bg-red-500";

                    // En modo cámara no mostramos este panel porque la cámara tiene su propio HUD flotante
  if (modoVista === "camera" || modoVista === "camera_maqueta") {
    return null;
  }

  return (
                      <div
                        key={idx}
                        className="bg-zinc-50 rounded-lg p-1.5 border border-black/5 flex items-center justify-between"
                      >
                        <div className="flex items-center gap-1.5">
                          <span className={`h-2 w-2 rounded-full flex-shrink-0 ${lightCls}`} />
                          <span className="text-[11px] font-medium text-zinc-800">
                            {item.dir} ({item.sem})
                          </span>
                        </div>
                        <span className="text-xs font-bold font-mono text-zinc-900 bg-white px-1.5 py-0.5 rounded border border-black/5">
                          {item.q}
                        </span>
                      </div>
                    );
                  })}
                </div>
                {/* Fila de peatones en móvil */}
                <div className="mt-2 flex items-center justify-between bg-blue-50 rounded-lg px-2.5 py-1.5 border border-blue-100">
                  <div className="flex items-center gap-1.5 text-[11px] font-medium text-blue-700">
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="h-3.5 w-3.5"
                    >
                      <circle cx="12" cy="5" r="1.5" fill="currentColor" stroke="none" />
                      <path d="M9 10l1.5 4L9 18" />
                      <path d="M15 10l-1.5 4L15 18" />
                      <path d="M9.5 10h5" />
                    </svg>
                    <span>Peatones cruzando</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`h-2 w-2 rounded-full transition-colors ${data.pedestrianGreen
                          ? "bg-blue-400 shadow-[0_0_5px_#60a5fa]"
                          : "bg-zinc-400"
                        }`}
                    />
                    <span className="text-xs font-bold font-mono text-blue-900">
                      {data.pedestrians}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Pestaña: Flujo */}
            {activeTab === "flujo" && (
              <div className="mt-3 bg-zinc-900 text-white rounded-xl p-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-zinc-300">Fluidez del tráfico</span>
                  <span className="text-2xl font-bold font-mono text-[#f95721]">
                    {porcentajeFlujo}%
                  </span>
                </div>
                <div className="mt-2 h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-[#f95721] to-[#ff7e36] rounded-full"
                    style={{ width: `${porcentajeFlujo}%` }}
                  />
                </div>
                <div className="mt-2 text-[10px] text-zinc-400">Vehículos en movimiento fluido</div>
              </div>
            )}
            {/* Selector de iluminación (Día / Atardecer / Noche) — solo en móvil cuando no es modo cámara */}
            {modoVista !== "camera" && alCambiarModoDia && (
              <div className="mt-3 pt-3 border-t border-zinc-100 flex items-center justify-center gap-2">
                <button
                  onClick={() => alCambiarModoDia("day")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                    modoDia === "day"
                      ? "bg-amber-500 text-white shadow-sm"
                      : "text-zinc-600 bg-zinc-100 hover:bg-zinc-200"
                  }`}
                >
                  <Sun className="h-3.5 w-3.5" />
                  Día
                </button>
                <button
                  onClick={() => alCambiarModoDia("sunset")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                    modoDia === "sunset"
                      ? "bg-gradient-to-r from-[#f95721] to-[#ea580c] text-white shadow-sm"
                      : "text-zinc-600 bg-zinc-100 hover:bg-zinc-200"
                  }`}
                >
                  <Sunset className="h-3.5 w-3.5" />
                  Atardecer
                </button>
                <button
                  onClick={() => alCambiarModoDia("night")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                    modoDia === "night"
                      ? "bg-[#0b1329] text-cyan-300 shadow-sm ring-1 ring-cyan-500/40"
                      : "text-zinc-600 bg-zinc-100 hover:bg-zinc-200"
                  }`}
                >
                  <Moon className="h-3.5 w-3.5" />
                  Noche
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── Cápsula inferior móvil compacta (1 sola línea limpia) ── */}
        <div className="bg-white/95 backdrop-blur-xl border border-black/10 rounded-full px-3 py-2 shadow-xl flex items-center justify-between gap-1">
          <button
            onClick={() => {
              alCambiarPestana("vision");
              cambiarExpandidoVal((e) => (activeTab === "vision" ? !e : true));
            }}
            className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-[11px] font-medium transition-all ${expandido && activeTab === "vision"
                ? "bg-zinc-900 text-white"
                : "text-zinc-700 hover:bg-zinc-100"
              }`}
          >
            <Scan className="h-3 w-3 text-[#f95721]" />
            <span className="font-mono font-bold">{data.detected}</span>
          </button>

          <div className="h-4 w-[1px] bg-zinc-200" />

          <button
            onClick={() => {
              alCambiarPestana("espera");
              cambiarExpandidoVal((e) => (activeTab === "espera" ? !e : true));
            }}
            className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-[11px] font-medium transition-all ${expandido && activeTab === "espera"
                ? "bg-zinc-900 text-white"
                : "text-zinc-700 hover:bg-zinc-100"
              }`}
          >
            <Activity className="h-3 w-3 text-emerald-500" />
            <span className="font-mono font-bold">{waitingTotal}</span>
            <span className="text-[10px] text-zinc-500 hidden xs:inline">espera</span>
          </button>

          <div className="h-4 w-[1px] bg-zinc-200" />

          <button
            onClick={() => {
              alCambiarPestana("flujo");
              cambiarExpandidoVal((e) => (activeTab === "flujo" ? !e : true));
            }}
            className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-[11px] font-medium transition-all ${expandido && activeTab === "flujo"
                ? "bg-zinc-900 text-white"
                : "text-zinc-700 hover:bg-zinc-100"
              }`}
          >
            <Leaf className="h-3 w-3 text-[#f95721]" />
            <span className="font-mono font-bold">{porcentajeFlujo}%</span>
          </button>

          <button
            onClick={alternarExpansion}
            className="h-6 w-6 rounded-full bg-zinc-100 flex items-center justify-center text-zinc-600 transition-colors"
            title={expandido ? "Ocultar panel" : "Ver detalles"}
          >
            {expandido ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>
      )}
    </>
  );
}

export default PanelMovil;
