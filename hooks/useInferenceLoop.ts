"use client";

import { useEffect, useRef, useState } from "react";
import { COCO_CLASSES, YoloDetector, DualYoloDetector, type Detection } from "@/lib/yolo";
import { TrafficController, type LightState } from "@/lib/trafficController";
import type { Zone } from "@/lib/types";

const LIGHT_COLOR: Record<LightState, string> = {
  green: "#10b981",
  yellow: "#f59e0b",
  red:   "#ef4444",
};

const ZONE_COLORS = [
  { border: "#3b82f6", bg: "rgba(59, 130, 246, 0.08)", text: "#93c5fd" },
  { border: "#10b981", bg: "rgba(16, 185, 129, 0.08)", text: "#6ee7b7" },
  { border: "#f59e0b", bg: "rgba(245, 158, 11, 0.08)", text: "#fde68a" },
  { border: "#a855f7", bg: "rgba(168, 85, 247, 0.08)", text: "#d8b4fe" },
];

interface Props {
  videoRef:    React.RefObject<HTMLVideoElement>;
  canvasRef:   React.RefObject<HTMLCanvasElement>;
  detectorRef: React.RefObject<YoloDetector | DualYoloDetector | null>;
  zonesRef:    React.MutableRefObject<Zone[]>;
  draftRef:    React.MutableRefObject<Zone | null>;
  onError:     (msg: string) => void;
  onResize:    (aspect: number) => void;
  onUpdate:    (backend: string) => void;
}

export function useInferenceLoop({
  videoRef, canvasRef, detectorRef,
  zonesRef, draftRef,
  onError, onResize, onUpdate,
}: Props) {
  const controllerRef = useRef(new TrafficController(0));
  const detsRef       = useRef<Detection[]>([]);
  const lightsRef     = useRef<LightState[]>([]);

  const [counts, setCounts] = useState<number[]>([]);
  const [lights, setLights] = useState<LightState[]>([]);
  const [total,  setTotal]  = useState(0);
  const [fps,    setFps]    = useState(0);
  const [inferMs, setInferMs] = useState(0);

  // Exponer setZones para que la página pueda reiniciar el controlador
  const commitZones = (next: Zone[]) => {
    zonesRef.current = next;
    controllerRef.current = new TrafficController(next.length);
    lightsRef.current = next.map(() => "red" as LightState);
    setCounts(next.map(() => 0));
    setLights(next.map(() => "red" as LightState));
  };

  useEffect(() => {
    let busy     = false;
    let disabled = false;
    let lastDone = 0;
    let fpsAvg   = 0;
    let lastUIUpdate = 0;

    const runInference = (video: HTMLVideoElement, det: YoloDetector | DualYoloDetector) => {
      busy = true;
      const tStart = performance.now();
      det.detect(video)
        .then((dets) => {
          const lat = Math.round(performance.now() - tStart);
          detsRef.current = dets;

          const vw = video.videoWidth  || 1280;
          const vh = video.videoHeight || 720;
          const zs = zonesRef.current ?? [];
          const c  = zs.map(() => 0);
          for (const d of dets) {
            // Contamos como vehículos para las zonas: toy-car o clases vehiculares de COCO
            const isVehicle = d.isToyCar || d.label === "toy-car" || (d.classId !== 0);
            if (!isVehicle) continue;

            const cx = (d.x1 + d.x2) / 2 / vw;
            const cy = (d.y1 + d.y2) / 2 / vh;
            zs.forEach((z, i) => {
              if (cx >= z.x && cx <= z.x + z.w && cy >= z.y && cy <= z.y + z.h) c[i]++;
            });
          }
          const states = controllerRef.current.update(c, performance.now());
          lightsRef.current = states;

          const now = performance.now();
          const dt  = now - lastDone;
          lastDone  = now;
          if (dt > 0 && dt < 2000)
            fpsAvg = fpsAvg === 0 ? 1000 / dt : fpsAvg * 0.8 + (1000 / dt) * 0.2;

          if (now - lastUIUpdate > 180) {
            lastUIUpdate = now;
            onUpdate(det.backend);
            setCounts(c);
            setLights(states);
            setTotal(dets.length);
            setFps(Math.round(fpsAvg));
            setInferMs(lat);
          }
        })
        .catch((e) => {
          console.warn("[InferenceLoop] Error en frame:", e);
        })
        .finally(() => { busy = false; });
    };

    const draw = (canvas: HTMLCanvasElement) => {
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const W = canvas.width;
      const H = canvas.height;
      const u = Math.max(1, W / 640);
      ctx.clearRect(0, 0, W, H);
      ctx.font = `600 ${Math.round(13 * u)}px Inter, system-ui, sans-serif`;
      ctx.textBaseline = "top";

      // Zonas delgadas y transparentes
      (zonesRef.current ?? []).forEach((z, i) => {
        const lightState = lightsRef.current[i] ?? "red";
        const theme = ZONE_COLORS[i % ZONE_COLORS.length];

        // 1. Borde fino de 2px y relleno muy suave para ver el video y los carros debajo
        ctx.fillStyle   = theme.bg;
        ctx.strokeStyle = theme.border;
        ctx.lineWidth   = 2;
        ctx.fillRect  (z.x * W, z.y * H, z.w * W, z.h * H);
        ctx.strokeRect(z.x * W, z.y * H, z.w * W, z.h * H);

        // 2. Letrero chico tipo "Z1 · 0 veh" en la esquina, sin bloques oscuros grandes que tapen la zona
        const labelText = `Z${i + 1} · ${counts[i] ?? 0} veh`;
        ctx.font = `600 11px Inter, system-ui, -apple-system, sans-serif`;
        const tw = ctx.measureText(labelText).width;
        const tagW = tw + 22;
        const tagH = 19;
        const tagX = z.x * W + 3;
        const tagY = z.y * H + 3;

        // Fondo discreto y translúcido
        ctx.fillStyle = "rgba(0, 0, 0, 0.60)";
        if (ctx.roundRect) {
          ctx.beginPath();
          ctx.roundRect(tagX, tagY, tagW, tagH, 4);
          ctx.fill();
        } else {
          ctx.fillRect(tagX, tagY, tagW, tagH);
        }

        // Borde fino del badge
        ctx.strokeStyle = theme.border;
        ctx.lineWidth = 1;
        if (ctx.roundRect) {
          ctx.beginPath();
          ctx.roundRect(tagX, tagY, tagW, tagH, 4);
          ctx.stroke();
        }

        // Punto pequeño de estado del semáforo (verde/amarillo/rojo)
        const lightColor = LIGHT_COLOR[lightState] || "#10b981";
        ctx.beginPath();
        ctx.arc(tagX + 8.5, tagY + 9.5, 3.5, 0, Math.PI * 2);
        ctx.fillStyle = lightColor;
        ctx.fill();

        // Texto limpio
        ctx.fillStyle = "#ffffff";
        ctx.textBaseline = "middle";
        ctx.fillText(labelText, tagX + 16, tagY + 10);
      });

      // Zona borrador (mientras el usuario arrastra)
      const draft = draftRef.current;
      if (draft) {
        ctx.strokeStyle = "#38bdf8";
        ctx.fillStyle = "rgba(56, 189, 248, 0.08)";
        ctx.setLineDash([4, 4]);
        ctx.lineWidth = 2;
        ctx.fillRect  (draft.x * W, draft.y * H, draft.w * W, draft.h * H);
        ctx.strokeRect(draft.x * W, draft.y * H, draft.w * W, draft.h * H);
        ctx.setLineDash([]);
      }

      // Bounding boxes
      ctx.lineWidth = 2 * u;
      for (const d of detsRef.current) {
        const isToyCar = d.isToyCar || d.label === "toy-car";
        const isPerson = d.classId === 0 && !isToyCar;
        const labelName = d.label || (COCO_CLASSES[d.classId] ?? `Objeto ${d.classId}`);
        const boxColor = d.color || (isToyCar ? "#f95721" : isPerson ? "#10b981" : "#22d3ee");

        const x1 = Math.max(0, d.x1);
        const y1 = Math.max(0, d.y1);
        const x2 = Math.min(W, d.x2);
        const y2 = Math.min(H, d.y2);
        const bw = Math.max(0, x2 - x1);
        const bh = Math.max(0, y2 - y1);

        ctx.strokeStyle = boxColor;
        ctx.strokeRect(x1, y1, bw, bh);

        const label = `${labelName} ${Math.round(d.score * 100)}%`;
        const tw = ctx.measureText(label).width + 10 * u;
        const th = 20 * u;
        const ty = Math.max(0, y1 - th);
        const labelX = Math.max(0, Math.min(x1, W - tw));

        ctx.fillStyle = boxColor;
        ctx.fillRect(labelX, ty, tw, th);
        ctx.fillStyle = "#ffffff";
        ctx.fillText(label, labelX + 5 * u, ty + 3 * u);
      }
    };

    // Inferencia: bucle con throttle para no saturar la CPU ni congelar la UI
    const inferInterval = setInterval(() => {
      const video  = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas) return;

      const vw = video.videoWidth;
      const vh = video.videoHeight;
      if (!vw || !vh) return;

      if (canvas.width !== vw || canvas.height !== vh) {
        canvas.width  = vw;
        canvas.height = vh;
        onResize(vw / vh);
      }

      const det = detectorRef.current;
      if (det && !busy && !disabled) runInference(video, det);
    }, 35);

    // Dibujo continuo a 60 FPS
    let drawRaf = 0;
    const drawLoop = () => {
      drawRaf = requestAnimationFrame(drawLoop);
      const canvas = canvasRef.current;
      if (canvas) draw(canvas);
    };
    drawRaf = requestAnimationFrame(drawLoop);

    return () => {
      clearInterval(inferInterval);
      cancelAnimationFrame(drawRaf);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return { counts, lights, total, fps, inferMs, commitZones, lightsRef, detsRef };
}
