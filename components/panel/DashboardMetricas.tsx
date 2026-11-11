"use client";

import React, { useState, useEffect } from "react";
import { BarChart3, RefreshCw, Car, Users, Clock, AlertTriangle, Database, ArrowLeft, CheckCircle2 } from "lucide-react";

export interface RegistroMetrica {
  id: number;
  fecha_hora: string;
  camara: string;
  vehiculos: number;
  peatones: number;
  total_espera: number;
  nivel_congestion: string;
  flujo_porcentaje: number;
  fps_promedio: number;
}

interface DashboardMetricasProps {
  onVolver?: () => void;
}

export function DashboardMetricas({ onVolver }: DashboardMetricasProps) {
  const [metricas, setMetricas] = useState<RegistroMetrica[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cargarMetricas = async () => {
    setCargando(true);
    setError(null);
    try {
      const res = await fetch("/api/metricas");
      const json = await res.json();
      if (json.ok) {
        setMetricas(json.datos || []);
      } else {
        setError(json.error || "Error al cargar datos");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error de conexión");
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargarMetricas();
  }, []);

  // Estadísticas calculadas
  const totalVehiculos = metricas.reduce((acc, m) => acc + (m.vehiculos || 0), 0);
  const totalPeatones = metricas.reduce((acc, m) => acc + (m.peatones || 0), 0);
  const promedioCongestion = metricas.length
    ? Math.round(metricas.reduce((acc, m) => acc + (m.flujo_porcentaje || 0), 0) / metricas.length)
    : 0;

  return (
    <div className="fixed inset-0 z-40 bg-zinc-950/95 text-zinc-100 backdrop-blur-xl overflow-y-auto p-4 sm:p-8 pt-20 sm:pt-24 animate-in fade-in duration-200">
      <div className="max-w-6xl mx-auto space-y-6">

        {/* Cabecera */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-zinc-800">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold tracking-widest text-[#f95721] uppercase">
              <Database className="h-4 w-4" /> Base de Datos TiDB Cloud
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight mt-1 flex items-center gap-2">
              <BarChart3 className="h-7 w-7 text-emerald-400" />
              Métricas de Tráfico y Peatones
            </h1>
            <p className="text-xs sm:text-sm text-zinc-400 mt-1">
              Registro histórico automático almacenado cada intervalo desde la cámara general.
            </p>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            {onVolver && (
              <button
                onClick={onVolver}
                className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold text-zinc-200 transition"
              >
                <ArrowLeft className="h-4 w-4" /> Volver a Cámara
              </button>
            )}
            <button
              onClick={cargarMetricas}
              disabled={cargando}
              className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-[#f95721] hover:bg-[#e04a1a] text-xs font-semibold text-white shadow-lg shadow-[#f95721]/20 transition disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${cargando ? "animate-spin" : ""}`} />
              Actualizar
            </button>
          </div>
        </div>

        {/* Tarjetas KPI */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="bg-zinc-900/80 border border-zinc-800/80 rounded-2xl p-4 sm:p-5 relative overflow-hidden">
            <div className="flex items-center justify-between text-zinc-400 text-xs font-semibold mb-2">
              <span>Total Vehículos Registrados</span>
              <Car className="h-4 w-4 text-orange-400" />
            </div>
            <div className="text-2xl sm:text-3xl font-black text-white">{totalVehiculos}</div>
            <div className="text-[11px] text-zinc-500 mt-1">Acumulado en muestras</div>
          </div>

          <div className="bg-zinc-900/80 border border-zinc-800/80 rounded-2xl p-4 sm:p-5 relative overflow-hidden">
            <div className="flex items-center justify-between text-zinc-400 text-xs font-semibold mb-2">
              <span>Total Peatones Detectados</span>
              <Users className="h-4 w-4 text-emerald-400" />
            </div>
            <div className="text-2xl sm:text-3xl font-black text-white">{totalPeatones}</div>
            <div className="text-[11px] text-zinc-500 mt-1">Acumulado en muestras</div>
          </div>

          <div className="bg-zinc-900/80 border border-zinc-800/80 rounded-2xl p-4 sm:p-5 relative overflow-hidden">
            <div className="flex items-center justify-between text-zinc-400 text-xs font-semibold mb-2">
              <span>Congestión Promedio</span>
              <AlertTriangle className="h-4 w-4 text-amber-400" />
            </div>
            <div className="text-2xl sm:text-3xl font-black text-white">{promedioCongestion}%</div>
            <div className="text-[11px] text-zinc-500 mt-1">Nivel general del crucero</div>
          </div>

          <div className="bg-zinc-900/80 border border-zinc-800/80 rounded-2xl p-4 sm:p-5 relative overflow-hidden">
            <div className="flex items-center justify-between text-zinc-400 text-xs font-semibold mb-2">
              <span>Registros en TiDB</span>
              <Database className="h-4 w-4 text-cyan-400" />
            </div>
            <div className="text-2xl sm:text-3xl font-black text-white">{metricas.length}</div>
            <div className="text-[11px] text-zinc-500 mt-1">Últimas 50 capturas</div>
          </div>
        </div>

        {/* Tabla de registros históricos */}
        <div className="bg-zinc-900/80 border border-zinc-800/80 rounded-2xl p-4 sm:p-6 shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base sm:text-lg font-bold flex items-center gap-2">
              <Clock className="h-4 w-4 text-[#f95721]" /> Historial de Registros TiDB
            </h2>
            <span className="text-xs text-zinc-400">
              Conexión: <span className="text-emerald-400 font-semibold">SSL TLSv1.2 Segura</span>
            </span>
          </div>

          {error && (
            <div className="p-4 rounded-xl bg-red-950/40 border border-red-500/50 text-red-300 text-xs">
              ⚠️ {error} — Asegúrate de haber puesto tu contraseña en <code>.env</code> o en las variables de entorno de Vercel.
            </div>
          )}

          {cargando && metricas.length === 0 ? (
            <div className="py-12 text-center text-zinc-500 text-sm">
              <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-[#f95721]" />
              Consultando base de datos TiDB Cloud...
            </div>
          ) : metricas.length === 0 && !error ? (
            <div className="py-12 text-center text-zinc-500 text-sm">
              Aún no hay métricas guardadas. ¡Inicia la cámara y activa el selector de auto-guardado o presiona &ldquo;Guardar lectura&rdquo;!
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-zinc-800 text-zinc-400 font-semibold uppercase tracking-wider">
                    <th className="py-3 px-3">Fecha / Hora</th>
                    <th className="py-3 px-3">Cámara</th>
                    <th className="py-3 px-3">Autos</th>
                    <th className="py-3 px-3">Peatones</th>
                    <th className="py-3 px-3">En Espera</th>
                    <th className="py-3 px-3">Congestión</th>
                    <th className="py-3 px-3">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/50">
                  {metricas.map((m) => (
                    <tr key={m.id} className="hover:bg-zinc-800/30 transition-colors">
                      <td className="py-2.5 px-3 text-zinc-300 font-mono whitespace-nowrap">
                        {new Date(m.fecha_hora).toLocaleTimeString("es-MX", {
                          hour: "2-digit",
                          minute: "2-digit",
                          second: "2-digit",
                          day: "2-digit",
                          month: "short",
                        })}
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-zinc-800 text-zinc-300">
                          {m.camara}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-orange-400">{m.vehiculos}</td>
                      <td className="py-2.5 px-3 font-semibold text-emerald-400">{m.peatones}</td>
                      <td className="py-2.5 px-3 text-zinc-300">{m.total_espera}</td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${m.nivel_congestion === "Alto"
                              ? "bg-red-500/20 text-red-400 border border-red-500/30"
                              : m.nivel_congestion === "Medio"
                                ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                                : "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                            }`}
                        >
                          {m.flujo_porcentaje}% ({m.nivel_congestion})
                        </span>
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="flex items-center gap-1 text-[10px] text-emerald-400">
                          <CheckCircle2 className="h-3 w-3" /> TiDB
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

export default DashboardMetricas;

