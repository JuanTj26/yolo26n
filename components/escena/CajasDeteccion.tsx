"use client";

import { useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { screenBounds, VEHICLE_BOUNDS } from "@/lib/vehicle-detection";
import { story, factors } from "@/lib/story";

export default function CajasDeteccion({
  gruposAutos,
  gruposPeatones,
  tiposEspacio,
  canvas,
  dashboard = false,
  detecciones = true,
}: {
  gruposAutos: React.MutableRefObject<(THREE.Group | null)[]>;
  gruposPeatones: React.MutableRefObject<(THREE.Group | null)[]>;
  tiposEspacio: React.MutableRefObject<string[]>;
  canvas: React.RefObject<HTMLCanvasElement | null>;
  dashboard?: boolean;
  detecciones?: boolean;
}) {
  const esquinasAuto = useMemo(() => {
    const { halfWidth, height, halfLength } = VEHICLE_BOUNDS;
    return [-halfWidth, halfWidth].flatMap((x) =>
      [0, height].flatMap((y) =>
        [-halfLength, halfLength].map((z) => new THREE.Vector3(x, y, z))
      )
    );
  }, []);
  const autoProyectado = useMemo(() => esquinasAuto.map(() => new THREE.Vector3()), [esquinasAuto]);

  const esquinasMoto = useMemo(() => {
    const hw = 0.42;
    const h = 1.55;
    const hl = 1.15;
    return [-hw, hw].flatMap((x) =>
      [0, h].flatMap((y) =>
        [-hl, hl].map((z) => new THREE.Vector3(x, y, z))
      )
    );
  }, []);
  const motoProyectada = useMemo(() => esquinasMoto.map(() => new THREE.Vector3()), [esquinasMoto]);

  const esquinasPeaton = useMemo(() => {
    const hw = 0.32;
    const h = 1.62;
    const hl = 0.32;
    return [-hw, hw].flatMap((x) =>
      [0, h].flatMap((y) =>
        [-hl, hl].map((z) => new THREE.Vector3(x, y, z))
      )
    );
  }, []);
  const peatonProyectado = useMemo(() => esquinasPeaton.map(() => new THREE.Vector3()), [esquinasPeaton]);

  useFrame(({ camera, size }) => {
    const el = canvas.current;
    const ctx = el?.getContext("2d");
    if (!el || !ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (el.width !== Math.round(size.width * dpr) || el.height !== Math.round(size.height * dpr)) {
      el.width = Math.round(size.width * dpr);
      el.height = Math.round(size.height * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size.width, size.height);
    const alpha = detecciones ? (dashboard ? 1 : factors(story.p).intel) : 0;
    if (alpha < 0.02) return;

    camera.updateMatrixWorld();
    ctx.globalAlpha = alpha;
    ctx.lineWidth = 1.5;
    ctx.font = "bold 9px ui-monospace, SFMono-Regular, monospace";

    // 1. Vehículos: AUTO (Naranja #f95721) o MOTO (Ámbar #f59e0b)
    for (let i = 0; i < gruposAutos.current.length; i++) {
      const group = gruposAutos.current[i];
      if (!group?.visible) continue;
      const esMoto = tiposEspacio.current[i] === "moto";
      const esquinas = esMoto ? esquinasMoto : esquinasAuto;
      const proyectado = esMoto ? motoProyectada : autoProyectado;
      const colorCaja = esMoto ? "#f59e0b" : "#f95721";
      const etiqueta = esMoto ? "MOTO" : "AUTO";

      ctx.strokeStyle = colorCaja;
      ctx.fillStyle = colorCaja;

      group.updateWorldMatrix(true, false);
      esquinas.forEach((corner, cIdx) =>
        proyectado[cIdx]?.copy(corner).applyMatrix4(group.matrixWorld).project(camera)
      );
      const bounds = screenBounds(proyectado, size.width, size.height);
      if (bounds) {
        ctx.strokeRect(bounds.left, bounds.top, bounds.width, bounds.height);
        const len = 4;
        ctx.fillRect(bounds.left - 1, bounds.top - 1, len, 2);
        ctx.fillRect(bounds.left - 1, bounds.top - 1, 2, len);
        ctx.fillRect(bounds.left + bounds.width - len + 1, bounds.top - 1, len, 2);
        ctx.fillRect(bounds.left + bounds.width - 1, bounds.top - 1, 2, len);
        ctx.fillText(etiqueta, bounds.left + 2, bounds.top - 3);
      }
    }

    // 2. Peatones: PEATÓN (Cian #06b6d4)
    const colorPeaton = "#06b6d4";
    ctx.strokeStyle = colorPeaton;
    ctx.fillStyle = colorPeaton;

    for (const group of gruposPeatones.current) {
      if (!group?.visible) continue;
      group.updateWorldMatrix(true, false);
      esquinasPeaton.forEach((corner, i) =>
        peatonProyectado[i]?.copy(corner).applyMatrix4(group.matrixWorld).project(camera)
      );
      const bounds = screenBounds(peatonProyectado, size.width, size.height);
      if (bounds) {
        ctx.strokeRect(bounds.left, bounds.top, bounds.width, bounds.height);
        const len = 3;
        ctx.fillRect(bounds.left - 1, bounds.top - 1, len, 2);
        ctx.fillRect(bounds.left - 1, bounds.top - 1, 2, len);
        ctx.fillRect(bounds.left + bounds.width - len + 1, bounds.top - 1, len, 2);
        ctx.fillRect(bounds.left + bounds.width - 1, bounds.top - 1, 2, len);
        ctx.fillText("PEATÓN", bounds.left + 2, bounds.top - 3);
      }
    }

    ctx.globalAlpha = 1;
  });

  return null;
}

