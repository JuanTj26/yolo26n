"use client";

import { useMemo } from "react";
import * as THREE from "three";
import type { DayMode } from "./tipos";

interface DefinicionEdificio {
  x: number;
  z: number;
  w: number;
  d: number;
  h: number;
  tieneAntena?: boolean;
  tieneHVAC?: boolean;
  escalon?: { w: number; d: number; h: number };
}

// Zonificación urbana en anfiteatro: edificios bajos al frente, rascacielos al fondo (vista 100% despejada 360°)
export const MANZANAS_CIUDAD: DefinicionEdificio[] = [];
for (const sx of [-1, 1]) {
  for (const sz of [-1, 1]) {
    // 1. Pabellón comercial esquinero / cafetería (h=3.2 m para no obstruir la vista)
    MANZANAS_CIUDAD.push({
      x: sx * 16,
      z: sz * 16,
      w: 7.5,
      d: 7.5,
      h: 3.2,
      tieneHVAC: true,
    });
    // 2. Torre de avenida exterior Norte/Sur (h=16 m, a distancia >47 m)
    MANZANAS_CIUDAD.push({
      x: sx * 16,
      z: sz * 46,
      w: 8.5,
      d: 11,
      h: 16,
      tieneHVAC: true,
    });
    // 3. Torre de avenida exterior Este/Oeste (h=16 m, a distancia >47 m)
    MANZANAS_CIUDAD.push({
      x: sx * 46,
      z: sz * 16,
      w: 11,
      d: 8.5,
      h: 16,
      tieneHVAC: true,
    });
    // 4. Torre corporativa intermedia A (h=22 m, a distancia >54 m)
    MANZANAS_CIUDAD.push({
      x: sx * 44,
      z: sz * 32,
      w: 10,
      d: 10,
      h: 22,
      escalon: { w: 7, d: 7, h: 5 },
      tieneHVAC: true,
    });
    // 5. Torre corporativa intermedia B (h=22 m, a distancia >54 m)
    MANZANAS_CIUDAD.push({
      x: sx * 32,
      z: sz * 44,
      w: 10,
      d: 10,
      h: 22,
      escalon: { w: 7, d: 7, h: 5 },
      tieneHVAC: true,
    });
    // 6. Rascacielos exterior A (h=28 m, a distancia >67 m)
    MANZANAS_CIUDAD.push({
      x: sx * 32,
      z: sz * 60,
      w: 11,
      d: 11,
      h: 28,
      tieneHVAC: true,
    });
    // 7. Rascacielos exterior B (h=28 m, a distancia >67 m)
    MANZANAS_CIUDAD.push({
      x: sx * 60,
      z: sz * 32,
      w: 11,
      d: 11,
      h: 28,
      tieneHVAC: true,
    });
    // 8. Rascacielos monumental en el horizonte con antena y baliza roja (h=36 m)
    MANZANAS_CIUDAD.push({
      x: sx * 52,
      z: sz * 52,
      w: 14,
      d: 14,
      h: 36,
      escalon: { w: 9.5, d: 9.5, h: 9 },
      tieneAntena: true,
      tieneHVAC: true,
    });
  }
}

// Textura procedural de alta resolución para fachadas e iluminación nocturna de ventanas
function useTexturasEdificios(modo: DayMode) {
  return useMemo(() => {
    if (typeof document === "undefined") return { fachada: null, emisivo: null };

    const w = 512;
    const h = 512;

    const fc = document.createElement("canvas");
    fc.width = w;
    fc.height = h;
    const fg = fc.getContext("2d")!;

    const ec = document.createElement("canvas");
    ec.width = w;
    ec.height = h;
    const eg = ec.getContext("2d")!;

    const esNoche = modo === "night";
    const esAtardecer = modo === "sunset";

    // 1. Color base de la pared
    fg.fillStyle = esNoche ? "#111726" : esAtardecer ? "#421a12" : "#e4e8f0";
    fg.fillRect(0, 0, w, h);

    eg.fillStyle = "#000000";
    eg.fillRect(0, 0, w, h);

    // Microtextura de hormigón/piedra
    for (let i = 0; i < 1200; i++) {
      fg.fillStyle = esNoche
        ? `rgba(255,255,255,${Math.random() * 0.03})`
        : `rgba(0,0,0,${Math.random() * 0.025})`;
      fg.fillRect(Math.random() * w, Math.random() * h, 3, 3);
    }

    // Lobby de planta baja con ventanales altos (54px inferiores)
    const lobbyH = 54;
    const lobbyY = h - lobbyH;
    fg.fillStyle = esNoche ? "#1e293b" : esAtardecer ? "#582010" : "#e2e8f0";
    fg.fillRect(0, lobbyY, w, lobbyH);
    for (let x = 12; x < w; x += 64) {
      fg.fillStyle = esNoche ? "#fef08a" : esAtardecer ? "#fdba74" : "#94a3b8";
      fg.fillRect(x, lobbyY + 8, 48, lobbyH - 12);
      if (esNoche || esAtardecer) {
        eg.fillStyle = esNoche ? "#fef08a" : "#f97316";
        eg.fillRect(x, lobbyY + 8, 48, lobbyH - 12);
      }
    }

    // Cuadrícula de ventanas: 8 columnas x 14 pisos
    const cols = 8;
    const pisos = 14;
    const padX = 14;
    const padTop = 16;
    const winW = 38;
    const winH = 22;
    const gapX = (w - padX * 2 - cols * winW) / (cols - 1);
    const gapY = (h - lobbyH - padTop - pisos * winH) / (pisos - 1);

    let seed = 42;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

    for (let r = 0; r < pisos; r++) {
      const wy = padTop + r * (winH + gapY);

      // Separador de piso
      fg.fillStyle = esNoche ? "#090d16" : esAtardecer ? "#4c1d0e" : "#cbd5e1";
      fg.fillRect(0, wy + winH + 1, w, 3);

      for (let c = 0; c < cols; c++) {
        const wx = padX + c * (winW + gapX);

        // Marco de la ventana
        fg.fillStyle = esNoche ? "#030712" : esAtardecer ? "#330e06" : "#64748b";
        fg.fillRect(wx - 1.5, wy - 1.5, winW + 3, winH + 3);

        const encendida = rnd() > 0.32; // 68% de probabilidad de luz

        if (esNoche) {
          if (encendida) {
            const tonoCalido = rnd() > 0.22 ? "#fde047" : "#93c5fd";
            fg.fillStyle = tonoCalido;
            fg.fillRect(wx, wy, winW, winH);
            eg.fillStyle = tonoCalido;
            eg.fillRect(wx, wy, winW, winH);
          } else {
            fg.fillStyle = "#0c1322";
            fg.fillRect(wx, wy, winW, winH);
          }
        } else if (esAtardecer) {
          if (encendida) {
            fg.fillStyle = "#fed7aa";
            fg.fillRect(wx, wy, winW, winH);
            eg.fillStyle = "#fb923c";
            eg.fillRect(wx, wy, winW, winH);
          } else {
            fg.fillStyle = "#832e18";
            fg.fillRect(wx, wy, winW, winH);
          }
        } else {
          // Día: cristal reflectante con reflejo de luz celeste
          const tonoCristal = rnd() > 0.5 ? "#bae6fd" : "#7dd3fc";
          fg.fillStyle = tonoCristal;
          fg.fillRect(wx, wy, winW, winH);
          fg.fillStyle = "rgba(255,255,255,0.45)";
          fg.fillRect(wx + 2, wy + 2, winW * 0.45, winH - 4);
        }
      }
    }

    const ft = new THREE.CanvasTexture(fc);
    ft.wrapS = THREE.RepeatWrapping;
    ft.wrapT = THREE.RepeatWrapping;
    ft.anisotropy = 8;
    ft.colorSpace = THREE.SRGBColorSpace;

    const et = new THREE.CanvasTexture(ec);
    et.wrapS = THREE.RepeatWrapping;
    et.wrapT = THREE.RepeatWrapping;
    et.anisotropy = 8;

    return { fachada: ft, emisivo: et };
  }, [modo]);
}

export default function EdificiosCiudad({ modo }: { modo: DayMode }) {
  const { fachada, emisivo } = useTexturasEdificios(modo);
  const esNoche = modo === "night";
  const esAtardecer = modo === "sunset";

  const colorTecho = esNoche ? "#090d16" : esAtardecer ? "#4c1d0e" : "#1e293b";
  const colorHVAC = esNoche ? "#1f293d" : "#334155";
  const colorPlaza = esNoche ? "#111827" : esAtardecer ? "#653420" : "#e2e8f0";

  return (
    <group>
      {/* Plazas y explanadas peatonales de los 4 cuadrantes */}
      {[-1, 1].map((sx) =>
        [-1, 1].map((sz) => (
          <mesh key={`plaza-${sx}-${sz}`} position={[sx * 38, 0.08, sz * 38]} receiveShadow>
            <boxGeometry args={[52, 0.16, 52]} />
            <meshStandardMaterial color={colorPlaza} roughness={0.9} />
          </mesh>
        ))
      )}

      {/* Edificios con fachadas de ventanas, azoteas, HVACs y balizas */}
      {MANZANAS_CIUDAD.map((b, i) => {
        const techoY = b.h;
        return (
          <group key={i} position={[b.x, 0, b.z]}>
            {/* Cuerpo principal del edificio */}
            <mesh position={[0, b.h / 2, 0]} castShadow receiveShadow>
              <boxGeometry args={[b.w, b.h, b.d]} />
              {fachada ? (
                <meshStandardMaterial
                  map={fachada}
                  emissiveMap={emisivo ?? undefined}
                  emissive={esNoche ? "#ffe066" : esAtardecer ? "#f97316" : "#000000"}
                  emissiveIntensity={esNoche ? 1.6 : esAtardecer ? 0.9 : 0}
                  roughness={0.35}
                  metalness={0.2}
                />
              ) : (
                <meshStandardMaterial color={esNoche ? "#121724" : "#f1f5f9"} roughness={0.6} />
              )}
            </mesh>

            {/* Azotea */}
            <mesh position={[0, techoY + 0.1, 0]} receiveShadow>
              <boxGeometry args={[b.w * 0.96, 0.2, b.d * 0.96]} />
              <meshStandardMaterial color={colorTecho} roughness={0.8} />
            </mesh>

            {/* Torre escalonada superior */}
            {b.escalon && (
              <group position={[0, techoY, 0]}>
                <mesh position={[0, b.escalon.h / 2, 0]} castShadow receiveShadow>
                  <boxGeometry args={[b.escalon.w, b.escalon.h, b.escalon.d]} />
                  {fachada ? (
                    <meshStandardMaterial
                      map={fachada}
                      emissiveMap={emisivo ?? undefined}
                      emissive={esNoche ? "#ffe066" : esAtardecer ? "#f97316" : "#000000"}
                      emissiveIntensity={esNoche ? 1.6 : esAtardecer ? 0.9 : 0}
                      roughness={0.35}
                      metalness={0.2}
                    />
                  ) : (
                    <meshStandardMaterial color={esNoche ? "#121724" : "#f1f5f9"} />
                  )}
                </mesh>
                <mesh position={[0, b.escalon.h + 0.1, 0]}>
                  <boxGeometry args={[b.escalon.w * 0.94, 0.2, b.escalon.d * 0.94]} />
                  <meshStandardMaterial color={colorTecho} roughness={0.8} />
                </mesh>
              </group>
            )}

            {/* Unidades mecánicas HVAC en la azotea */}
            {b.tieneHVAC && (
              <group position={[0, b.escalon ? techoY + b.escalon.h : techoY, 0]}>
                <mesh position={[0.8, 0.5, 0.8]} castShadow>
                  <boxGeometry args={[1.8, 0.8, 1.8]} />
                  <meshStandardMaterial color={colorHVAC} metalness={0.6} roughness={0.4} />
                </mesh>
                <mesh position={[-1.2, 0.4, -0.6]} castShadow>
                  <boxGeometry args={[1.4, 0.6, 2.0]} />
                  <meshStandardMaterial color={colorHVAC} metalness={0.6} roughness={0.4} />
                </mesh>
              </group>
            )}

            {/* Antena de comunicaciones con luz roja de advertencia aeronáutica */}
            {b.tieneAntena && (
              <group position={[0, b.escalon ? techoY + b.escalon.h : techoY, 0]}>
                <mesh position={[0, 2.8, 0]} castShadow>
                  <cylinderGeometry args={[0.08, 0.22, 5.6, 8]} />
                  <meshStandardMaterial color="#94a3b8" metalness={0.9} roughness={0.2} />
                </mesh>
                <mesh position={[0, 5.6, 0]}>
                  <sphereGeometry args={[0.18, 12, 12]} />
                  <meshStandardMaterial
                    color="#ef4444"
                    emissive="#ef4444"
                    emissiveIntensity={esNoche ? 3.5 : esAtardecer ? 2.5 : 1.2}
                    toneMapped={false}
                  />
                </mesh>
              </group>
            )}
          </group>
        );
      })}
    </group>
  );
}

