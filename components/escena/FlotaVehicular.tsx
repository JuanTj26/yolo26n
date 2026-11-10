"use client";

import React, { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three-stdlib";
import { lanePose, step } from "@/lib/traffic-sim";
import { story } from "@/lib/story";
import type { SimRefHolder } from "./tipos";

export const MAX_AUTOS = 48;

export const PALETA_COLORES = [
  "#f8fafc", // Blanco Perla
  "#1e293b", // Azul Marino Metalizado
  "#94a3b8", // Plata Billet
  "#0f172a", // Negro Obsidiana
  "#b91c1c", // Rojo Carmesí
  "#0284c7", // Azul Eléctrico
  "#eab308", // Dorado Taxi
  "#475569", // Gris Carbón
];

/* Singletons compartidos de ruedas y carrocerías */
const GEO_LLANTA = new THREE.CylinderGeometry(0.34, 0.34, 0.22, 14);
const GEO_RIN = new THREE.CylinderGeometry(0.23, 0.23, 0.23, 10);
const GEO_MAZA = new THREE.CylinderGeometry(0.08, 0.08, 0.24, 6);
const MAT_LLANTA = new THREE.MeshStandardMaterial({ color: "#1a1a1a", roughness: 0.9, metalness: 0.1 });
const MAT_RIN = new THREE.MeshStandardMaterial({ color: "#e2e8f0", metalness: 0.88, roughness: 0.18 });
const MAT_MAZA = new THREE.MeshStandardMaterial({ color: "#0f172a", roughness: 0.5 });

const GEO_SEDAN_CHASIS = new RoundedBoxGeometry(1.94, 0.58, 4.25, 2, 0.22);
const GEO_SEDAN_CABINA = new RoundedBoxGeometry(1.60, 0.52, 2.30, 2, 0.22);
const GEO_SUV_CHASIS = new RoundedBoxGeometry(2.02, 0.68, 4.30, 2, 0.22);
const GEO_SUV_CABINA = new RoundedBoxGeometry(1.70, 0.58, 2.45, 2, 0.22);
const MAT_CABINA = new THREE.MeshPhysicalMaterial({
  color: "#0f172a",
  metalness: 0.9,
  roughness: 0.08,
  clearcoat: 1,
  clearcoatRoughness: 0.05,
});

const GEO_PARRILLA = new THREE.BoxGeometry(1.35, 0.16, 0.04);
const MAT_PARRILLA = new THREE.MeshStandardMaterial({ color: "#090a0f", roughness: 0.8 });
const GEO_FARO = new THREE.BoxGeometry(0.38, 0.10, 0.04);
const MAT_FARO = new THREE.MeshStandardMaterial({
  color: "#e0f2fe",
  emissive: "#e0f2fe",
  emissiveIntensity: 3,
  toneMapped: false,
});
const GEO_CALAVERA = new THREE.BoxGeometry(1.72, 0.10, 0.04);
const GEO_ESPEJO = new THREE.BoxGeometry(0.16, 0.10, 0.20);
const MAT_ESPEJO = new THREE.MeshStandardMaterial({ color: "#1e293b", roughness: 0.5 });
const GEO_BARRAS_TECHO = new THREE.BoxGeometry(0.06, 0.05, 1.8);
const MAT_BARRAS_TECHO = new THREE.MeshStandardMaterial({ color: "#94a3b8", metalness: 0.9, roughness: 0.2 });
const GEO_LETRERO_TAXI = new THREE.BoxGeometry(0.48, 0.15, 0.22);
const MAT_LETRERO_TAXI = new THREE.MeshStandardMaterial({
  color: "#fef08a",
  emissive: "#eab308",
  emissiveIntensity: 2.0,
  roughness: 0.3,
  toneMapped: false,
});

// Singletons de motocicleta y conductor
const GEO_MOTO_RUEDA_DEL_LLANTA = new THREE.CylinderGeometry(0.32, 0.32, 0.12, 14);
const GEO_MOTO_RUEDA_DEL_RIN = new THREE.CylinderGeometry(0.22, 0.22, 0.13, 10);
const GEO_MOTO_RUEDA_TRAS_LLANTA = new THREE.CylinderGeometry(0.32, 0.32, 0.16, 14);
const GEO_MOTO_RUEDA_TRAS_RIN = new THREE.CylinderGeometry(0.22, 0.22, 0.17, 10);
const GEO_MOTO_HORQUILLA = new THREE.CylinderGeometry(0.025, 0.025, 0.65, 8);
const GEO_MOTO_BASCULANTE = new THREE.BoxGeometry(0.16, 0.06, 0.72);
const GEO_MOTO_MOTOR = new THREE.BoxGeometry(0.26, 0.30, 0.50);
const GEO_MOTO_ESCAPE = new THREE.CylinderGeometry(0.045, 0.055, 0.75, 8);
const GEO_MOTO_TANQUE = new RoundedBoxGeometry(0.38, 0.32, 0.68, 2, 0.12);
const GEO_MOTO_ASIENTO = new RoundedBoxGeometry(0.28, 0.10, 0.56, 2, 0.04);
const GEO_MOTO_MANILLAR = new THREE.CylinderGeometry(0.02, 0.02, 0.64, 8);
const GEO_MOTO_PUNO = new THREE.CylinderGeometry(0.03, 0.03, 0.08, 6);
const GEO_MOTO_FARO = new THREE.SphereGeometry(0.08, 10, 8);
const GEO_MOTO_LUZ_TRAS = new THREE.BoxGeometry(0.16, 0.06, 0.04);

const GEO_CONDUCTOR_TORSO = new THREE.CapsuleGeometry(0.14, 0.32, 4, 8);
const GEO_CONDUCTOR_CASCO = new THREE.SphereGeometry(0.14, 12, 10);
const GEO_CONDUCTOR_VISOR = new THREE.BoxGeometry(0.17, 0.07, 0.06);
const GEO_CONDUCTOR_BRAZO = new THREE.CylinderGeometry(0.04, 0.04, 0.36, 6);
const GEO_CONDUCTOR_PIERNA = new THREE.CapsuleGeometry(0.05, 0.34, 4, 6);

const MAT_MOTO_LLANTA = new THREE.MeshStandardMaterial({ color: "#18181b", roughness: 0.9 });
const MAT_MOTO_RIN = new THREE.MeshStandardMaterial({ color: "#e2e8f0", metalness: 0.9, roughness: 0.18 });
const MAT_MOTO_HORQUILLA = new THREE.MeshStandardMaterial({ color: "#475569", metalness: 0.8, roughness: 0.2 });
const MAT_MOTO_BASCULANTE = new THREE.MeshStandardMaterial({ color: "#1e293b", metalness: 0.7 });
const MAT_MOTO_MOTOR = new THREE.MeshStandardMaterial({ color: "#090a0f", metalness: 0.85, roughness: 0.25 });
const MAT_MOTO_ESCAPE = new THREE.MeshStandardMaterial({ color: "#cbd5e1", metalness: 0.95, roughness: 0.1 });
const MAT_MOTO_ASIENTO = new THREE.MeshStandardMaterial({ color: "#18181b", roughness: 0.9 });
const MAT_MOTO_MANILLAR = new THREE.MeshStandardMaterial({ color: "#334155", metalness: 0.8 });
const MAT_MOTO_PUNO = new THREE.MeshStandardMaterial({ color: "#09090b", roughness: 0.9 });
const MAT_MOTO_FARO = new THREE.MeshStandardMaterial({
  color: "#e0f2fe",
  emissive: "#e0f2fe",
  emissiveIntensity: 3.2,
  toneMapped: false,
});
const MAT_CONDUCTOR_CHAMARRA = new THREE.MeshStandardMaterial({ color: "#1e293b", roughness: 0.7 });
const MAT_CONDUCTOR_CASCO = new THREE.MeshStandardMaterial({ color: "#0f172a", roughness: 0.3, metalness: 0.5 });
const MAT_CONDUCTOR_VISOR = new THREE.MeshStandardMaterial({ color: "#020617", roughness: 0.05, metalness: 0.9 });
const MAT_CONDUCTOR_PANTALON = new THREE.MeshStandardMaterial({ color: "#334155" });

function Rueda({ position, esDerecha = false }: { position: [number, number, number]; esDerecha?: boolean }) {
  return (
    <group position={position} rotation-z={Math.PI / 2}>
      <mesh castShadow geometry={GEO_LLANTA} material={MAT_LLANTA} />
      <mesh position={[0, esDerecha ? 0.02 : -0.02, 0]} geometry={GEO_RIN} material={MAT_RIN} />
      <mesh position={[0, esDerecha ? 0.03 : -0.03, 0]} geometry={GEO_MAZA} material={MAT_MAZA} />
    </group>
  );
}

function ModeloMoto({
  refCarroceria,
  refCalavera,
}: {
  refCarroceria: (m: THREE.MeshPhysicalMaterial | null) => void;
  refCalavera: (m: THREE.MeshStandardMaterial | null) => void;
}) {
  return (
    <group>
      <group position={[0, 0.32, 0.88]} rotation-z={Math.PI / 2}>
        <mesh castShadow geometry={GEO_MOTO_RUEDA_DEL_LLANTA} material={MAT_MOTO_LLANTA} />
        <mesh geometry={GEO_MOTO_RUEDA_DEL_RIN} material={MAT_MOTO_RIN} />
      </group>
      <group position={[0, 0.6, 0.76]} rotation-x={-0.24}>
        <mesh position={[-0.08, 0, 0]} geometry={GEO_MOTO_HORQUILLA} material={MAT_MOTO_HORQUILLA} />
        <mesh position={[0.08, 0, 0]} geometry={GEO_MOTO_HORQUILLA} material={MAT_MOTO_HORQUILLA} />
      </group>
      <group position={[0, 0.32, -0.88]} rotation-z={Math.PI / 2}>
        <mesh castShadow geometry={GEO_MOTO_RUEDA_TRAS_LLANTA} material={MAT_MOTO_LLANTA} />
        <mesh geometry={GEO_MOTO_RUEDA_TRAS_RIN} material={MAT_MOTO_RIN} />
      </group>
      <mesh position={[0, 0.34, -0.44]} rotation-x={0.08} geometry={GEO_MOTO_BASCULANTE} material={MAT_MOTO_BASCULANTE} />
      <mesh position={[0, 0.38, -0.05]} castShadow geometry={GEO_MOTO_MOTOR} material={MAT_MOTO_MOTOR} />
      <mesh position={[0.17, 0.25, -0.45]} rotation-x={0.08} castShadow geometry={GEO_MOTO_ESCAPE} material={MAT_MOTO_ESCAPE} />
      <mesh position={[0, 0.72, 0.22]} castShadow geometry={GEO_MOTO_TANQUE}>
        <meshPhysicalMaterial
          ref={refCarroceria}
          color="#dc2626"
          metalness={0.6}
          roughness={0.2}
          clearcoat={1}
          clearcoatRoughness={0.06}
        />
      </mesh>
      <mesh position={[0, 0.66, -0.32]} castShadow geometry={GEO_MOTO_ASIENTO} material={MAT_MOTO_ASIENTO} />
      <mesh position={[0, 0.92, 0.54]} rotation-z={Math.PI / 2} geometry={GEO_MOTO_MANILLAR} material={MAT_MOTO_MANILLAR} />
      <mesh position={[-0.3, 0.92, 0.54]} rotation-z={Math.PI / 2} geometry={GEO_MOTO_PUNO} material={MAT_MOTO_PUNO} />
      <mesh position={[0.3, 0.92, 0.54]} rotation-z={Math.PI / 2} geometry={GEO_MOTO_PUNO} material={MAT_MOTO_PUNO} />
      <mesh position={[0, 0.76, 0.92]} geometry={GEO_MOTO_FARO} material={MAT_MOTO_FARO} />
      <mesh position={[0, 0.7, -0.92]} geometry={GEO_MOTO_LUZ_TRAS}>
        <meshStandardMaterial
          ref={refCalavera}
          color="#dc2626"
          emissive="#dc2626"
          emissiveIntensity={1.2}
          toneMapped={false}
        />
      </mesh>
      {/* Conductor */}
      <group position={[0, 0.95, -0.08]} rotation-x={0.22}>
        <mesh position={[0, 0.16, 0]} castShadow geometry={GEO_CONDUCTOR_TORSO} material={MAT_CONDUCTOR_CHAMARRA} />
        <mesh position={[0, 0.44, 0.02]} castShadow geometry={GEO_CONDUCTOR_CASCO} material={MAT_CONDUCTOR_CASCO} />
        <mesh position={[0, 0.43, 0.12]} geometry={GEO_CONDUCTOR_VISOR} material={MAT_CONDUCTOR_VISOR} />
        <mesh position={[-0.18, 0.18, 0.22]} rotation-x={-0.6} rotation-z={-0.2} geometry={GEO_CONDUCTOR_BRAZO} material={MAT_CONDUCTOR_CHAMARRA} />
        <mesh position={[0.18, 0.18, 0.22]} rotation-x={-0.6} rotation-z={0.2} geometry={GEO_CONDUCTOR_BRAZO} material={MAT_CONDUCTOR_CHAMARRA} />
      </group>
      <group position={[-0.14, 0.5, -0.15]}>
        <mesh rotation-x={0.4} geometry={GEO_CONDUCTOR_PIERNA} material={MAT_CONDUCTOR_PANTALON} />
      </group>
      <group position={[0.14, 0.5, -0.15]}>
        <mesh rotation-x={0.4} geometry={GEO_CONDUCTOR_PIERNA} material={MAT_CONDUCTOR_PANTALON} />
      </group>
    </group>
  );
}

function EspacioVehiculo({
  index,
  grupos,
  gruposAutos,
  gruposMotos,
  carrocerias,
  carroceriasMotos,
  calaveras,
  calaverasMotos,
}: {
  index: number;
  grupos: React.MutableRefObject<(THREE.Group | null)[]>;
  gruposAutos: React.MutableRefObject<(THREE.Group | null)[]>;
  gruposMotos: React.MutableRefObject<(THREE.Group | null)[]>;
  carrocerias: React.MutableRefObject<(THREE.MeshPhysicalMaterial | null)[]>;
  carroceriasMotos: React.MutableRefObject<(THREE.MeshPhysicalMaterial | null)[]>;
  calaveras: React.MutableRefObject<(THREE.MeshStandardMaterial | null)[]>;
  calaverasMotos: React.MutableRefObject<(THREE.MeshStandardMaterial | null)[]>;
}) {
  const esSUV = index % 3 === 1;
  const esTaxi = index % 3 === 2;

  return (
    <group ref={(g) => void (grupos.current[index] = g)} visible={false}>
      {/* Automóvil (Sedán, SUV, Taxi) */}
      <group ref={(g) => void (gruposAutos.current[index] = g)} visible={true}>
        <mesh
          geometry={esSUV ? GEO_SUV_CHASIS : GEO_SEDAN_CHASIS}
          position-y={esSUV ? 0.68 : 0.6}
          castShadow
          receiveShadow
        >
          <meshPhysicalMaterial
            ref={(m) => void (carrocerias.current[index] = m)}
            color="#f4f4f2"
            metalness={0.55}
            roughness={0.22}
            clearcoat={1}
            clearcoatRoughness={0.06}
          />
        </mesh>
        <mesh
          geometry={esSUV ? GEO_SUV_CABINA : GEO_SEDAN_CABINA}
          material={MAT_CABINA}
          position={[0, esSUV ? 1.24 : 1.1, esSUV ? -0.15 : -0.22]}
          castShadow
        />
        <mesh position={[0, esSUV ? 0.44 : 0.4, 2.14]} geometry={GEO_PARRILLA} material={MAT_PARRILLA} />
        <mesh position={[-0.72, esSUV ? 0.74 : 0.66, 2.14]} geometry={GEO_FARO} material={MAT_FARO} />
        <mesh position={[0.72, esSUV ? 0.74 : 0.66, 2.14]} geometry={GEO_FARO} material={MAT_FARO} />
        <mesh position={[0, esSUV ? 0.82 : 0.74, -2.14]} geometry={GEO_CALAVERA}>
          <meshStandardMaterial
            ref={(m) => void (calaveras.current[index] = m)}
            color="#dc2626"
            emissive="#dc2626"
            emissiveIntensity={1.2}
            toneMapped={false}
          />
        </mesh>
        <mesh position={[-1.04, esSUV ? 1.05 : 0.94, 0.42]} castShadow geometry={GEO_ESPEJO} material={MAT_ESPEJO} />
        <mesh position={[1.04, esSUV ? 1.05 : 0.94, 0.42]} castShadow geometry={GEO_ESPEJO} material={MAT_ESPEJO} />
        <Rueda position={[-0.96, 0.34, 1.32]} esDerecha={false} />
        <Rueda position={[0.96, 0.34, 1.32]} esDerecha={true} />
        <Rueda position={[-0.96, 0.34, -1.32]} esDerecha={false} />
        <Rueda position={[0.96, 0.34, -1.32]} esDerecha={true} />
        {esSUV && (
          <group position={[0, 1.56, -0.15]}>
            <mesh position={[-0.68, 0, 0]} geometry={GEO_BARRAS_TECHO} material={MAT_BARRAS_TECHO} />
            <mesh position={[0.68, 0, 0]} geometry={GEO_BARRAS_TECHO} material={MAT_BARRAS_TECHO} />
          </group>
        )}
        {esTaxi && (
          <group position={[0, 1.4, 0]}>
            <mesh castShadow geometry={GEO_LETRERO_TAXI} material={MAT_LETRERO_TAXI} />
          </group>
        )}
      </group>

      {/* Motocicleta con Conductor */}
      <group ref={(g) => void (gruposMotos.current[index] = g)} visible={false}>
        <ModeloMoto
          refCarroceria={(m) => void (carroceriasMotos.current[index] = m)}
          refCalavera={(m) => void (calaverasMotos.current[index] = m)}
        />
      </group>
    </group>
  );
}

export default function FlotaVehicular({
  grupos,
  tiposEspacio,
  dashboard = false,
  pausado = false,
  simRef,
}: {
  grupos: React.MutableRefObject<(THREE.Group | null)[]>;
  tiposEspacio: React.MutableRefObject<string[]>;
  dashboard?: boolean;
  pausado?: boolean;
  simRef: SimRefHolder;
}) {
  const gruposAutos = useRef<(THREE.Group | null)[]>([]);
  const gruposMotos = useRef<(THREE.Group | null)[]>([]);
  const carrocerias = useRef<(THREE.MeshPhysicalMaterial | null)[]>([]);
  const carroceriasMotos = useRef<(THREE.MeshPhysicalMaterial | null)[]>([]);
  const calaveras = useRef<(THREE.MeshStandardMaterial | null)[]>([]);
  const calaverasMotos = useRef<(THREE.MeshStandardMaterial | null)[]>([]);

  const espacioDe = useRef(new Map<number, number>());
  const libres = useRef<number[]>(Array.from({ length: MAX_AUTOS }, (_, i) => i));

  useFrame((_, delta) => {
    const sim = simRef.current;
    if (!sim) return;
    const p = story.p;
    sim.mode = dashboard ? "adaptive" : p < 0.14 ? "fixed" : p < 0.8 ? "jam" : "adaptive";
    if (!pausado) step(sim, Math.min(delta, 0.05));

    const activos = new Set<number>();
    for (const car of sim.cars) {
      activos.add(car.id);
      let slot = espacioDe.current.get(car.id);
      if (slot === undefined) {
        slot = libres.current.pop();
        if (slot === undefined) continue;
        espacioDe.current.set(car.id, slot);

        const esMoto = car.vType === "moto";
        tiposEspacio.current[slot] = car.vType;

        if (gruposAutos.current[slot]) gruposAutos.current[slot]!.visible = !esMoto;
        if (gruposMotos.current[slot]) gruposMotos.current[slot]!.visible = esMoto;

        if (esMoto) {
          carroceriasMotos.current[slot]?.color.set(PALETA_COLORES[car.color % PALETA_COLORES.length]!);
        } else {
          const esTaxi = car.vType === "taxi";
          carrocerias.current[slot]?.color.set(esTaxi ? "#eab308" : PALETA_COLORES[car.color % PALETA_COLORES.length]!);
        }
      }
      const g = grupos.current[slot];
      if (!g) continue;
      const pose = lanePose(car.lane, car.s);
      g.visible = true;
      g.position.set(pose.x, 0, pose.z);
      g.rotation.y = pose.rot;

      const frenando = car.speed < 2.0;
      const esMoto = car.vType === "moto";
      const calavera = esMoto ? calaverasMotos.current[slot] : calaveras.current[slot];
      if (calavera) {
        calavera.emissiveIntensity = frenando ? 3.8 : 0.9;
        calavera.color.set(frenando ? "#ff0033" : "#991b1b");
      }
    }
    for (const [id, slot] of espacioDe.current) {
      if (!activos.has(id)) {
        espacioDe.current.delete(id);
        libres.current.push(slot);
        const g = grupos.current[slot];
        if (g) g.visible = false;
      }
    }
  });

  return (
    <group>
      {Array.from({ length: MAX_AUTOS }, (_, i) => (
        <EspacioVehiculo
          key={i}
          index={i}
          grupos={grupos}
          gruposAutos={gruposAutos}
          gruposMotos={gruposMotos}
          carrocerias={carrocerias}
          carroceriasMotos={carroceriasMotos}
          calaveras={calaveras}
          calaverasMotos={calaverasMotos}
        />
      ))}
    </group>
  );
}

