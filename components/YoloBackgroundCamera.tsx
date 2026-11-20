"use client";

import { useEffect, useRef, useState } from "react";
import { useYoloDetector } from "@/hooks/useYoloDetector";
import { useVideoSource } from "@/hooks/useVideoSource";
import { useInferenceLoop } from "@/hooks/useInferenceLoop";
import { useMqttSemaforos } from "@/hooks/useMqttSemaforos";
import type { Zone } from "@/lib/types";
import { Camera, Upload, Trash2, Video, RotateCw, Database, Check, Footprints, Clock, Lock, GripVertical, ChevronDown, ChevronUp } from "lucide-react";
import { type PedestrianState, type SolicitudPeatonal, STORAGE_KEY_SOLICITUDES } from "@/lib/pedestrianTypes";

// ── Parámetros de Cruce Peatonal ──
export const TIEMPO_CRUCE_FIJO_S = 10;     // Tiempo de cruce fijo para peatones (10s)
export const COOLDOWN_CRUCE_S = 20;        // Tiempo bloqueado tras cruzar (20s)
export const USAR_CONTEO_PERSONAS = false; // Desactivado por ahora (listo para activar luego)

interface Props {
  onDetections?: (count: number) => void;
  initialModelMode?: "general" | "toycars";
}

const MAX_ZONES = 4;
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

export default function YoloBackgroundCamera({ onDetections, initialModelMode = "general" }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const zonesRef = useRef<Zone[]>([]);
  const draftRef = useRef<Zone | null>(null);
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);

  const [error, setError] = useState("");
  const [, setAspect] = useState(16 / 9);
  const [zones, setZones] = useState<Zone[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [rotacion, setRotacion] = useState<0 | 90 | 180 | 270>(0);

  // Posicion del panel flotante de peatones (arrastrable)
  const [panelPos, setPanelPos] = useState<{ x: number; y: number }>({ x: 20, y: 75 });
  const [panelDragging, setPanelDragging] = useState(false);
  const [panelColapsado, setPanelColapsado] = useState(false);
  const dragPanelOffsetRef = useRef<{ offsetX: number; offsetY: number }>({ offsetX: 0, offsetY: 0 });

  const onStartDragPanel = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    dragPanelOffsetRef.current = {
      offsetX: e.clientX - panelPos.x,
      offsetY: e.clientY - panelPos.y,
    };
    setPanelDragging(true);
  };

  useEffect(() => {
    if (!panelDragging) return;

    const onPanelMove = (e: PointerEvent) => {
      const maxX = Math.max(10, window.innerWidth - 300);
      const maxY = Math.max(10, window.innerHeight - 100);
      const newX = Math.max(10, Math.min(maxX, e.clientX - dragPanelOffsetRef.current.offsetX));
      const newY = Math.max(10, Math.min(maxY, e.clientY - dragPanelOffsetRef.current.offsetY));
      setPanelPos({ x: newX, y: newY });
    };

    const onPanelUp = () => {
      setPanelDragging(false);
    };

    window.addEventListener("pointermove", onPanelMove);
    window.addEventListener("pointerup", onPanelUp);
    return () => {
      window.removeEventListener("pointermove", onPanelMove);
      window.removeEventListener("pointerup", onPanelUp);
    };
  }, [panelDragging]);

  // 1. Exact detector hook with dynamic mode support
  const { detectorRef, modelStatus, backend, setBackend, modelMode, setModelMode } =
    useYoloDetector(initialModelMode);

  // Sync initialModelMode when parent viewMode changes
  useEffect(() => {
    if (initialModelMode) {
      setModelMode(initialModelMode);
    }
  }, [initialModelMode, setModelMode]);

  // 2. Exact video source hook from /demo
  const { source, startWebcam, onFile, devices, deviceId, setDeviceId, stopSource, refreshDevices } =
    useVideoSource(videoRef, setError);

  // 3. Exact inference loop and canvas renderer from /demo
  const { total, fps, commitZones, detsRef, lights, controllerRef } = useInferenceLoop({
    videoRef,
    canvasRef,
    detectorRef,
    zonesRef,
    draftRef,
    rotacion,
    onError: setError,
    onResize: setAspect,
    onUpdate: setBackend,
  });

  // 4. Conexión MQTT con ESP32 para sincronizar semáforos físicos
  const { send: sendMqtt, status: mqttStatus, connected: mqttConnected } = useMqttSemaforos();

  // 5. Lógica de Cruce Peatonal por Zona (Estado único sincronizado)
  type ZonaPeatonalInfo = {
    estado: PedestrianState;
    cuenta: number;
    solicitadoAt?: number;
  };

  const [zonasPeatonal, setZonasPeatonal] = useState<ZonaPeatonalInfo[]>([
    { estado: "normal", cuenta: 0 },
    { estado: "normal", cuenta: 0 },
    { estado: "normal", cuenta: 0 },
    { estado: "normal", cuenta: 0 },
  ]);

  const zonasPeatonalRef = useRef(zonasPeatonal);
  zonasPeatonalRef.current = zonasPeatonal;

  const lightsRefCurrent = useRef(lights);
  lightsRefCurrent.current = lights;

  const solicitudesRef = useRef<Record<number, SolicitudPeatonal>>({});
  const [notificacionPeatonal, setNotificacionPeatonal] = useState<string | null>(null);

  // Solicitar cruce peatonal para la Zona N (índice 0-based)
  const pedirCruce = (zonaIdx: number) => {
    // 1. Regla de seguridad vial: Solo UN cruce peatonal activo a la vez en todo el sistema
    const hayOtroCruceActivo = zonasPeatonalRef.current.some(
      (z, i) => i < zones.length && (z.estado === "solicitado" || z.estado === "cruzando")
    );
    if (hayOtroCruceActivo) {
      setNotificacionPeatonal("Ya hay una solicitud de cruce en proceso. Espera a que termine.");
      setTimeout(() => setNotificacionPeatonal(null), 3000);
      return;
    }

    // 2. Si esta zona ya está en solicitado, cruzando o cooldown, ignorar clic
    const actual = zonasPeatonalRef.current[zonaIdx]?.estado ?? "normal";
    if (actual !== "normal") return;

    // 3. Bloquear la zona en el controlador vehicular
    const exitoBloqueo = controllerRef.current?.blockZone(zonaIdx, true) ?? true;
    if (!exitoBloqueo) {
      setNotificacionPeatonal("Por seguridad, al menos una zona vehicular debe permanecer libre.");
      setTimeout(() => setNotificacionPeatonal(null), 3500);
      return;
    }

    // 4. Crear registro de solicitud para dashboard y TiDB
    const ahora = new Date();
    const id = `sol-${Date.now()}-${zonaIdx}`;
    const horaStr = ahora.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    const nuevaSolicitud: SolicitudPeatonal = {
      id,
      zona: zonaIdx,
      hora: horaStr,
      timestampInicio: Date.now(),
      segundosEspera: 0,
      atendida: false,
    };
    solicitudesRef.current[zonaIdx] = nuevaSolicitud;

    // localStorage (dashboard local)
    try {
      const raw = localStorage.getItem(STORAGE_KEY_SOLICITUDES);
      const prev: SolicitudPeatonal[] = raw ? JSON.parse(raw) : [];
      const updated = [nuevaSolicitud, ...prev.slice(0, 99)];
      localStorage.setItem(STORAGE_KEY_SOLICITUDES, JSON.stringify(updated));
      window.dispatchEvent(new Event("smarttraffic_solicitudes_actualizadas"));
    } catch (e) {
      console.warn("Error guardando solicitud peatonal en localStorage:", e);
    }

    // TiDB Cloud — guardar solicitud inicial (atendida=false, espera=0)
    fetch("/api/solicitudes-peatonales", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        zona: zonaIdx,
        hora_solicitud: horaStr,
        segundos_espera: 0,
        atendida: false,
      }),
    })
      .then((r) => r.json())
      .then((data) => {
        // Guardamos el ID de TiDB en la solicitud para actualizar luego con PATCH
        if (data.ok && data.resultado?.insertId) {
          solicitudesRef.current[zonaIdx] = {
            ...nuevaSolicitud,
            tidbId: data.resultado.insertId,
          };
        }
      })
      .catch((e) => console.warn("Error guardando solicitud en TiDB:", e));

    // 5. Iniciar SIEMPRE en estado 'solicitado' (ámbar).
    setZonasPeatonal((prev) => {
      const next = [...prev];
      next[zonaIdx] = { estado: "solicitado", cuenta: 0, solicitadoAt: Date.now() };
      return next;
    });

    setNotificacionPeatonal(`Zona ${zonaIdx + 1}: Cruce solicitado. Deteniendo vehículos (cambio a rojo)...`);
    setTimeout(() => setNotificacionPeatonal(null), 3500);
  };

  // Temporizador único por segundo: transiciones y cuentas regresivas sin bucles
  useEffect(() => {
    const timer = setInterval(() => {
      setZonasPeatonal((prev) => {
        let cambio = false;
        const next = [...prev];
        const currentLights = lightsRefCurrent.current;

        for (let i = 0; i < 4; i++) {
          const item = prev[i] || { estado: "normal", cuenta: 0 };
          const luzZona = currentLights[i] ?? "green";

          // CASO 1: Está en 'solicitado' y el semáforo vehicular YA pasó físicamente a 'red'
          if (item.estado === "solicitado") {
            if (luzZona === "red") {
              const sol = solicitudesRef.current[i];
              if (sol && !sol.atendida) {
                sol.atendida = true;
                sol.segundosEspera = Math.max(
                  1,
                  Math.round((Date.now() - (item.solicitadoAt || sol.timestampInicio)) / 1000)
                );

                // Actualizar localStorage (dashboard local)
                try {
                  const raw = localStorage.getItem(STORAGE_KEY_SOLICITUDES);
                  if (raw) {
                    const list: SolicitudPeatonal[] = JSON.parse(raw);
                    const idx = list.findIndex((s) => s.id === sol.id);
                    if (idx !== -1) {
                      list[idx].atendida = true;
                      list[idx].segundosEspera = sol.segundosEspera;
                      localStorage.setItem(STORAGE_KEY_SOLICITUDES, JSON.stringify(list));
                      window.dispatchEvent(new Event("smarttraffic_solicitudes_actualizadas"));
                    }
                  }
                } catch (e) { }

                // PATCH en TiDB Cloud: marcar como atendida con segundos de espera reales
                if (sol.tidbId) {
                  fetch("/api/solicitudes-peatonales", {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      id: sol.tidbId,
                      atendida: true,
                      segundos_espera: sol.segundosEspera,
                    }),
                  }).catch((e) => console.warn("Error actualizando solicitud en TiDB:", e));
                }
              }

              next[i] = { estado: "cruzando", cuenta: TIEMPO_CRUCE_FIJO_S };
              cambio = true;
            }
          }
          // CASO 2: Está 'cruzando' (cuenta regresiva de 10s a 1s)
          else if (item.estado === "cruzando") {
            if (item.cuenta > 1) {
              next[i] = { ...item, cuenta: item.cuenta - 1 };
              cambio = true;
            } else {
              // Fin de cruce: desbloquear zona vehicular y pasar a cooldown de 20s
              controllerRef.current?.blockZone(i, false);
              next[i] = { estado: "bloqueado", cuenta: COOLDOWN_CRUCE_S };
              cambio = true;
            }
          }
          // CASO 3: Está 'bloqueado' (cooldown de 20s a 1s)
          else if (item.estado === "bloqueado") {
            if (item.cuenta > 1) {
              next[i] = { ...item, cuenta: item.cuenta - 1 };
              cambio = true;
            } else {
              // Fin de cooldown: vuelve a disponible
              next[i] = { estado: "normal", cuenta: 0 };
              cambio = true;
            }
          }
        }

        return cambio ? next : prev;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Publicar estados de semáforos y blancos por MQTT al ESP32 (formato "G,R,R,R|0,0,0,0")
  useEffect(() => {
    const states = ["R", "R", "R", "R"];
    if (lights && lights.length > 0) {
      lights.forEach((l, i) => {
        if (i < 4) {
          states[i] = l === "green" ? "G" : l === "yellow" ? "Y" : "R";
        }
      });
    }

    // Regla de seguridad física estricta:
    // El LED blanco SOLO puede estar en 1 si el semáforo vehicular de esa zona está en 'R' (Rojo)
    // Y el peatón está en fase de cruce activo
    const blancosSeguros: (0 | 1)[] = [0, 0, 0, 0];
    for (let i = 0; i < 4; i++) {
      if (zonasPeatonal[i]?.estado === "cruzando" && states[i] === "R") {
        blancosSeguros[i] = 1;
      } else {
        blancosSeguros[i] = 0;
      }
    }

    sendMqtt(states, blancosSeguros);
  }, [lights, zonasPeatonal, sendMqtt]);

  // Guardado periódico en TiDB
  const [intervaloMinutos, setIntervaloMinutos] = useState<number>(1);
  const [guardandoDB, setGuardandoDB] = useState(false);
  const [guardadoExitoso, setGuardadoExitoso] = useState(false);

  // Refs para capturar siempre los valores más recientes sin reiniciar el timer
  const latestDataRef = useRef({ total: 0, fps: 0, modelMode: "dual" });
  latestDataRef.current = { total, fps, modelMode };

  const guardarLecturaTiDB = async () => {
    if (guardandoDB) return;
    setGuardandoDB(true);
    try {
      const dets = detsRef?.current || [];
      const vehiculos = dets.filter((d) => {
        const lbl = (d.label || "").toLowerCase();
        return (
          d.isToyCar ||
          ["carro", "car", "camión", "autobús", "motocicleta", "toy-car", "toy cars"].some((v) => lbl.includes(v))
        );
      }).length;
      const peatones = dets.filter((d) => {
        const lbl = (d.label || "").toLowerCase();
        return lbl.includes("persona") || lbl.includes("person") || d.classId === 0;
      }).length;

      const currentTotal = latestDataRef.current.total;
      const currentFps = latestDataRef.current.fps;
      const currentMode = latestDataRef.current.modelMode;

      const nivel = currentTotal > 15 ? "Alto" : currentTotal > 6 ? "Medio" : "Bajo";
      const flujo = Math.min(100, Math.round((currentTotal / 20) * 100));

      console.log("Guardando automáticamente en base de datos...", { vehiculos, peatones, currentTotal });

      const res = await fetch("/api/metricas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          camara: currentMode,
          vehiculos,
          peatones,
          total_espera: Math.max(0, vehiculos - 2),
          nivel_congestion: nivel,
          flujo_porcentaje: flujo,
          fps_promedio: currentFps,
        }),
      });

      if (res.ok) {
        setGuardadoExitoso(true);
        setTimeout(() => setGuardadoExitoso(false), 3000);
      }
    } catch (e) {
      console.error("Error guardando en TiDB:", e);
    } finally {
      setGuardandoDB(false);
    }
  };

  // Timer ESTABLE: No se reinicia con cada frame de detección (fps o total)
  useEffect(() => {
    if (!intervaloMinutos || intervaloMinutos <= 0) return;
    const ms = intervaloMinutos * 60 * 1000;

    const timer = setInterval(() => {
      guardarLecturaTiDB();
    }, ms);

    return () => clearInterval(timer);
  }, [intervaloMinutos]);

  // Auto-start camera on mount, stop on unmount
  useEffect(() => {
    startWebcam();
    return () => {
      stopSource();
    };
  }, [startWebcam, stopSource]);

  // Sync detections with parent dashboard (guard against re-triggering parent renders)
  const prevTotalRef = useRef<number>(-1);
  useEffect(() => {
    if (prevTotalRef.current !== total) {
      prevTotalRef.current = total;
      onDetections?.(total);
    }
  }, [total, onDetections]);

  // Zone management (same as /demo)
  const handleCommitZones = (next: Zone[]) => {
    zonesRef.current = next;
    setZones(next);
    commitZones(next);
    if (next.length === 0) {
      setZonasPeatonal([
        { estado: "normal", cuenta: 0 },
        { estado: "normal", cuenta: 0 },
        { estado: "normal", cuenta: 0 },
        { estado: "normal", cuenta: 0 },
      ]);
      controllerRef.current?.setBlockedZones([]);
    }
  };

  // Eliminar una zona individualmente sin borrar las demas
  const eliminarZonaIndividual = (zonaIdx: number) => {
    const nextZones = zones.filter((_, idx) => idx !== zonaIdx);
    setZonasPeatonal((prev) => {
      const next = prev.filter((_, idx) => idx !== zonaIdx);
      while (next.length < 4) {
        next.push({ estado: "normal", cuenta: 0 });
      }
      return next;
    });
    handleCommitZones(nextZones);
  };

  // Reordenar / intercambiar numero de zona entre las zonas dibujadas
  const reordenarZona = (origenIdx: number, destinoIdx: number) => {
    if (origenIdx === destinoIdx || destinoIdx < 0 || destinoIdx >= zones.length) return;
    const nextZones = [...zones];
    const temp = nextZones[origenIdx];
    nextZones[origenIdx] = nextZones[destinoIdx];
    nextZones[destinoIdx] = temp;

    setZonasPeatonal((prev) => {
      const next = [...prev];
      const tempP = next[origenIdx];
      next[origenIdx] = next[destinoIdx];
      next[destinoIdx] = tempP;
      return next;
    });

    handleCommitZones(nextZones);
  };

  // Convierte coordenadas de cliente a normalizadas [0,1] usando el canvas como referencia
  const toNorm = (clientX: number, clientY: number) => {
    const r = canvasRef.current?.getBoundingClientRect();
    if (!r) return { x: 0, y: 0 };
    return {
      x: clamp01((clientX - r.left) / r.width),
      y: clamp01((clientY - r.top) / r.height),
    };
  };

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if ((zonesRef.current ?? []).length >= MAX_ZONES) return;
    e.preventDefault();
    dragStartRef.current = toNorm(e.clientX, e.clientY);
    setIsDrawing(true);
  };

  // Listeners globales en window para que el drag no se trabe al pasar sobre paneles
  useEffect(() => {
    if (!isDrawing) return;

    const onMove = (e: PointerEvent) => {
      const s = dragStartRef.current;
      if (!s) return;
      const p = toNorm(e.clientX, e.clientY);
      draftRef.current = {
        x: Math.min(s.x, p.x),
        y: Math.min(s.y, p.y),
        w: Math.abs(p.x - s.x),
        h: Math.abs(p.y - s.y),
      };
    };

    const onUp = () => {
      const z = draftRef.current;
      dragStartRef.current = null;
      draftRef.current = null;
      setIsDrawing(false);
      if (z && z.w > 0.03 && z.h > 0.03) {
        handleCommitZones([...(zonesRef.current ?? []), z]);
      }
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDrawing]);

  return (
    <div className="fixed inset-0 z-10 bg-zinc-950 overflow-hidden select-none">
      {/* ── Exact Video feed from /demo (1:1, fixed, no zoom shake) ── */}
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        className={`absolute inset-0 w-full h-full object-cover z-0 transition-transform duration-200 ${rotacion === 90
            ? "rotate-90 scale-[1.35]"
            : rotacion === 180
              ? "rotate-180"
              : rotacion === 270
                ? "-rotate-90 scale-[1.35]"
                : ""
          }`}
        onLoadedMetadata={() => videoRef.current?.play().catch(() => { })}
      />

      {/* ── Exact Canvas overlay from /demo with Cyan boxes & Traffic Zones ── */}
      <canvas
        ref={canvasRef}
        className={`absolute inset-0 w-full h-full object-cover z-10 cursor-crosshair touch-none transition-transform duration-200 ${rotacion === 90
            ? "rotate-90 scale-[1.35]"
            : rotacion === 180
              ? "rotate-180"
              : rotacion === 270
                ? "-rotate-90 scale-[1.35]"
                : ""
          }`}
        style={{ touchAction: "none" }}
        onPointerDown={onPointerDown}
      />

      {/* ── Panel Flotante de Cruce Peatonal por Zona (Arrastrable por el usuario) ── */}
      {zones.length > 0 && (
        <div
          style={{
            left: `${panelPos.x}px`,
            top: `${panelPos.y}px`,
          }}
          className={`fixed z-40 flex flex-col gap-2 bg-zinc-900/95 backdrop-blur-md border border-zinc-700/60 p-3 sm:p-3.5 rounded-2xl shadow-2xl w-[285px] sm:w-[315px] text-white pointer-events-auto transition-opacity duration-150 ${
            isDrawing ? "opacity-0 pointer-events-none" : "opacity-100"
          }`}
        >
          {/* Cabecera con Grip para arrastrar y botón para colapsar */}
          <div
            onPointerDown={onStartDragPanel}
            className="flex items-center justify-between gap-2 pb-1.5 border-b border-zinc-700/50 cursor-grab active:cursor-grabbing select-none"
            title="Arrastra desde aquí para mover el panel"
          >
            <div className="flex items-center gap-1.5">
              <GripVertical className="h-4 w-4 text-zinc-500 flex-shrink-0" />
              <Footprints className="h-4 w-4 text-[#c94c1a]" />
              <span className="text-xs font-bold font-sans tracking-tight text-zinc-100">Cruce Peatonal</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-zinc-500 font-mono bg-zinc-800 px-2 py-0.5 rounded-full border border-zinc-700">
                {TIEMPO_CRUCE_FIJO_S}s · {COOLDOWN_CRUCE_S}s
              </span>
              <button
                type="button"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  setPanelColapsado(!panelColapsado);
                }}
                className="p-1 rounded text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition cursor-pointer"
                title={panelColapsado ? "Expandir panel" : "Minimizar panel"}
              >
                {panelColapsado ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
              </button>
            </div>
          </div>

          {!panelColapsado && (
            <>
              {/* Lista de botones: EXACTAMENTE los rectángulos dibujados por el usuario */}
              <div className="flex flex-col gap-1.5 mt-1">
                {zones.map((_, i) => {
                  const info = zonasPeatonal[i] ?? { estado: "normal", cuenta: 0 };
                  const estado = info.estado;
                  const cuenta = info.cuenta;
                  const luz = lights[i] ?? (i === 0 ? "green" : "red");

                  // Dots de zona: tonos apagados slate/stone, no neón
                  const colorZona = ["#64748b", "#6b7280", "#78716c", "#71717a"][i % 4];

                  // Color del indicador de semáforo: apagado, no brillante
                  const luzColor =
                    luz === "green" ? "#4ade80" : luz === "yellow" ? "#ca8a04" : "#b45252";
                  const luzLabel =
                    luz === "green" ? "● Verde" : luz === "yellow" ? "● Amarillo" : "● Rojo";

                  // Si otra zona ya está solicitada o cruzando, deshabilitar temporalmente este botón
                  const otraZonaActiva = zonasPeatonal.some(
                    (z, idx) => idx !== i && idx < zones.length && (z.estado === "solicitado" || z.estado === "cruzando")
                  );

                  return (
                    <div
                      key={i}
                      className="flex items-center justify-between gap-1.5 bg-zinc-800/60 hover:bg-zinc-800 p-2 rounded-xl border border-zinc-700/40 transition"
                    >
                      {/* Info de zona */}
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span
                          className="w-2 h-2 rounded-full flex-shrink-0 opacity-80"
                          style={{ background: colorZona }}
                        />
                        <div className="flex flex-col">
                          <div className="flex items-center gap-1">
                            {zones.length > 1 ? (
                              <select
                                value={i}
                                onPointerDown={(e) => e.stopPropagation()}
                                onMouseDown={(e) => e.stopPropagation()}
                                onChange={(e) => {
                                  e.stopPropagation();
                                  reordenarZona(i, Number(e.target.value));
                                }}
                                className="bg-zinc-800 text-zinc-200 text-[11px] font-semibold rounded px-1.5 py-0.5 border border-zinc-700/60 outline-none cursor-pointer hover:border-zinc-500 pointer-events-auto"
                                title="Cambiar número / orden de esta zona"
                              >
                                {zones.map((_, idx) => (
                                  <option key={idx} value={idx}>
                                    Zona {idx + 1}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <span className="text-xs font-semibold font-sans leading-none text-zinc-200">
                                Zona {i + 1}
                              </span>
                            )}

                            {/* Botón para eliminar solo esta zona */}
                            <button
                              type="button"
                              onPointerDown={(e) => e.stopPropagation()}
                              onMouseDown={(e) => e.stopPropagation()}
                              onClick={(e) => {
                                e.stopPropagation();
                                eliminarZonaIndividual(i);
                              }}
                              className="p-1 rounded text-zinc-400 hover:text-red-400 hover:bg-zinc-700/60 transition cursor-pointer pointer-events-auto"
                              title={`Eliminar solo Zona ${i + 1}`}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>

                          <span className="text-[9px] font-mono mt-0.5" style={{ color: luzColor }}>
                            {luzLabel}
                          </span>
                        </div>
                      </div>

                      {/* Botón interactivo con sus 4 estados */}
                      {estado === "normal" && (
                        <button
                          type="button"
                          disabled={otraZonaActiva}
                          onPointerDown={(e) => {
                            e.stopPropagation();
                            if (!otraZonaActiva) pedirCruce(i);
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (!otraZonaActiva) pedirCruce(i);
                          }}
                          className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold flex items-center gap-1 transition ${
                            otraZonaActiva
                              ? "bg-zinc-700/50 text-zinc-500 cursor-not-allowed border border-zinc-600/30"
                              : "bg-[#c94c1a] hover:bg-[#b84418] active:scale-95 text-white cursor-pointer shadow-sm"
                          }`}
                          title={
                            otraZonaActiva
                              ? "Espera a que termine el cruce activo en otra zona"
                              : `Solicitar paso peatonal en Zona ${i + 1}`
                          }
                        >
                          <Footprints className="h-3 w-3" />
                          <span>{otraZonaActiva ? "En espera" : "Pedir Cruce"}</span>
                        </button>
                      )}

                      {estado === "solicitado" && (
                        <div
                          className="px-2.5 py-1.5 rounded-lg bg-yellow-900/40 border border-yellow-700/50 text-yellow-400/90 text-[11px] font-semibold flex items-center gap-1 animate-pulse"
                          title="Esperando que el semáforo vehicular pase a rojo"
                        >
                          <Clock className="h-3 w-3" />
                          <span>Solicitado...</span>
                        </div>
                      )}

                      {estado === "cruzando" && (
                        <div
                          className="px-2.5 py-1.5 rounded-lg bg-emerald-900/60 border border-emerald-700/50 text-emerald-300 text-[11px] font-bold flex items-center gap-1.5"
                          title="Paso peatonal activo. LED blanco encendido en ESP32."
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping inline-block" />
                          <span>Cruzar ({cuenta}s)</span>
                        </div>
                      )}

                      {estado === "bloqueado" && (
                        <div
                          className="px-2.5 py-1.5 rounded-lg bg-zinc-800 text-zinc-500 text-[11px] font-medium flex items-center gap-1 border border-zinc-700/40"
                          title="Tiempo de espera preventivo antes de permitir otro cruce"
                        >
                          <Lock className="h-3 w-3" />
                          <span>Espera ({cuenta}s)</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {notificacionPeatonal && (
                <div className="mt-1 p-2 rounded-xl bg-zinc-800 border border-zinc-600/40 text-[11px] text-zinc-300 leading-snug">
                  {notificacionPeatonal}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── Inactive Overlay SOLO si ocurre un error real al abrir la cámara ── */}
      {source === "ninguna" && Boolean(error) && (
        <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center z-20 bg-black/80 backdrop-blur-sm">
          <div className="h-16 w-16 rounded-2xl bg-[#e00000]/20 border border-[#e00000]/30 flex items-center justify-center text-[#e00000] mb-4">
            <Video className="h-8 w-8" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2 font-display">Cámara no disponible</h2>
          <p className="text-sm text-zinc-400 max-w-sm mb-6">
            No se pudo iniciar la cámara automáticamente. Puedes reintentar o seleccionar otro dispositivo.
          </p>
          <div className="flex items-center gap-2 mb-4 bg-zinc-900/90 border border-white/10 px-3 py-2 rounded-xl">
            <Camera className="h-4 w-4 text-[#f95721] flex-shrink-0" />
            <select
              value={deviceId}
              onChange={(e) => {
                setDeviceId(e.target.value);
                localStorage.setItem("preferred_camera_id", e.target.value);
              }}
              className="bg-transparent text-zinc-200 text-xs font-sans outline-none cursor-pointer max-w-[220px] truncate"
            >
              {devices.length === 0 ? (
                <option value="" className="bg-zinc-900">Buscando cámaras…</option>
              ) : (
                devices.map((d, i) => (
                  <option key={d.deviceId} value={d.deviceId} className="bg-zinc-900">
                    {d.label || `Cámara ${i + 1}`}
                  </option>
                ))
              )}
            </select>
            <button
              onClick={() => refreshDevices()}
              className="p-1 hover:bg-white/10 rounded text-zinc-400 hover:text-white transition-colors"
              title="Actualizar lista de cámaras (Iriun Webcam, USB)"
            >
              <RotateCw className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="flex flex-wrap gap-3 justify-center">
            <button
              onClick={() => startWebcam(deviceId || undefined)}
              className="px-5 py-2.5 rounded-xl bg-[#e00000] hover:bg-[#ff1a1a] text-white text-xs font-bold flex items-center gap-2 shadow-lg transition-all active:scale-95"
            >
              <Camera className="h-4 w-4" />
              <span>Reintentar Cámara</span>
            </button>
            <label className="px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold flex items-center gap-2 cursor-pointer transition-all border border-white/10">
              <Upload className="h-4 w-4" />
              <span>Subir Video</span>
              <input type="file" accept="video/*" onChange={onFile} className="sr-only" />
            </label>
          </div>
          {error && (
            <div className="mt-4 p-3 rounded-lg bg-red-500/20 border border-red-500/30 text-xs text-red-300 max-w-md">
              {error}
            </div>
          )}
        </div>
      )}

      {/* ── Bottom Floating Status Pill (Matches /demo stats) ── */}
      {source !== "ninguna" && (
        <div className={`fixed bottom-4 sm:bottom-6 right-3 sm:right-6 z-30 flex items-center gap-2 bg-zinc-900/95 backdrop-blur-md border border-zinc-700/50 px-3 sm:px-3.5 py-1.5 rounded-full text-white text-xs font-mono shadow-xl pointer-events-auto max-w-[calc(100vw-1.5rem)] overflow-x-auto no-scrollbar transition-opacity duration-150 ${isDrawing ? "opacity-0 pointer-events-none" : ""}`}>
          {/* Status Dot modelo */}
          <span className="relative flex h-2 w-2">
            {modelStatus === "listo" && (
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-zinc-400 opacity-50" />
            )}
            <span
              className={`relative inline-flex rounded-full h-2 w-2 ${modelStatus === "listo" ? "bg-zinc-300" : "bg-yellow-700"
                }`}
            />
            />
          </span>

          <span className="font-semibold text-zinc-300">
            {modelStatus === "cargando" ? "Cargando…" : backend || "YOLO26n"}
          </span>

          <span className="text-zinc-600">|</span>

          {/* Selector de Modelo IA */}
          <select
            value={modelMode}
            onChange={(e) => setModelMode(e.target.value as any)}
            className="bg-zinc-800 border border-zinc-700 text-zinc-300 font-semibold rounded px-2 py-0.5 text-[11px] font-sans outline-none cursor-pointer"
            title="Seleccionar modelo de detección"
          >
            <option value="general">General (COCO)</option>
            <option value="toycars">ToyCars (toycars.onnx)</option>
          </select>

          <span className="text-zinc-600">|</span>

          {/* Detecciones */}
          <span className="text-zinc-200 font-bold">{total} detectados</span>

          <span className="text-zinc-600">|</span>

          {/* FPS */}
          <span className="text-zinc-400 font-bold">{fps} FPS</span>

          {/* Limpiar zonas */}
          {zones.length > 0 && (
            <>
              <span className="text-zinc-600">|</span>
              <button
                onClick={() => handleCommitZones([])}
                className="flex items-center gap-1 text-zinc-500 hover:text-zinc-300 transition-colors text-[11px]"
                title="Borrar zonas de tráfico"
              >
                <Trash2 className="h-3 w-3" />
                <span>Limpiar ({zones.length})</span>
              </button>
            </>
          )}

          {/* Selector de cámara */}
          <span className="text-zinc-600">|</span>
          <div className="flex items-center gap-1">
            <select
              value={deviceId}
              onChange={(e) => {
                setDeviceId(e.target.value);
                startWebcam(e.target.value);
              }}
              className="bg-zinc-800 border border-zinc-700 text-zinc-300 rounded px-2 py-0.5 text-[11px] font-sans font-medium outline-none cursor-pointer max-w-[130px] sm:max-w-[180px] truncate"
              title="Seleccionar cámara"
            >
              {devices.length === 0 ? (
                <option value="">Buscando cámaras…</option>
              ) : (
                devices.map((d, i) => (
                  <option key={d.deviceId} value={d.deviceId}>
                    {d.label || `Cámara ${i + 1}`}
                  </option>
                ))
              )}
            </select>
            <button
              onClick={() => refreshDevices()}
              className="p-1 hover:bg-zinc-700 rounded text-zinc-500 hover:text-zinc-300 transition-colors"
              title="Actualizar lista de cámaras"
            >
              <RotateCw className="h-3 w-3" />
            </button>
          </div>

          {/* Girar cámara */}
          <button
            onClick={() => setRotacion((prev) => ((prev + 90) % 360) as 0 | 90 | 180 | 270)}
            className={`p-1 px-2 rounded text-[11px] font-sans font-semibold flex items-center gap-1 transition-all ${rotacion !== 0
                ? "bg-zinc-700 text-zinc-200 ring-1 ring-zinc-500"
                : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-700/50"
              }`}
            title="Girar orientación de cámara"
          >
            <RotateCw className="h-3 w-3" />
            <span>{rotacion === 0 ? "Girar" : `${rotacion}°`}</span>
          </button>

          {/* Subir video */}
          <span className="text-zinc-600">|</span>
          <label
            className="p-1 hover:bg-zinc-700/50 rounded cursor-pointer text-zinc-500 hover:text-zinc-300 transition-colors"
            title="Cargar video"
          >
            <Upload className="h-3.5 w-3.5" />
            <input type="file" accept="video/*" onChange={onFile} className="sr-only" />
          </label>

          {/* Estado MQTT / ESP32 */}
          <span className="text-zinc-600">|</span>
          <div
            className="flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[10px] font-sans"
            style={{
              borderColor: mqttConnected ? "rgba(100,116,139,0.5)" : "rgba(63,63,70,0.6)",
              background: mqttConnected ? "rgba(51,65,85,0.5)" : "rgba(24,24,27,0.5)",
              color: mqttConnected ? "#94a3b8" : "#52525b",
            }}
            title={`Conexión MQTT para ESP32: ${mqttStatus}`}
          >
            <span
              className="h-1.5 w-1.5 rounded-full inline-block"
              style={{
                background: mqttConnected ? "#94a3b8" : mqttStatus === "conectando" ? "#854d0e" : "#7f1d1d",
              }}
            />
            <span className="font-semibold">ESP32</span>
          </div>

          {/* Control de Auto-guardado en TiDB */}
          <span className="text-zinc-600">|</span>
          <div className="flex items-center gap-1.5 bg-zinc-800/80 border border-zinc-700/50 px-2 py-0.5 rounded-full">
            <Database className="h-3 w-3 text-zinc-500" />
            <span className="text-[10px] text-zinc-500 font-sans">TiDB:</span>
            <select
              value={intervaloMinutos}
              onChange={(e) => setIntervaloMinutos(Number(e.target.value))}
              className="bg-transparent text-[10px] text-zinc-300 font-bold outline-none cursor-pointer"
              title="Intervalo para guardar métricas"
            >
              <option value={0} className="bg-zinc-900 text-zinc-400">Pausado</option>
              <option value={1} className="bg-zinc-900 text-zinc-200">Cada 1 min</option>
              <option value={5} className="bg-zinc-900 text-zinc-200">Cada 5 min</option>
              <option value={10} className="bg-zinc-900 text-zinc-200">Cada 10 min</option>
              <option value={30} className="bg-zinc-900 text-zinc-200">Cada 30 min</option>
            </select>

            <button
              onClick={guardarLecturaTiDB}
              disabled={guardandoDB}
              className={`p-1 rounded text-[10px] font-sans font-bold flex items-center gap-1 transition-all ${guardadoExitoso
                  ? "bg-zinc-600 text-zinc-200"
                  : "bg-zinc-700/50 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200"
                }`}
              title="Guardar una captura de métricas inmediatamente en TiDB"
            >
              {guardadoExitoso ? (
                <>
                  <Check className="h-3 w-3" />
                  <span className="hidden sm:inline">Guardado</span>
                </>
              ) : guardandoDB ? (
                <span>...</span>
              ) : (
                <span>Guardar</span>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
