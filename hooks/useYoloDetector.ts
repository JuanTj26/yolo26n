"use client";

import { useEffect, useRef, useState } from "react";
import { YoloDetector, DualYoloDetector } from "@/lib/yolo";
import type { ModelStatus } from "@/lib/types";

export type DetectorMode = "dual" | "maqueta" | "toycars" | "general";

export function useYoloDetector(initialMode: DetectorMode = "dual") {
  const detectorRef = useRef<YoloDetector | DualYoloDetector | null>(null);
  const [modelMode, setModelMode] = useState<DetectorMode>(initialMode);
  const [modelStatus, setModelStatus] = useState<ModelStatus>("cargando");
  const [backend, setBackend] = useState("");

  useEffect(() => {
    let cancelled = false;
    setModelStatus("cargando");
    detectorRef.current?.dispose();
    detectorRef.current = null;

    const load = async () => {
      try {
        let detector: YoloDetector | DualYoloDetector;
        if (modelMode === "dual") {
          detector = await DualYoloDetector.createDual(
            "/models/yolo26n_webgpu.onnx",
            "/models/best.onnx"
          );
        } else if (modelMode === "maqueta") {
          detector = await DualYoloDetector.createBestOnly("/models/best.onnx");
        } else if (modelMode === "toycars") {
          detector = await DualYoloDetector.createToyCarsOnly("/models/toycars.onnx?v=webgpu");
        } else {
          detector = await YoloDetector.create("/models/yolo26n_webgpu.onnx", {
            inputSize: 320,
          });
        }

        if (cancelled) {
          detector.dispose();
          return;
        }

        detectorRef.current = detector;
        setBackend(detector.backend);
        setModelStatus("listo");
      } catch (err) {
        if (!cancelled) setModelStatus("error");
        console.error("[useYoloDetector] Error cargando modelo:", err);
      }
    };

    load();

    return () => {
      cancelled = true;
      detectorRef.current?.dispose();
      detectorRef.current = null;
    };
  }, [modelMode]);

  return { detectorRef, modelStatus, backend, setBackend, modelMode, setModelMode };
}
