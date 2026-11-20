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
  Footprints,
} from "lucide-react";
import { type SolicitudPeatonal, STORAGE_KEY_SOLICITUDES } from "@/lib/pedestrianTypes";

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

interface ToastItem {
  id: number;
  msg: string;
  type: "success" | "error" | "info";
}

interface ConfirmModalState {
  visible: boolean;
  titulo?: string;
  msg: string;
  textoConfirmar?: string;
  onYes: () => void;
}

export function DashboardMetricas({ onVolver }: DashboardMetricasProps) {
  const [metricas, setMetricas] = useState<RegistroMetrica[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mensajeExito, setMensajeExito] = useState<string | null>(null);

  // Sistema de alertas/toasts personalizados
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const addToast = (msg: string, type: "success" | "error" | "info" = "info") => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, msg, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
  };

  // Modal de confirmación personalizado (mismo diseño que el modal de Editar)
  const [confirmModal, setConfirmModal] = useState<ConfirmModalState>({
    visible: false,
    msg: "",
    onYes: () => { },
  });

  const mostrarConfirm = (
    msg: string,
    onYes: () => void,
    titulo = "Confirmar Acción",
    textoConfirmar = "Eliminar"
  ) => {
    setConfirmModal({ visible: true, msg, onYes, titulo, textoConfirmar });
  };

  const cerrarConfirm = () => {
    setConfirmModal((prev) => ({ ...prev, visible: false }));
  };

  // Solicitudes Peatonales en tiempo real
  const [solicitudesPeatonales, setSolicitudesPeatonales] = useState<SolicitudPeatonal[]>([]);

  const cargarSolicitudesPeatonales = () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_SOLICITUDES);
      if (raw) {
        setSolicitudesPeatonales(JSON.parse(raw));
      } else {
        setSolicitudesPeatonales([]);
      }
    } catch (e) {
      console.warn("Error cargando solicitudes peatonales:", e);
    }
  };

  useEffect(() => {
    cargarSolicitudesPeatonales();
    const handleActualizacion = () => cargarSolicitudesPeatonales();
    window.addEventListener("storage", handleActualizacion);
    window.addEventListener("smarttraffic_solicitudes_actualizadas", handleActualizacion);
    return () => {
      window.removeEventListener("storage", handleActualizacion);
      window.removeEventListener("smarttraffic_solicitudes_actualizadas", handleActualizacion);
    };
  }, []);

  const limpiarHistorialPeatones = () => {
    mostrarConfirm(
      "¿Deseas vaciar todo el registro de solicitudes peatonales?",
      () => {
        localStorage.removeItem(STORAGE_KEY_SOLICITUDES);
        setSolicitudesPeatonales([]);
        window.dispatchEvent(new Event("smarttraffic_solicitudes_actualizadas"));
        mostrarExito("Historial de solicitudes peatonales vaciado con éxito");
      },
      "Vaciar Solicitudes",
      "Vaciar Todo"
    );
  };

  // Filtros y Búsqueda
  const [busqueda, setBusqueda] = useState("");
  const [filtroCamara, setFiltroCamara] = useState("todas");
  const [filtroNivel, setFiltroNivel] = useState("todos");

  // Punto inspeccionado en la gráfica de tendencia
  const [puntoHover, setPuntoHover] = useState<RegistroMetrica | null>(null);

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

  // EXPORTAR A EXCEL CON DISEÑO TECH TI (Colores Negro y Naranja)
  const exportarCSV = () => {
    const datosAExportar = metricasFiltradas.length > 0 ? metricasFiltradas : metricas;

    if (datosAExportar.length === 0) {
      addToast("No hay registros en la tabla para exportar.", "info");
      return;
    }

    const totalVeh = datosAExportar.reduce((acc, m) => acc + (m.vehiculos || 0), 0);
    const totalPeat = datosAExportar.reduce((acc, m) => acc + (m.peatones || 0), 0);
    const promFlujo = Math.round(datosAExportar.reduce((acc, m) => acc + (m.flujo_porcentaje || 0), 0) / datosAExportar.length);
    const fechaGen = new Date().toLocaleString("es-MX");

    const filasHtml = datosAExportar.map((m, idx) => {
      const bg = idx % 2 === 0 ? "#ffffff" : "#fdf8f6";
      const badgeCong =
        m.nivel_congestion === "Alto"
          ? 'background:#fee2e2;color:#991b1b;'
          : m.nivel_congestion === "Medio"
            ? 'background:#fef3c7;color:#92400e;'
            : 'background:#dcfce7;color:#166534;';

      return `
        <tr style="background:${bg};border-bottom:1px solid #fed7aa;">
          <td style="padding:10px;text-align:center;font-weight:bold;color:#431407;">${m.id}</td>
          <td style="padding:10px;color:#1c1917;">${m.fecha_hora || ""}</td>
          <td style="padding:10px;text-align:center;font-weight:600;color:#c2410c;">${(m.camara || "general").toUpperCase()}</td>
          <td style="padding:10px;text-align:center;font-weight:bold;color:#ea580c;font-size:14px;">${m.vehiculos ?? 0}</td>
          <td style="padding:10px;text-align:center;font-weight:bold;color:#0d9488;">${m.peatones ?? 0}</td>
          <td style="padding:10px;text-align:center;color:#b91c1c;font-weight:600;">${m.total_espera ?? 0}</td>
          <td style="padding:10px;text-align:center;"><span style="padding:4px 10px;border-radius:12px;font-weight:bold;font-size:11px;${badgeCong}">${m.nivel_congestion || "Bajo"}</span></td>
          <td style="padding:10px;text-align:center;font-weight:bold;color:#ea580c;">${m.flujo_porcentaje ?? 0}%</td>
          <td style="padding:10px;text-align:center;color:#57534e;">${m.fps_promedio ?? 0}</td>
        </tr>
      `;
    }).join("");

    const excelHtml = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
        <head>
          <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
          <!--[if gte mso 9]>
          <xml>
            <x:ExcelWorkbook>
              <x:ExcelWorksheets>
                <x:ExcelWorksheet>
                  <x:Name>TECH TI Reporte</x:Name>
                  <x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions>
                </x:ExcelWorksheet>
              </x:ExcelWorksheets>
            </x:ExcelWorkbook>
          </xml>
          <![endif]-->
          <style>
            body { font-family: 'Segoe UI', Arial, sans-serif; }
          </style>
        </head>
        <body style="background:#ffffff;padding:20px;">
          <!-- BANNER SUPERIOR TECH TI -->
          <table style="width:100%;border-collapse:collapse;margin-bottom:15px;">
            <tr>
              <td colspan="9" style="background:#0f172a;color:#ffffff;padding:18px 20px;border-bottom:4px solid #f95721;">
                <div style="font-size:26px;font-weight:900;letter-spacing:1px;color:#ffffff;">
                  TECH TI <span style="color:#f95721;">· SMART TRAFFIC AI</span>
                </div>
                <div style="font-size:13px;color:#cbd5e1;margin-top:4px;">
                  INFORME OFICIAL DE AFORO VEHICULAR Y MONITOREO DE TRÁFICO EN TIEMPO REAL
                </div>
              </td>
            </tr>
            <tr style="background:#fff7ed;">
              <td colspan="5" style="padding:10px 15px;color:#7c2d12;font-size:12px;font-weight:600;">
                Fecha de Emisión: <strong>${fechaGen}</strong>
              </td>
              <td colspan="4" style="padding:10px 15px;text-align:right;color:#c2410c;font-size:12px;font-weight:bold;">
                Registros Analizados: ${datosAExportar.length}
              </td>
            </tr>
          </table>

          <!-- RESUMEN DE KPIS -->
          <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
            <tr>
              <td colspan="3" style="background:#ffedd5;border:2px solid #fdba74;padding:12px;text-align:center;">
                <div style="font-size:11px;color:#9a3412;font-weight:bold;text-transform:uppercase;">Total Vehículos Contabilizados</div>
                <div style="font-size:24px;font-weight:900;color:#c2410c;margin-top:2px;">${totalVeh.toLocaleString()}</div>
              </td>
              <td colspan="3" style="background:#f0fdfa;border:2px solid #99f6e4;padding:12px;text-align:center;">
                <div style="font-size:11px;color:#115e59;font-weight:bold;text-transform:uppercase;">Total Peatones Detectados</div>
                <div style="font-size:24px;font-weight:900;color:#0d9488;margin-top:2px;">${totalPeat.toLocaleString()}</div>
              </td>
              <td colspan="3" style="background:#0f172a;border:2px solid #334155;padding:12px;text-align:center;">
                <div style="font-size:11px;color:#f95721;font-weight:bold;text-transform:uppercase;">Flujo Promedio</div>
                <div style="font-size:24px;font-weight:900;color:#ffffff;margin-top:2px;">${promFlujo}%</div>
              </td>
            </tr>
          </table>

          <!-- TABLA PRINCIPAL DE DATOS -->
          <table style="width:100%;border-collapse:collapse;border:1px solid #fed7aa;font-size:12px;">
            <thead>
              <tr style="background:#f95721;color:#ffffff;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;">
                <th style="padding:12px 10px;text-align:center;border:1px solid #ea580c;">ID</th>
                <th style="padding:12px 10px;text-align:left;border:1px solid #ea580c;">Fecha y Hora</th>
                <th style="padding:12px 10px;text-align:center;border:1px solid #ea580c;">Cámara / Modo</th>
                <th style="padding:12px 10px;text-align:center;border:1px solid #ea580c;">Vehículos</th>
                <th style="padding:12px 10px;text-align:center;border:1px solid #ea580c;">Peatones</th>
                <th style="padding:12px 10px;text-align:center;border:1px solid #ea580c;">En Espera</th>
                <th style="padding:12px 10px;text-align:center;border:1px solid #ea580c;">Congestión</th>
                <th style="padding:12px 10px;text-align:center;border:1px solid #ea580c;">Flujo %</th>
                <th style="padding:12px 10px;text-align:center;border:1px solid #ea580c;">FPS Promedio</th>
              </tr>
            </thead>
            <tbody>
              ${filasHtml}
            </tbody>
          </table>

          <div style="margin-top:15px;font-size:11px;color:#78716c;text-align:right;">
            TECH TI · Sistema de Control Inteligente de Tráfico Urbano e Inteligencia Artificial
          </div>
        </body>
      </html>
    `;

    const blob = new Blob([excelHtml], { type: "application/vnd.ms-excel;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `TECH_TI_Informe_Trafico_${new Date().toISOString().slice(0, 10)}.xls`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    mostrarExito(`Informe Excel TECH TI exportado (${datosAExportar.length} registros)`);
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
          addToast(json.error || "Error al actualizar registro", "error");
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
          addToast(json.error || "Error al guardar registro", "error");
        }
      }
    } catch (err: unknown) {
      addToast("Error al guardar: " + String(err), "error");
    }
  };

  // ELIMINAR
  const eliminarRegistro = async (id: number) => {
    mostrarConfirm(
      `¿Estás seguro de que deseas eliminar permanentemente el registro #${id}?`,
      async () => {
        try {
          const res = await fetch(`/api/metricas?id=${id}`, { method: "DELETE" });
          const json = await res.json();
          if (json.ok) {
            mostrarExito(`Registro #${id} eliminado con éxito`);
            setMetricas((prev) => prev.filter((m) => m.id !== id));
          } else {
            addToast(json.error || "Error al eliminar registro", "error");
          }
        } catch (err) {
          addToast("Error de conexión: " + String(err), "error");
        }
      },
      "Eliminar Métrica",
      "Eliminar"
    );
  };

  // VACIAR HISTORIAL
  const vaciarHistorial = async () => {
    mostrarConfirm(
      "¿Deseas vaciar todos los registros del historial de métricas? Esta acción no se puede deshacer.",
      async () => {
        try {
          const res = await fetch("/api/metricas?todo=true", { method: "DELETE" });
          const json = await res.json();
          if (json.ok) {
            mostrarExito("Historial de métricas vaciado completamente");
            setMetricas([]);
          } else {
            addToast(json.error || "Error al vaciar historial", "error");
          }
        } catch (err) {
          addToast("Error de conexión: " + String(err), "error");
        }
      },
      "Vaciar Historial",
      "Vaciar Todo"
    );
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
    <>
      <div className="fixed inset-0 z-40 bg-[#f8fafc]/95 text-zinc-900 backdrop-blur-xl overflow-y-auto p-4 sm:p-8 pt-20 sm:pt-24">

        {/* ── Marca de fondo TECH TI en esquina superior derecha ── */}
        <div
          aria-hidden
          className="pointer-events-none fixed top-4 sm:top-2 right-4 sm:right-10 z-0 select-none overflow-hidden text-right"
        >
          <span
            className="block text-[clamp(6rem,18vw,16rem)] font-black uppercase leading-none tracking-tight text-black/[0.08] select-none"
            style={{
              fontFamily: "Inter, system-ui, -apple-system, sans-serif",
              userSelect: "none",
            }}
          >
            TECH TI
          </span>
        </div>

        <div className="max-w-6xl mx-auto space-y-6 relative z-10">

          {/* Cabecera Limpia */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-zinc-200/60">
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-zinc-900">
                Métricas de Aforo y Tráfico
              </h1>
              <p className="text-xs sm:text-sm text-zinc-500 mt-1">
                Registro histórico y monitoreo oficial de afluencia vehicular y peatonal · TECH TI Cloud.
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
                title="Descargar informe formateado TECH TI en Excel"
              >
                <Download className="h-3.5 w-3.5 text-[#f95721]" /> Exportar Excel
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

          {/* GRAFICA DE TENDENCIA EN VIVO (Vehiculos vs. Peatones con Tooltip interactivo) */}
          {datosGrafica.ordenadas.length > 0 && (
            <div className="bg-white border border-zinc-200/80 rounded-2xl p-5 shadow-sm space-y-4">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                <div>
                  <h2 className="text-sm sm:text-base font-bold text-zinc-900 flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-[#f95721]" /> Tendencia de Flujo en el Tiempo
                  </h2>
                  <p className="text-xs text-zinc-500">
                    Comparativa en tiempo real de vehículos y peatones detectados en las últimas muestras.
                  </p>
                </div>

                {/* Inspector de datos en tiempo real al pasar el cursor */}
                {puntoHover ? (
                  <div className="flex flex-wrap items-center gap-2.5 bg-zinc-900 text-zinc-200 px-3.5 py-1.5 rounded-xl text-xs shadow-sm border border-zinc-700 animate-in fade-in duration-150">
                    <span className="font-mono text-zinc-300 font-semibold">{puntoHover.fecha_hora}</span>
                    <span className="text-zinc-600">|</span>
                    <span className="flex items-center gap-1 text-[#c94c1a] font-semibold">
                      <Car className="h-3.5 w-3.5" /> {puntoHover.vehiculos} {puntoHover.vehiculos === 1 ? "auto" : "autos"}
                    </span>
                    <span className="flex items-center gap-1 text-slate-300 font-semibold">
                      <Users className="h-3.5 w-3.5" /> {puntoHover.peatones} {puntoHover.peatones === 1 ? "peatón" : "peatones"}
                    </span>
                    <span className="text-zinc-600">|</span>
                    <span className="text-zinc-400">
                      Congestión: <strong className="text-zinc-200">{puntoHover.flujo_porcentaje}%</strong> ({puntoHover.nivel_congestion})
                    </span>
                    <span className="text-zinc-500 text-[11px]">
                      Espera: <strong className="text-zinc-300">{puntoHover.total_espera}s</strong>
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center gap-4 text-xs font-medium">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#c94c1a]" />
                      <span className="text-zinc-600">Vehículos</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-slate-500" />
                      <span className="text-zinc-600">Peatones</span>
                    </div>
                    {solicitudesPeatonales.length > 0 && (
                      <div className="flex items-center gap-1.5 text-zinc-500 text-[11px]">
                        <Footprints className="h-3 w-3 text-zinc-500" />
                        <span>{solicitudesPeatonales.length} cruces pedidos</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Contenedor de Barras con espacio superior para Tooltip sin recortes */}
              <div className="h-48 sm:h-56 w-full flex items-end gap-2 sm:gap-4 pt-16 px-2 border-b border-zinc-100 overflow-x-auto no-scrollbar">
                {datosGrafica.ordenadas.map((d) => {
                  const alturaVeh = d.vehiculos === 0 ? 4 : Math.max(8, Math.round((d.vehiculos / datosGrafica.maxVal) * 100));
                  const alturaPeat = d.peatones === 0 ? 4 : Math.max(8, Math.round((d.peatones / datosGrafica.maxVal) * 100));
                  const horaCorta = new Date(d.fecha_hora).toLocaleTimeString("es-MX", {
                    hour: "2-digit",
                    minute: "2-digit",
                    hour12: false,
                  });

                  return (
                    <div
                      key={d.id}
                      onMouseEnter={() => setPuntoHover(d)}
                      onMouseLeave={() => setPuntoHover(null)}
                      className="flex-1 min-w-[40px] max-w-[80px] flex flex-col items-center justify-end h-full group relative cursor-pointer p-1"
                    >
                      {/* Tooltip flotante centrado sobre la columna al pasar el cursor */}
                      <div className="opacity-0 group-hover:opacity-100 transition-all duration-150 absolute -top-16 z-30 bg-zinc-900 text-zinc-200 text-[11px] py-1.5 px-3 rounded-xl pointer-events-none shadow-xl border border-zinc-700 flex flex-col items-center whitespace-nowrap">
                        <div className="font-mono text-[10px] text-zinc-400">{horaCorta}</div>
                        <div className="flex items-center gap-2.5 font-semibold mt-0.5">
                          <span className="text-[#c94c1a] flex items-center gap-1">
                            <Car className="h-3 w-3" /> {d.vehiculos}
                          </span>
                          <span className="text-slate-300 flex items-center gap-1">
                            <Users className="h-3 w-3" /> {d.peatones}
                          </span>
                        </div>
                        <div className="text-[9px] text-zinc-400 mt-0.5 font-sans">
                          Flujo {d.flujo_porcentaje}% · {d.nivel_congestion}
                        </div>
                        {/* Flechita inferior del tooltip */}
                        <div className="w-2 h-2 bg-zinc-900 rotate-45 absolute -bottom-1 border-r border-b border-zinc-700" />
                      </div>

                      <div className="w-full flex items-end justify-center gap-1.5 h-32 sm:h-36">
                        {/* Barra Vehículos */}
                        <div
                          style={{ height: `${alturaVeh}%` }}
                          className={`w-1/2 max-w-[14px] rounded-t-sm ${
                            d.vehiculos > 0 ? "bg-[#c94c1a]" : "bg-zinc-200"
                          }`}
                          title={`Vehículos: ${d.vehiculos}`}
                        />
                        {/* Barra Peatones */}
                        <div
                          style={{ height: `${alturaPeat}%` }}
                          className={`w-1/2 max-w-[14px] rounded-t-sm ${
                            d.peatones > 0 ? "bg-slate-500" : "bg-zinc-200"
                          }`}
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

          {/* FILTROS Y TABLA CRUD */}
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
                            className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold ${m.nivel_congestion === "Alto"
                              ? "bg-red-50 text-red-600 border border-red-200"
                              : m.nivel_congestion === "Medio"
                                ? "bg-amber-50 text-amber-700 border border-amber-200"
                                : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              }`}
                          >
                            {/* Status Dot Pulsante */}
                            <span
                              className={`w-1.5 h-1.5 rounded-full animate-pulse ${m.nivel_congestion === "Alto"
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

          {/* REGISTRO DE SOLICITUDES PEATONALES */}
          <div className="bg-white border border-zinc-200/80 rounded-2xl shadow-sm overflow-hidden mt-6">
            <div className="p-4 sm:p-5 border-b border-zinc-100 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <h2 className="text-sm sm:text-base font-bold text-zinc-900 flex items-center gap-2">
                  <Footprints className="h-4 w-4 text-[#f95721]" /> Solicitudes de Cruce Peatonal
                </h2>
                <span className="text-xs text-zinc-400 font-medium">
                  ({solicitudesPeatonales.length} registros)
                </span>
              </div>

              {solicitudesPeatonales.length > 0 && (
                <button
                  onClick={limpiarHistorialPeatones}
                  className="text-xs text-zinc-500 hover:text-red-600 font-medium flex items-center gap-1.5 transition self-end sm:self-auto cursor-pointer"
                  title="Vaciar solicitudes peatonales"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>Limpiar historial peatonal</span>
                </button>
              )}
            </div>

            {solicitudesPeatonales.length === 0 ? (
              <div className="py-10 text-center text-zinc-400 text-xs">
                <Footprints className="h-6 w-6 mx-auto mb-2 opacity-40 text-[#f95721]" />
                No hay solicitudes peatonales registradas todavía. Usa el botón de cruce en la cámara para generar solicitudes.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-zinc-100 bg-zinc-50/70 text-zinc-500 font-semibold">
                      <th className="py-3 px-3 sm:px-4">Zona</th>
                      <th className="py-3 px-3 sm:px-4">Hora de Solicitud</th>
                      <th className="py-3 px-3 sm:px-4">Tiempo de Espera</th>
                      <th className="py-3 px-3 sm:px-4">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 text-zinc-700">
                    {solicitudesPeatonales.map((sol) => (
                      <tr key={sol.id} className="hover:bg-zinc-50/60 transition">
                        <td className="py-3 px-3 sm:px-4 font-semibold text-zinc-900">
                          <span className="inline-flex items-center gap-2">
                            <span
                              className="w-2.5 h-2.5 rounded-full inline-block"
                              style={{
                                background: ["#64748b", "#6b7280", "#78716c", "#71717a"][sol.zona % 4],
                              }}
                            />
                            <span>Zona {sol.zona + 1}</span>
                          </span>
                        </td>
                        <td className="py-3 px-3 sm:px-4 text-zinc-600 font-mono">
                          {sol.hora}
                        </td>
                        <td className="py-3 px-3 sm:px-4 font-semibold text-zinc-800">
                          {sol.atendida ? `${sol.segundosEspera} s` : "Esperando semáforo en rojo..."}
                        </td>
                        <td className="py-3 px-3 sm:px-4">
                          {sol.atendida ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-zinc-100 text-zinc-700 border border-zinc-200">
                              <CheckCircle2 className="h-3 w-3 text-zinc-500" />
                              <span>Atendida</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-stone-100 text-stone-700 border border-stone-200 animate-pulse">
                              <Clock className="h-3 w-3 text-stone-500" />
                              <span>En Proceso</span>
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

        </div>

        {/* Cierre del contenedor con scroll para que los modales se centren en el viewport visible */}
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

      {/* MODAL CONFIRMAR ACCIÓN (Mismo estilo exacto que el modal de Editar) */}
      {confirmModal.visible && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl w-full max-w-md p-6 shadow-2xl border border-zinc-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-100">
              <h3 className="text-sm font-bold text-zinc-900 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-[#f95721]" />
                {confirmModal.titulo || "Confirmar Acción"}
              </h3>
              <button
                type="button"
                onClick={cerrarConfirm}
                className="p-1 text-zinc-400 hover:text-zinc-700 rounded-full hover:bg-zinc-100 transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="text-xs sm:text-sm text-zinc-600 leading-relaxed py-1">
              {confirmModal.msg}
            </p>

            <div className="flex justify-end gap-2 pt-3 border-t border-zinc-100">
              <button
                type="button"
                onClick={cerrarConfirm}
                className="px-4 py-2 rounded-full bg-zinc-100 hover:bg-zinc-200 text-zinc-700 font-medium transition text-xs sm:text-sm"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  confirmModal.onYes();
                  cerrarConfirm();
                }}
                className="flex items-center gap-1.5 px-5 py-2 rounded-full bg-red-600 hover:bg-red-700 text-white font-semibold transition shadow-sm active:scale-95 text-xs sm:text-sm"
              >
                <Trash2 className="h-3.5 w-3.5" />
                {confirmModal.textoConfirmar || "Eliminar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TOASTS (Alertas flotantes limpias TECH TI en pantalla actual) */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex flex-col-reverse gap-2 items-center pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-full shadow-2xl text-xs sm:text-sm font-semibold border pointer-events-auto transition-all animate-in fade-in slide-in-from-bottom-2 ${t.type === "error"
                ? "bg-white border-red-200 text-red-600 shadow-red-500/10"
                : "bg-white border-zinc-200 text-zinc-800 shadow-zinc-500/10"
              }`}
          >
            {t.type === "error" ? (
              <AlertTriangle className="h-4 w-4 text-red-500 flex-shrink-0" />
            ) : (
              <CheckCircle2 className="h-4 w-4 text-emerald-500 flex-shrink-0" />
            )}
            <span>{t.msg}</span>
          </div>
        ))}
      </div>
    </>
  );
}

export default DashboardMetricas;
