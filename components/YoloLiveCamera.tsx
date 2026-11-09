"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Camera, X, Zap } from "lucide-react";
import { useYoloDetector } from "@/hooks/useYoloDetector";
import { useVideoSource } from "@/hooks/useVideoSource";
import { useInferenceLoop } from "@/hooks/useInferenceLoop";
import VideoCanvas from "@/components/VideoCanvas";
import SidePanel from "@/components/SidePanel";
import type { Zone } from "@/lib/types";

interface Props {
  onClose: () => void;
}

export default function YoloLiveCamera({ onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const zonesRef = useRef<Zone[]>([]);
  const draftRef = useRef<Zone | null>(null);

  const [error, setError] = useState("");
  const [aspect, setAspect] = useState(16 / 9);
  const [zones, setZones] = useState<Zone[]>([]);

  const { detectorRef, modelStatus, backend, setBackend } = useYoloDetector();

  const { source, startWebcam, onFile, devices, deviceId, setDeviceId, stopSource } =
    useVideoSource(videoRef, setError);

  const { counts, lights, total, fps, inferMs, commitZones } = useInferenceLoop({
    videoRef,
    canvasRef,
    detectorRef,
    zonesRef,
    draftRef,
    onError: setError,
    onResize: setAspect,
    onUpdate: setBackend,
  });

  const handleCommitZones = (next: Zone[]) => {
    zonesRef.current = next;
    setZones(next);
    commitZones(next);
  };

  // Try auto-starting webcam on mount
  useEffect(() => {
    startWebcam();
    return () => {
      stopSource();
    };
  }, [startWebcam, stopSource]);

  return (
    <div className="relative z-10 w-full min-h-screen bg-[#090a0f] text-white flex flex-col pt-20 pb-12 px-3 sm:px-6 lg:px-10 overflow-y-auto">
      {/* ── Header Bar ── */}
      <div className="max-w-7xl mx-auto w-full mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-4">
        <div className="flex items-center gap-3">
          <button
            onClick={onClose}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold backdrop-blur-md transition-all active:scale-95 group"
            title="Volver a la vista 3D"
          >
            <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
            <span>Volver a Simulación 3D</span>
          </button>

          <div className="h-5 w-[1px] bg-white/20 hidden sm:block" />

          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-[#f95721] text-white">
              <Camera className="h-4 w-4" />
            </div>
            <div>
              <div className="text-sm font-bold tracking-tight text-white flex items-center gap-2">
                <span>Cámara YOLO26n</span>
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                </span>
              </div>
              <div className="text-[11px] text-zinc-400 font-mono">Detección neuronal en tiempo real</div>
            </div>
          </div>
        </div>

        {/* Status badges */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Backend */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs font-mono text-zinc-300">
            <Zap className="h-3.5 w-3.5 text-amber-400" />
            <span>{modelStatus === "cargando" ? "Cargando..." : backend || "ONNX Web"}</span>
          </div>

          {/* FPS */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs font-mono text-emerald-400 font-bold">
            <span>{fps} FPS</span>
            <span className="text-[10px] text-zinc-400 font-normal">({inferMs}ms)</span>
          </div>

          {/* Total Detected */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#f95721]/20 border border-[#f95721]/40 text-xs font-mono text-[#f95721] font-bold">
            <span>{total} detectados</span>
          </div>

          <button
            onClick={onClose}
            className="h-8 w-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-zinc-400 hover:text-white transition-colors"
            title="Cerrar cámara"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* ── Main Camera Layout ── */}
      <div className="max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-[1fr_310px] gap-6 items-start">
        {/* Left: Video & Inference Canvas */}
        <div className="w-full flex flex-col gap-3">
          <VideoCanvas
            videoRef={videoRef}
            canvasRef={canvasRef}
            draftRef={draftRef}
            source={source}
            modelStatus={modelStatus}
            aspect={aspect}
            zones={zones}
            deviceId={deviceId}
            zonesRef={zonesRef}
            onCommitZones={handleCommitZones}
            onStartWebcam={startWebcam}
            onFile={onFile}
          />

          {error && (
            <div className="rounded-xl bg-red-500/10 border border-red-500/30 p-3 text-xs text-red-400 font-mono">
              {error}
            </div>
          )}
        </div>

        {/* Right: Side Panel with Zones & Controller */}
        <div className="w-full bg-[#12141a] border border-white/10 rounded-2xl p-4 shadow-xl">
          <SidePanel
            source={source}
            modelStatus={modelStatus}
            backend={backend}
            devices={devices}
            deviceId={deviceId}
            zones={zones}
            counts={counts}
            lights={lights}
            total={total}
            fps={fps}
            inferMs={inferMs}
            error={error}
            onStartWebcam={startWebcam}
            onFile={onFile}
            onDeviceChange={(id) => {
              setDeviceId(id);
              startWebcam(id);
            }}
          />
        </div>
      </div>
    </div>
  );
}

