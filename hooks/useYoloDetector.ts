"use client";

import { useEffect, useRef, useState } from "react";
import { YoloDetector, DualYoloDetector } from "@/lib/yolo";
import type { ModelStatus } from "@/lib/types";

export type DetectorMode = "general" | "toycars";

export function useYoloDetector(initialMode: DetectorMode = "general") {
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
        if (modelMode === "toycars") {
          detector = await DualYoloDetector.createToyCarsOnly("/models/toycars.onnx?v=webgpu");
        } else {
          detector = await YoloDetector.create("/models/yolo26n_webgpu.onnx", {
            inputSize: 320,
            confThreshold: 0.25,
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
