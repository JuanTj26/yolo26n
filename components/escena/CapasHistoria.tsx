"use client";

import { useRef, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { story, factors } from "@/lib/story";

export function CapaAnalisis() {
  const ew = useRef<THREE.MeshBasicMaterial[]>([]);
  const ns = useRef<THREE.MeshBasicMaterial[]>([]);
  const anillo = useRef<THREE.Mesh>(null);
  const matAnillo = useRef<THREE.MeshBasicMaterial>(null);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const f = factors(story.p);
    const pulso = 0.6 + 0.4 * Math.sin(t * 3);
    ew.current.forEach((m) => {
      if (m) m.opacity = (f.decision * 0.4 + f.solution * 0.12) * pulso;
    });
    ns.current.forEach((m) => {
      if (m) m.opacity = f.decision * 0.2;
    });
    if (anillo.current && matAnillo.current) {
      const k = (t * 0.45) % 1;
      anillo.current.scale.setScalar(4 + k * 70);
      matAnillo.current.opacity = f.intel * (1 - f.solution * 0.7) * (1 - k) * 0.5;
    }
  });

  return (
    <group position-y={0.1}>
      {[1, -1].map((s, i) => (
        <mesh key={"e" + s} rotation-x={-Math.PI / 2} position={[s * 38, 0.01, -s * 2]}>
          <planeGeometry args={[60, 3.4]} />
          <meshBasicMaterial
            ref={(m) => void (m && (ew.current[i] = m))}
            color="#22c55e"
            transparent
            opacity={0}
            depthWrite={false}
          />
        </mesh>
      ))}
      {[1, -1].map((s, i) => (
        <mesh key={"n" + s} rotation-x={-Math.PI / 2} position={[s * 2, 0.01, s * 38]}>
          <planeGeometry args={[3.4, 60]} />
          <meshBasicMaterial
            ref={(m) => void (m && (ns.current[i] = m))}
            color="#ff3b30"
            transparent
            opacity={0}
            depthWrite={false}
          />
        </mesh>
      ))}
      <mesh ref={anillo} rotation-x={-Math.PI / 2} position-y={0.02}>
        <ringGeometry args={[0.97, 1, 96]} />
        <meshBasicMaterial ref={matAnillo} color="#0a0a0a" transparent opacity={0} depthWrite={false} />
      </mesh>
    </group>
  );
}

const shaderLiquido = /* glsl */ `
precision highp float;
uniform float uTime; uniform float uP; uniform vec2 uMouse; uniform vec2 uRes;
uniform float uJam; uniform float uSol; uniform float uTrans;
varying vec2 vUv;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
 return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<5;i++){v+=a*noise(p);p=p*2.03+vec2(1.7,9.2);a*=.5;}return v;}
void main(){
  vec2 uv=vUv; float asp=uRes.x/uRes.y; vec2 q=vec2(uv.x*asp,uv.y);
  vec2 m=vec2(uMouse.x*.5+.5,uMouse.y*.5+.5); m.x*=asp;
  float md=length(q-m);
  float t=uTime*.06+uP*3.;
  vec2 w=vec2(fbm(q*1.4+t),fbm(q*1.4-t+4.));
  w+=0.25*exp(-md*3.)*vec2(sin(uTime),cos(uTime));
  float n=fbm(q*2.+w*2.2+uP*4.);
  float bands=smoothstep(.55,.95,n);
  float caustic=pow(abs(sin(n*18.+uTime*.4)),24.)*.5;
  vec3 tint=mix(vec3(1.),vec3(1.,.42,.38),uJam*.7);
  tint=mix(tint,vec3(.45,.95,.62),uSol*.7);
  float edge=smoothstep(.15,0.,uv.y)+smoothstep(.85,1.,uv.y);
  float a=(bands*.16+caustic*.12)*(.45+uTrans*1.2)+edge*.25*(1.-uP*.5);
  vec3 col=mix(vec3(1.),tint,bands*.9);
  col+=caustic;
  gl_FragColor=vec4(col,clamp(a,0.,.55));
}`;

export function CapaLiquida() {
  const mat = useRef<THREE.ShaderMaterial>(null);
  const { size } = useThree();
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uP: { value: 0 },
      uMouse: { value: new THREE.Vector2() },
      uRes: { value: new THREE.Vector2(1, 1) },
      uJam: { value: 0 },
      uSol: { value: 0 },
      uTrans: { value: 0 },
    }),
    []
  );

  useFrame(({ clock }) => {
    const u = uniforms;
    const p = story.p;
    const f = factors(p);
    u.uTime.value = clock.elapsedTime;
    u.uP.value = p;
    u.uMouse.value.lerp(new THREE.Vector2(story.mouse.x, -story.mouse.y), 0.06);
    u.uRes.value.set(size.width, size.height);
    u.uJam.value = f.jam;
    u.uSol.value = f.solution;
    let tr = 0;
    for (const b of [0.14, 0.37, 0.59, 0.8]) tr = Math.max(tr, Math.exp(-Math.pow((p - b) / 0.03, 2)));
    u.uTrans.value = tr;
  });

  return (
    <mesh frustumCulled={false} renderOrder={999}>
      <planeGeometry args={[2, 2]} />
      <shaderMaterial
        ref={mat}
        uniforms={uniforms}
        transparent
        depthTest={false}
        depthWrite={false}
        vertexShader={`varying vec2 vUv; void main(){vUv=uv; gl_Position=vec4(position.xy,0.,1.);}`}
        fragmentShader={shaderLiquido}
      />
    </mesh>
  );
}

export function EscenaLista({ alEstarLista }: { alEstarLista: () => void }) {
  const listo = useRef(false);
  useFrame(() => {
    if (!listo.current) {
      listo.current = true;
      alEstarLista();
    }
  });
  return null;
}

