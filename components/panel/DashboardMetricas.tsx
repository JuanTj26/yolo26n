"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  RefreshCw,
  Car,
  Users,
  Clock,
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Trash2,
  Edit2,
  Plus,
  X,
  Save,
  TrendingUp,
  Download,
  Search,
  Filter,
} from "lucide-react";

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
  const [mensajeExito, setMensajeExito] = useState<string | null>(null);

  // Filtros y Búsqueda
  const [busqueda, setBusqueda] = useState("");
  const [filtroCamara, setFiltroCamara] = useState("todas");
  const [filtroNivel, setFiltroNivel] = useState("todos");

  // Modal Crear / Editar
  const [modalAbierto, setModalAbierto] = useState(false);
  const [registroEditando, setRegistroEditando] = useState<RegistroMetrica | null>(null);
  const [formCamara, setFormCamara] = useState("general");
  const [formVehiculos, setFormVehiculos] = useState(0);
  const [formPeatones, setFormPeatones] = useState(0);
  const [formEspera, setFormEspera] = useState(0);
  const [formCongestion, setFormCongestion] = useState("Bajo");
  const [formFlujo, setFormFlujo] = useState(20);

  const mostrarExito = (msg: string) => {
    setMensajeExito(msg);
    setTimeout(() => setMensajeExito(null), 3000);
  };

  // READ (Cargar datos)
  const cargarMetricas = async () => {
    setCargando(true);
    setError(null);
    try {
      const res = await fetch("/api/metricas");
      const json = await res.json();
      if (json.ok) {
        setMetricas(json.datos || []);
      } else {
        setError(json.error || "No se pudieron obtener las métricas");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error al conectar con el servicio");
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargarMetricas();
  }, []);

  // EXPORTAR A CSV (Excel)
  const exportarCSV = () => {
    if (metricas.length === 0) {
      alert("No hay datos para exportar.");
      return;
    }
    const encabezados = ["ID", "Fecha_Hora", "Camara", "Vehiculos", "Peatones", "En_Espera", "Congestion_Nivel", "Flujo_Porcentaje"];
    const filas = metricas.map((m) => [
      m.id,
      `"${m.fecha_hora}"`,
      `"${m.camara}"`,
      m.vehiculos,
      m.peatones,
      m.total_espera,
      `"${m.nivel_congestion}"`,
      m.flujo_porcentaje,
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [encabezados.join(","), ...filas.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `reporte_trafico_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    mostrarExito("Reporte CSV descargado correctamente");
  };

  // ABRIR MODAL
  const abrirModal = (m?: RegistroMetrica) => {
    if (m) {
      setRegistroEditando(m);
      setFormCamara(m.camara);
      setFormVehiculos(m.vehiculos);
      setFormPeatones(m.peatones);
      setFormEspera(m.total_espera);
      setFormCongestion(m.nivel_congestion);
      setFormFlujo(m.flujo_porcentaje);
    } else {
      setRegistroEditando(null);
      setFormCamara("general");
      setFormVehiculos(0);
      setFormPeatones(0);
      setFormEspera(0);
      setFormCongestion("Bajo");
      setFormFlujo(20);
    }
    setModalAbierto(true);
  };

  // GUARDAR
  const guardarRegistro = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (registroEditando) {
        const res = await fetch("/api/metricas", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: registroEditando.id,
            camara: formCamara,
            vehiculos: formVehiculos,
            peatones: formPeatones,
            total_espera: formEspera,
            nivel_congestion: formCongestion,
            flujo_porcentaje: formFlujo,
          }),
        });
        const json = await res.json();
        if (json.ok) {
          mostrarExito("Registro actualizado con éxito");
          setModalAbierto(false);
          cargarMetricas();
        } else {
          alert(json.error || "Error al actualizar");
        }
      } else {
        const res = await fetch("/api/metricas", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            camara: formCamara,
            vehiculos: formVehiculos,
            peatones: formPeatones,
            total_espera: formEspera,
            nivel_congestion: formCongestion,
            flujo_porcentaje: formFlujo,
            fps_promedio: 30,
          }),
        });
        const json = await res.json();
        if (json.ok) {
          mostrarExito("Registro guardado con éxito");
          setModalAbierto(false);
          cargarMetricas();
        } else {
          alert(json.error || "Error al guardar");
        }
      }
    } catch (err: unknown) {
      alert("Error al guardar: " + String(err));
    }
  };

  // ELIMINAR
  const eliminarRegistro = async (id: number) => {
    if (!confirm(`¿Deseas eliminar este registro?`)) return;
    try {
      const res = await fetch(`/api/metricas?id=${id}`, { method: "DELETE" });
      const json = await res.json();
      if (json.ok) {
        mostrarExito("Registro eliminado");
        setMetricas((prev) => prev.filter((m) => m.id !== id));
      } else {
        alert(json.error || "Error al eliminar");
      }
    } catch (err) {
      alert("Error de conexión: " + String(err));
    }
  };

  // VACIAR HISTORIAL
  const vaciarHistorial = async () => {
    if (!confirm("¿Deseas vaciar todos los registros del historial?")) return;
    try {
      const res = await fetch("/api/metricas?todo=true", { method: "DELETE" });
      const json = await res.json();
      if (json.ok) {
        mostrarExito("Historial vaciado");
        setMetricas([]);
      } else {
        alert(json.error || "Error al vaciar");
      }
    } catch (err) {
      alert("Error de conexión: " + String(err));
    }
  };

  // Filtrado de métricas
  const metricasFiltradas = useMemo(() => {
    return metricas.filter((m) => {
      const coincideBusqueda =
        busqueda === "" ||
        m.camara.toLowerCase().includes(busqueda.toLowerCase()) ||
        m.fecha_hora.toLowerCase().includes(busqueda.toLowerCase()) ||
        m.nivel_congestion.toLowerCase().includes(busqueda.toLowerCase());

      const coincideCamara = filtroCamara === "todas" || m.camara.toLowerCase() === filtroCamara.toLowerCase();
      const coincideNivel = filtroNivel === "todos" || m.nivel_congestion.toLowerCase() === filtroNivel.toLowerCase();

      return coincideBusqueda && coincideCamara && coincideNivel;
    });
  }, [metricas, busqueda, filtroCamara, filtroNivel]);

  // Estadísticas calculadas sobre las métricas
  const totalVehiculos = metricas.reduce((acc, m) => acc + (m.vehiculos || 0), 0);
  const totalPeatones = metricas.reduce((acc, m) => acc + (m.peatones || 0), 0);
  const promedioCongestion = metricas.length
    ? Math.round(metricas.reduce((acc, m) => acc + (m.flujo_porcentaje || 0), 0) / metricas.length)
    : 0;

  // Datos para la gráfica (últimas 14 muestras en orden cronológico)
  const datosGrafica = useMemo(() => {
    const ordenadas = [...metricas].reverse().slice(-14);
    const maxVal = Math.max(...ordenadas.map((d) => Math.max(d.vehiculos, d.peatones)), 10);
    return { ordenadas, maxVal };
  }, [metricas]);

  return (
    <div className="fixed inset-0 z-40 bg-[#f8fafc]/95 text-zinc-900 backdrop-blur-xl overflow-y-auto p-4 sm:p-8 pt-20 sm:pt-24 animate-in fade-in duration-200">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* Cabecera Limpia */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-zinc-200/60">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-zinc-900">
              Métricas de Aforo y Tráfico
            </h1>
            <p className="text-xs sm:text-sm text-zinc-500 mt-1">
              Registro histórico y monitoreo de afluencia vehicular y peatonal.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            {onVolver && (
              <button
                onClick={onVolver}
                className="inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white text-xs font-semibold text-zinc-700 border border-zinc-200/80 shadow-sm transition active:scale-95"
              >
                <ArrowLeft className="h-3.5 w-3.5" /> Volver
              </button>
            )}
            <button
              onClick={() => abrirModal()}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-1.5 rounded-full bg-zinc-900 text-xs font-semibold text-white shadow-sm transition active:scale-95"
            >
              <Plus className="h-3.5 w-3.5 text-[#f95721]" /> Nuevo Registro
            </button>
            <button
              onClick={exportarCSV}
              className="inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white text-xs font-semibold text-zinc-700 border border-zinc-200/80 shadow-sm transition active:scale-95 hover:bg-zinc-50"
              title="Descargar datos en formato CSV para Excel"
            >
              <Download className="h-3.5 w-3.5 text-zinc-600" /> Exportar CSV
            </button>
            <button
              onClick={cargarMetricas}
              disabled={cargando}
              className="inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white text-xs font-semibold text-zinc-700 border border-zinc-200/80 shadow-sm transition active:scale-95 disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${cargando ? "animate-spin" : ""}`} />
              Actualizar
            </button>
            {metricas.length > 0 && (
              <button
                onClick={vaciarHistorial}
                className="inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-full bg-red-50 text-xs font-semibold text-red-600 border border-red-200/80 shadow-sm transition active:scale-95"
                title="Vaciar todo el historial"
              >
                <Trash2 className="h-3.5 w-3.5" /> Vaciar
              </button>
            )}
          </div>
        </div>

        {/* Notificación de éxito */}
        {mensajeExito && (
          <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium flex items-center gap-2 shadow-sm animate-in fade-in">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0" />
            <span>{mensajeExito}</span>
          </div>
        )}

        {/* Tarjetas KPI con Desvanecido Estilo Pintura de Acuarela */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          
          {/* KPI 1: Vehículos */}
          <div className="relative overflow-hidden rounded-2xl border border-orange-200/50 bg-white p-4 sm:p-5 shadow-sm">
            <div className="absolute -top-10 -right-10 w-36 h-36 bg-gradient-to-br from-[#f95721]/30 via-orange-300/20 to-transparent rounded-[40%_60%_70%_30%] blur-2xl pointer-events-none" />
            <div className="absolute top-6 right-2 w-20 h-20 bg-amber-400/15 rounded-[60%_40%_30%_70%] blur-xl pointer-events-none" />
            <div className="relative z-10 flex items-center justify-between text-zinc-500 text-xs font-medium mb-1.5">
              <span>Vehículos Contabilizados</span>
              <div className="h-7 w-7 rounded-xl bg-orange-100/80 flex items-center justify-center text-[#f95721]">
                <Car className="h-4 w-4" />
              </div>
            </div>
            <div className="relative z-10 text-2xl sm:text-3xl font-extrabold text-zinc-900 tracking-tight">{totalVehiculos}</div>
            <div className="relative z-10 flex items-center gap-1 text-[11px] text-orange-600/90 font-medium mt-1">
              <TrendingUp className="h-3 w-3" />
              <span>Total registrado</span>
            </div>
          </div>

          {/* KPI 2: Peatones */}
          <div className="relative overflow-hidden rounded-2xl border border-emerald-200/50 bg-white p-4 sm:p-5 shadow-sm">
            <div className="absolute -top-10 -right-10 w-36 h-36 bg-gradient-to-br from-emerald-500/25 via-teal-300/20 to-transparent rounded-[50%_50%_70%_30%] blur-2xl pointer-events-none" />
            <div className="absolute top-6 right-2 w-20 h-20 bg-green-400/15 rounded-[40%_60%_50%_50%] blur-xl pointer-events-none" />
            <div className="relative z-10 flex items-center justify-between text-zinc-500 text-xs font-medium mb-1.5">
              <span>Peatones Detectados</span>
              <div className="h-7 w-7 rounded-xl bg-emerald-100/80 flex items-center justify-center text-emerald-600">
                <Users className="h-4 w-4" />
              </div>
            </div>
            <div className="relative z-10 text-2xl sm:text-3xl font-extrabold text-zinc-900 tracking-tight">{totalPeatones}</div>
            <div className="relative z-10 flex items-center gap-1 text-[11px] text-emerald-600/90 font-medium mt-1">
              <TrendingUp className="h-3 w-3" />
              <span>Afluencia en cruces</span>
            </div>
          </div>

          {/* KPI 3: Congestión */}
          <div className="relative overflow-hidden rounded-2xl border border-amber-200/50 bg-white p-4 sm:p-5 shadow-sm">
            <div className="absolute -top-10 -right-10 w-36 h-36 bg-gradient-to-br from-amber-500/25 via-yellow-300/20 to-transparent rounded-[60%_40%_40%_60%] blur-2xl pointer-events-none" />
            <div className="absolute top-6 right-2 w-20 h-20 bg-orange-400/15 rounded-[30%_70%_60%_40%] blur-xl pointer-events-none" />
            <div className="relative z-10 flex items-center justify-between text-zinc-500 text-xs font-medium mb-1.5">
              <span>Congestión Promedio</span>
              <div className="h-7 w-7 rounded-xl bg-amber-100/80 flex items-center justify-center text-amber-600">
                <AlertTriangle className="h-4 w-4" />
              </div>
            </div>
            <div className="relative z-10 text-2xl sm:text-3xl font-extrabold text-zinc-900 tracking-tight">{promedioCongestion}%</div>
            <div className="relative z-10 flex items-center gap-1 text-[11px] text-amber-600/90 font-medium mt-1">
              <span>Índice de saturación vial</span>
            </div>
          </div>

          {/* KPI 4: Muestras */}
          <div className="relative overflow-hidden rounded-2xl border border-sky-200/50 bg-white p-4 sm:p-5 shadow-sm">
            <div className="absolute -top-10 -right-10 w-36 h-36 bg-gradient-to-br from-sky-500/25 via-blue-300/20 to-transparent rounded-[45%_55%_65%_35%] blur-2xl pointer-events-none" />
            <div className="absolute top-6 right-2 w-20 h-20 bg-cyan-400/15 rounded-[55%_45%_35%_65%] blur-xl pointer-events-none" />
            <div className="relative z-10 flex items-center justify-between text-zinc-500 text-xs font-medium mb-1.5">
              <span>Registros Totales</span>
              <div className="h-7 w-7 rounded-xl bg-sky-100/80 flex items-center justify-center text-sky-600">
                <Clock className="h-4 w-4" />
              </div>
            </div>
            <div className="relative z-10 text-2xl sm:text-3xl font-extrabold text-zinc-900 tracking-tight">{metricas.length}</div>
            <div className="relative z-10 flex items-center gap-1 text-[11px] text-sky-600/90 font-medium mt-1">
              <span>Muestras periódicas</span>
            </div>
          </div>

        </div>

        {/* 📈 NUEVA GRÁFICA DE TENDENCIA EN VIVO */}
        {datosGrafica.ordenadas.length > 1 && (
          <div className="bg-white border border-zinc-200/80 rounded-2xl p-5 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h2 className="text-sm sm:text-base font-bold text-zinc-900 flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-[#f95721]" /> Tendencia de Flujo en el Tiempo
                </h2>
                <p className="text-xs text-zinc-500">
                  Comparativa de vehículos vs. peatones detectados en las últimas muestras.
                </p>
              </div>

              {/* Leyenda */}
              <div className="flex items-center gap-4 text-xs font-semibold">
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-[#f95721]" />
                  <span className="text-zinc-600">Vehículos</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-emerald-500" />
                  <span className="text-zinc-600">Peatones</span>
                </div>
              </div>
            </div>

            {/* Barras de tendencia */}
            <div className="h-40 sm:h-48 w-full flex items-end gap-2 sm:gap-4 pt-4 px-2 border-b border-zinc-100 overflow-x-auto no-scrollbar">
              {datosGrafica.ordenadas.map((d) => {
                const alturaVeh = Math.max(8, Math.round((d.vehiculos / datosGrafica.maxVal) * 100));
                const alturaPeat = Math.max(8, Math.round((d.peatones / datosGrafica.maxVal) * 100));
                const horaCorta = new Date(d.fecha_hora).toLocaleTimeString("es-MX", {
                  hour: "2-digit",
                  minute: "2-digit",
                  hour12: false,
                });

                return (
                  <div key={d.id} className="flex-1 min-w-[36px] flex flex-col items-center gap-1 group relative">
                    {/* Tooltip flotante al pasar el mouse */}
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute -top-12 z-20 bg-zinc-900 text-white text-[10px] py-1 px-2 rounded-lg pointer-events-none whitespace-nowrap shadow-lg">
                      {horaCorta} • {d.vehiculos} autos • {d.peatones} peatones
                    </div>

                    <div className="w-full flex items-end justify-center gap-1 h-32 sm:h-36">
                      {/* Barra Vehículos */}
                      <div
                        style={{ height: `${alturaVeh}%` }}
                        className="w-1/2 max-w-[14px] bg-gradient-to-t from-[#f95721] to-orange-400 rounded-t-sm transition-all"
                        title={`Vehículos: ${d.vehiculos}`}
                      />
                      {/* Barra Peatones */}
                      <div
                        style={{ height: `${alturaPeat}%` }}
                        className="w-1/2 max-w-[14px] bg-gradient-to-t from-emerald-500 to-teal-400 rounded-t-sm transition-all"
                        title={`Peatones: ${d.peatones}`}
                      />
                    </div>
                    <span className="text-[10px] font-mono text-zinc-400 truncate mt-1">
                      {horaCorta}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 🎛️ FILTROS Y TABLA CRUD */}
        <div className="bg-white border border-zinc-200/80 rounded-2xl shadow-sm overflow-hidden">
          
          {/* Barra de Filtros */}
          <div className="p-4 sm:p-5 border-b border-zinc-100 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <h2 className="text-sm sm:text-base font-bold text-zinc-900 flex items-center gap-2">
                <Clock className="h-4 w-4 text-[#f95721]" /> Historial de Mediciones
              </h2>
              <span className="text-xs text-zinc-400 font-medium">
                ({metricasFiltradas.length} de {metricas.length})
              </span>
            </div>

            {/* Controles de Búsqueda y Filtro */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Input de Búsqueda */}
              <div className="relative flex-1 sm:w-48">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-zinc-400" />
                <input
                  type="text"
                  placeholder="Buscar..."
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-zinc-50 border border-zinc-200 rounded-full text-zinc-900 outline-none focus:border-[#f95721] transition"
                />
              </div>

              {/* Selector Filtro Cámara */}
              <select
                value={filtroCamara}
                onChange={(e) => setFiltroCamara(e.target.value)}
                className="text-xs bg-zinc-50 border border-zinc-200 rounded-full px-3 py-1.5 text-zinc-700 outline-none focus:border-[#f95721] transition cursor-pointer"
              >
                <option value="todas">Todas las cámaras</option>
                <option value="general">General</option>
                <option value="dual">Dual</option>
                <option value="maqueta">Maqueta</option>
                <option value="toycars">ToyCars</option>
              </select>

              {/* Selector Filtro Nivel */}
              <select
                value={filtroNivel}
                onChange={(e) => setFiltroNivel(e.target.value)}
                className="text-xs bg-zinc-50 border border-zinc-200 rounded-full px-3 py-1.5 text-zinc-700 outline-none focus:border-[#f95721] transition cursor-pointer"
              >
                <option value="todos">Todos los niveles</option>
                <option value="bajo">Bajo</option>
                <option value="medio">Medio</option>
                <option value="alto">Alto</option>
              </select>
            </div>
          </div>

          {error && (
            <div className="m-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-medium">
              {error}
            </div>
          )}

          {cargando && metricas.length === 0 ? (
            <div className="py-12 text-center text-zinc-400 text-xs">
              <RefreshCw className="h-5 w-5 animate-spin mx-auto mb-2 text-[#f95721]" />
              Cargando historial de tráfico...
            </div>
          ) : metricasFiltradas.length === 0 && !error ? (
            <div className="py-12 text-center text-zinc-500 text-xs space-y-2">
              <p>No se encontraron mediciones con los filtros seleccionados.</p>
              <button
                onClick={() => {
                  setBusqueda("");
                  setFiltroCamara("todas");
                  setFiltroNivel("todos");
                }}
                className="text-xs text-[#f95721] font-semibold underline"
              >
                Limpiar filtros
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-zinc-100 bg-zinc-50/70 text-zinc-500 font-semibold">
                    <th className="py-3 px-3 sm:px-4">Fecha y Hora</th>
                    <th className="py-3 px-3 sm:px-4">Cámara</th>
                    <th className="py-3 px-3 sm:px-4">Vehículos</th>
                    <th className="py-3 px-3 sm:px-4">Peatones</th>
                    <th className="py-3 px-3 sm:px-4">En Espera</th>
                    <th className="py-3 px-3 sm:px-4">Congestión</th>
                    <th className="py-3 px-3 sm:px-4 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 text-zinc-700">
                  {metricasFiltradas.map((m) => (
                    <tr key={m.id} className="hover:bg-zinc-50/80 transition-colors">
                      <td className="py-3 px-3 sm:px-4 font-mono text-zinc-600 whitespace-nowrap">
                        {(() => {
                          const fecha = new Date(m.fecha_hora);
                          return isNaN(fecha.getTime())
                            ? m.fecha_hora
                            : fecha.toLocaleString("es-MX", {
                                timeZone: "America/Mexico_City",
                                day: "2-digit",
                                month: "short",
                                hour: "2-digit",
                                minute: "2-digit",
                                second: "2-digit",
                                hour12: true,
                              });
                        })()}
                      </td>
                      <td className="py-3 px-3 sm:px-4">
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-zinc-100 text-zinc-700 capitalize border border-zinc-200/50">
                          {m.camara}
                        </span>
                      </td>
                      <td className="py-3 px-3 sm:px-4 font-bold text-orange-600">{m.vehiculos}</td>
                      <td className="py-3 px-3 sm:px-4 font-bold text-emerald-600">{m.peatones}</td>
                      <td className="py-3 px-3 sm:px-4 text-zinc-600">{m.total_espera}</td>
                      <td className="py-3 px-3 sm:px-4">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold ${
                            m.nivel_congestion === "Alto"
                              ? "bg-red-50 text-red-600 border border-red-200"
                              : m.nivel_congestion === "Medio"
                              ? "bg-amber-50 text-amber-700 border border-amber-200"
                              : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                          }`}
                        >
                          {/* Status Dot Pulsante */}
                          <span
                            className={`w-1.5 h-1.5 rounded-full animate-pulse ${
                              m.nivel_congestion === "Alto"
                                ? "bg-red-500"
                                : m.nivel_congestion === "Medio"
                                ? "bg-amber-500"
                                : "bg-emerald-500"
                            }`}
                          />
                          {m.flujo_porcentaje}% ({m.nivel_congestion})
                        </span>
                      </td>
                      <td className="py-3 px-3 sm:px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => abrirModal(m)}
                            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-800 hover:bg-zinc-100 transition"
                            title="Editar"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => eliminarRegistro(m.id)}
                            className="p-1.5 rounded-lg text-zinc-400 hover:text-red-600 hover:bg-red-50 transition"
                            title="Eliminar"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>

      {/* MODAL EDITAR / CREAR */}
      {modalAbierto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl w-full max-w-md p-6 shadow-2xl border border-zinc-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-100">
              <h3 className="text-sm font-bold text-zinc-900 flex items-center gap-2">
                {registroEditando ? <Edit2 className="h-4 w-4 text-[#f95721]" /> : <Plus className="h-4 w-4 text-emerald-600" />}
                {registroEditando ? `Editar Métrica #${registroEditando.id}` : "Nueva Medición de Tráfico"}
              </h3>
              <button
                onClick={() => setModalAbierto(false)}
                className="p-1 text-zinc-400 hover:text-zinc-700 rounded-full hover:bg-zinc-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={guardarRegistro} className="space-y-3 text-xs">
              <div>
                <label className="block text-zinc-600 font-medium mb-1">Cámara:</label>
                <select
                  value={formCamara}
                  onChange={(e) => setFormCamara(e.target.value)}
                  className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 text-zinc-900 outline-none focus:border-[#f95721] transition"
                >
                  <option value="general">General (COCO)</option>
                  <option value="dual">Dual (Carritos + Personas)</option>
                  <option value="maqueta">Maqueta (best.onnx)</option>
                  <option value="toycars">ToyCars (toycars.onnx)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-zinc-600 font-medium mb-1">Vehículos:</label>
                  <input
                    type="number"
                    min="0"
                    value={formVehiculos}
                    onChange={(e) => setFormVehiculos(Number(e.target.value))}
                    className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 text-zinc-900 outline-none focus:border-[#f95721] transition"
                    required
                  />
                </div>
                <div>
                  <label className="block text-zinc-600 font-medium mb-1">Peatones:</label>
                  <input
                    type="number"
                    min="0"
                    value={formPeatones}
                    onChange={(e) => setFormPeatones(Number(e.target.value))}
                    className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 text-zinc-900 outline-none focus:border-[#f95721] transition"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-zinc-600 font-medium mb-1">En Espera:</label>
                  <input
                    type="number"
                    min="0"
                    value={formEspera}
                    onChange={(e) => setFormEspera(Number(e.target.value))}
                    className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 text-zinc-900 outline-none focus:border-[#f95721] transition"
                  />
                </div>
                <div>
                  <label className="block text-zinc-600 font-medium mb-1">Congestión (%):</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={formFlujo}
                    onChange={(e) => setFormFlujo(Number(e.target.value))}
                    className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 text-zinc-900 outline-none focus:border-[#f95721] transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-zinc-600 font-medium mb-1">Nivel:</label>
                <select
                  value={formCongestion}
                  onChange={(e) => setFormCongestion(e.target.value)}
                  className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2 text-zinc-900 outline-none focus:border-[#f95721] transition"
                >
                  <option value="Bajo">Bajo</option>
                  <option value="Medio">Medio</option>
                  <option value="Alto">Alto</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-zinc-100">
                <button
                  type="button"
                  onClick={() => setModalAbierto(false)}
                  className="px-4 py-2 rounded-full bg-zinc-100 hover:bg-zinc-200 text-zinc-700 font-medium transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-1.5 px-5 py-2 rounded-full bg-[#f95721] hover:bg-[#e04a1a] text-white font-semibold transition shadow-sm active:scale-95"
                >
                  <Save className="h-3.5 w-3.5" />
                  {registroEditando ? "Actualizar" : "Guardar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}

export default DashboardMetricas;
