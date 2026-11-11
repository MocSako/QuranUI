"use client";

import { useMemo, useRef } from "react";
import { Canvas } from "@react-three/fiber";
import type * as THREE from "three";
import { TurnEngine } from "@/turn/turn";
import { useTurnInput } from "@/turn/gesture";
import { Book, LIGHT_DIR } from "./Book";
import { CameraRig } from "./CameraRig";
import { PAGE_H, PAGE_W } from "./geometry";
import { Room, Stand } from "./Stand";

const GROUND = "#0e0d0c";

function Scene() {
  const engine = useMemo(() => new TurnEngine(PAGE_W, PAGE_H), []);
  const ink = useMemo(() => ({ value: 1 }), []);
  const left = useRef<THREE.Group>(null);
  const right = useRef<THREE.Group>(null);
  useTurnInput(engine, ink, left, right);

  const key = LIGHT_DIR.clone().multiplyScalar(6);

  return (
    <>
      <color attach="background" args={[GROUND]} />
      <fog attach="fog" args={[GROUND, 3.2, 8]} />
      <ambientLight color="#7a5c44" intensity={0.7} />
      <directionalLight
        color="#ffd7a3"
        intensity={1.8}
        position={key.toArray()}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-near={1}
        shadow-camera-far={16}
        shadow-camera-left={-2.4}
        shadow-camera-right={2.4}
        shadow-camera-top={2.4}
        shadow-camera-bottom={-2.4}
        shadow-bias={-0.0004}
      />
      <spotLight
        color="#ffc27a"
        intensity={18}
        position={[0.15, 3.4, 0.8]}
        angle={0.55}
        penumbra={0.7}
        distance={8}
        decay={2}
        castShadow={false}
      />
      <directionalLight color="#8aa0b8" intensity={0.35} position={[1.4, 1.6, -2.6]} />
      <Room />
      <Stand />
      <Book engine={engine} ink={ink} left={left} right={right} />
      <CameraRig />
    </>
  );
}

export default function BookScene({ label }: { label: string }) {
  return (
    <Canvas
      frameloop="demand"
      flat
      linear
      shadows
      dpr={[1, 2]}
      gl={{ antialias: true, powerPreference: "high-performance" }}
      style={{ position: "absolute", inset: 0, touchAction: "none" }}
      aria-label={label}
      role="img"
    >
      <Scene />
    </Canvas>
  );
}
