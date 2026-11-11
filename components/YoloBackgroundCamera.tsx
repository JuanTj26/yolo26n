"use client";

import { useEffect, useRef, useState } from "react";
import { useYoloDetector } from "@/hooks/useYoloDetector";
import { useVideoSource } from "@/hooks/useVideoSource";
import { useInferenceLoop } from "@/hooks/useInferenceLoop";
import type { Zone } from "@/lib/types";
import { Camera, Upload, Trash2, Video, RotateCw, Database, Check } from "lucide-react";

interface Props {
  onDetections?: (count: number) => void;
  initialModelMode?: "dual" | "maqueta" | "toycars" | "general";
}

const MAX_ZONES = 4;
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

export default function YoloBackgroundCamera({ onDetections, initialModelMode = "dual" }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const zonesRef = useRef<Zone[]>([]);
  const draftRef = useRef<Zone | null>(null);
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);

  const [error, setError] = useState("");
  const [, setAspect] = useState(16 / 9);
  const [zones, setZones] = useState<Zone[]>([]);

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
  const { total, fps, commitZones, detsRef } = useInferenceLoop({
    videoRef,
    canvasRef,
    detectorRef,
    zonesRef,
    draftRef,
    onError: setError,
    onResize: setAspect,
    onUpdate: setBackend,
  });

  // Guardado periódico en TiDB
  const [intervaloMinutos, setIntervaloMinutos] = useState<number>(10);
  const [guardandoDB, setGuardandoDB] = useState(false);
  const [guardadoExitoso, setGuardadoExitoso] = useState(false);

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

      const nivel = total > 15 ? "Alto" : total > 6 ? "Medio" : "Bajo";
      const flujo = Math.min(100, Math.round((total / 20) * 100));

      await fetch("/api/metricas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          camara: modelMode,
          vehiculos,
          peatones,
          total_espera: Math.max(0, vehiculos - 2),
          nivel_congestion: nivel,
          flujo_porcentaje: flujo,
          fps_promedio: fps,
        }),
      });

      setGuardadoExitoso(true);
      setTimeout(() => setGuardadoExitoso(false), 3000);
    } catch (e) {
      console.error("Error guardando en TiDB:", e);
    } finally {
      setGuardandoDB(false);
    }
  };

  // Timer para auto-guardar en TiDB
  useEffect(() => {
    if (!intervaloMinutos || intervaloMinutos <= 0) return;
    const ms = intervaloMinutos * 60 * 1000;
    const timer = setInterval(() => {
      guardarLecturaTiDB();
    }, ms);
    return () => clearInterval(timer);
  }, [intervaloMinutos, modelMode, total, fps]);

  // Auto-start camera on mount, stop on unmount
  useEffect(() => {
    startWebcam();
    return () => {
      stopSource();
    };
  }, [startWebcam, stopSource]);

  // Sync detections with parent dashboard
  useEffect(() => {
    onDetections?.(total);
  }, [total, onDetections]);

  // Zone management (same as /demo)
  const handleCommitZones = (next: Zone[]) => {
    zonesRef.current = next;
    setZones(next);
    commitZones(next);
  };

  const toNorm = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return {
      x: clamp01((e.clientX - r.left) / r.width),
      y: clamp01((e.clientY - r.top) / r.height),
    };
  };

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if ((zonesRef.current ?? []).length >= MAX_ZONES) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragStartRef.current = toNorm(e);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const s = dragStartRef.current;
    if (!s) return;
    const p = toNorm(e);
    draftRef.current = {
      x: Math.min(s.x, p.x),
      y: Math.min(s.y, p.y),
      w: Math.abs(p.x - s.x),
      h: Math.abs(p.y - s.y),
    };
  };

  const onPointerUp = () => {
    const z = draftRef.current;
    dragStartRef.current = null;
    draftRef.current = null;
    if (z && z.w > 0.03 && z.h > 0.03) {
      handleCommitZones([...(zonesRef.current ?? []), z]);
    }
  };

  return (
    <div className="fixed inset-0 z-0 bg-zinc-950 overflow-hidden select-none">
      {/* ── Exact Video feed from /demo (1:1, fixed, no zoom shake) ── */}
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        className="absolute inset-0 w-full h-full object-cover z-0"
        onLoadedMetadata={() => videoRef.current?.play().catch(() => { })}
      />

      {/* ── Exact Canvas overlay from /demo with Cyan boxes & Traffic Zones ── */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full object-cover z-10 cursor-crosshair"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      />

      {/* ── Inactive Overlay if camera is off ── */}
      {source === "ninguna" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center z-20 bg-black/80 backdrop-blur-sm">
          <div className="h-16 w-16 rounded-2xl bg-[#e00000]/20 border border-[#e00000]/30 flex items-center justify-center text-[#e00000] mb-4">
            <Video className="h-8 w-8" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2 font-display">Cámara YOLO26n (Demo)</h2>
          <p className="text-sm text-zinc-400 max-w-sm mb-6">
            Activa tu cámara web o sube un video para iniciar la detección en tiempo real.
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
              <span>Activar Cámara</span>
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
        <div className="fixed bottom-4 sm:bottom-6 right-3 sm:right-6 z-30 flex items-center gap-2 bg-black/85 backdrop-blur-md border border-white/15 px-3 sm:px-3.5 py-1.5 rounded-full text-white text-xs font-mono shadow-2xl pointer-events-auto max-w-[calc(100vw-1.5rem)] overflow-x-auto no-scrollbar">
          {/* Status Dot */}
          <span className="relative flex h-2 w-2">
            {modelStatus === "listo" && (
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            )}
            <span
              className={`relative inline-flex rounded-full h-2 w-2 ${modelStatus === "listo" ? "bg-emerald-500" : "bg-amber-400"
                }`}
            />
          </span>

          <span className="font-semibold text-zinc-200">
            {modelStatus === "cargando" ? "Cargando…" : backend || "YOLO26n"}
          </span>

          <span className="text-zinc-600">|</span>

          {/* Selector de Modelo IA */}
          <select
            value={modelMode}
            onChange={(e) => setModelMode(e.target.value as any)}
            className="bg-zinc-800 border border-white/20 text-[#f95721] font-semibold rounded px-2 py-0.5 text-[11px] font-sans outline-none cursor-pointer"
            title="Seleccionar modelo de detección"
          >
            <option value="maqueta">🏎️ Maqueta (best.onnx)</option>
            <option value="toycars">🚗 ToyCars (toycars.onnx)</option>
            <option value="dual">👥 Dual (Carritos + Personas)</option>
            <option value="general">🌐 General (COCO)</option>
          </select>

          <span className="text-zinc-600">|</span>

          {/* Detections */}
          <span className="text-cyan-400 font-bold">{total} detectados</span>

          <span className="text-zinc-600">|</span>

          {/* FPS */}
          <span className="text-emerald-400 font-bold">{fps} FPS</span>

          {/* Zones clean button if zones exist */}
          {zones.length > 0 && (
            <>
              <span className="text-zinc-600">|</span>
              <button
                onClick={() => handleCommitZones([])}
                className="flex items-center gap-1 text-red-400 hover:text-red-300 transition-colors text-[11px]"
                title="Borrar zonas de tráfico"
              >
                <Trash2 className="h-3 w-3" />
                <span>Limpiar ({zones.length})</span>
              </button>
            </>
          )}

          {/* Camera switcher (Always visible so user can pick Iriun Webcam / iPhone) */}
          <span className="text-zinc-600">|</span>
          <div className="flex items-center gap-1">
            <select
              value={deviceId}
              onChange={(e) => {
                setDeviceId(e.target.value);
                startWebcam(e.target.value);
              }}
              className="bg-zinc-800 border border-white/20 text-zinc-200 rounded px-2 py-0.5 text-[11px] font-sans font-medium outline-none cursor-pointer max-w-[130px] sm:max-w-[180px] truncate"
              title="Seleccionar cámara (ej. Iriun Webcam)"
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
              className="p-1 hover:bg-white/20 rounded text-zinc-400 hover:text-white transition-colors"
              title="Actualizar lista de cámaras (detectar Iriun)"
            >
              <RotateCw className="h-3 w-3" />
            </button>
          </div>

          {/* Upload video file */}
          <span className="text-zinc-600">|</span>
          <label
            className="p-1 hover:bg-white/20 rounded cursor-pointer text-zinc-400 hover:text-white transition-colors"
            title="Cargar video"
          >
            <Upload className="h-3.5 w-3.5" />
            <input type="file" accept="video/*" onChange={onFile} className="sr-only" />
          </label>

          {/* Control de Auto-guardado en TiDB */}
          <span className="text-zinc-600">|</span>
          <div className="flex items-center gap-1.5 bg-zinc-900/90 border border-emerald-500/30 px-2 py-0.5 rounded-full">
            <Database className="h-3 w-3 text-emerald-400" />
            <span className="text-[10px] text-zinc-300 font-sans">TiDB:</span>
            <select
              value={intervaloMinutos}
              onChange={(e) => setIntervaloMinutos(Number(e.target.value))}
              className="bg-transparent text-[10px] text-emerald-300 font-bold outline-none cursor-pointer"
              title="Intervalo para guardar métricas en la base de datos"
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
              className={`p-1 rounded text-[10px] font-sans font-bold flex items-center gap-1 transition-all ${
                guardadoExitoso
                  ? "bg-emerald-600 text-white"
                  : "bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/40"
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
