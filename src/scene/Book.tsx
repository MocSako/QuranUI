"use client";

import { useLayoutEffect, useMemo, useRef, type RefObject } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { BOOK_PAGES, MUSHAF_PAGES } from "@/book/samplePages";
import { useReader } from "@/state/reader";
import type { TurnEngine } from "@/turn/turn";
import { tuning } from "@/turn/tuning";
import {
  leafFragmentShader,
  leafVertexShader,
  shadowFragmentShader,
  shadowVertexShader,
} from "./curl";
import {
  blockThickness,
  COVER_PAD,
  COVER_THICKNESS,
  OPEN_ANGLE,
  PAGE_H,
  PAGE_W,
  SPINE_Y,
} from "./geometry";
import { pageEdgeTexture } from "./textures";
import { usePageTextures } from "./usePageTextures";

export const LIGHT_DIR = new THREE.Vector3(-1.6, 4.2, 2.2).normalize();

const LEAF_SEGMENTS: [number, number] = [40, 60];

function leafGeometry(): THREE.PlaneGeometry {
  const g = new THREE.PlaneGeometry(PAGE_W, PAGE_H, ...LEAF_SEGMENTS);
  g.translate(-PAGE_W / 2, 0, 0);
  return g;
}

function leafMaterial(paper: THREE.Texture, ink: { value: number }, side: 1 | -1): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader: leafVertexShader,
    fragmentShader: leafFragmentShader,
    side: THREE.DoubleSide,
    uniforms: {
      uP0: { value: new THREE.Vector2() },
      uN: { value: new THREE.Vector2(1, 0) },
      uR: { value: 0 },
      uSide: { value: side },
      uActive: { value: 0 },
      uZFrom: { value: 0 },
      uZTo: { value: 0 },
      uW: { value: PAGE_W },
      uOpen: { value: OPEN_ANGLE },
      uCrossAll: { value: 0 },
      uA: { value: paper },
      uB: { value: paper },
      uPaper: { value: paper },
      uLight: { value: new THREE.Vector3(0, 0, 1) },
      uAmbient: { value: 0.55 },
      uDiffuse: { value: 0.6 },
      uInk: ink,
      uGutter: { value: tuning.gutterShade },
    },
  });
}

function shadowMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader: shadowVertexShader,
    fragmentShader: shadowFragmentShader,
    transparent: true,
    depthWrite: false,
    uniforms: {
      uP0: { value: new THREE.Vector2() },
      uN: { value: new THREE.Vector2(1, 0) },
      uR: { value: 0 },
      uSide: { value: 1 },
      uActive: { value: 0 },
      uIsFrom: { value: 0 },
      uW: { value: PAGE_W },
      uH: { value: PAGE_H },
      uStrength: { value: tuning.shadowStrength },
    },
  });
}

const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

interface BookProps {
  engine: TurnEngine;
  ink: { value: number };
  left: RefObject<THREE.Group | null>;
  right: RefObject<THREE.Group | null>;
}

export function Book({ engine, ink, left, right }: BookProps) {
  const invalidate = useThree((s) => s.invalidate);
  const { paper, pages } = usePageTextures();
  const leaves = useReader((s) => s.leaves);
  const position = useReader((s) => s.position);

  const geometry = useMemo(leafGeometry, []);
  const shadowGeometries = useMemo(() => {
    const l = new THREE.PlaneGeometry(PAGE_W, PAGE_H).translate(-PAGE_W / 2, 0, 0);
    const r = new THREE.PlaneGeometry(PAGE_W, PAGE_H).translate(PAGE_W / 2, 0, 0);
    return { l, r };
  }, []);
  const mats = useMemo(
    () => ({
      L0: leafMaterial(paper, ink, 1),
      L1: leafMaterial(paper, ink, 1),
      R0: leafMaterial(paper, ink, -1),
      R1: leafMaterial(paper, ink, -1),
      shadowL: shadowMaterial(),
      shadowR: shadowMaterial(),
    }),
    [paper, ink],
  );
  const edges = useMemo(() => {
    const across = pageEdgeTexture();
    across.center.set(0.5, 0.5);
    across.rotation = Math.PI / 2;
    const along = pageEdgeTexture();
    return { across, along };
  }, []);

  const slots = {
    L0: leaves[position],
    L1: leaves[position + 1],
    R0: leaves[position - 1],
    R1: leaves[position - 2],
  };
  const tex = (page: number | null | undefined) => (page != null ? (pages.get(page) ?? paper) : paper);
  for (const key of ["L0", "L1", "R0", "R1"] as const) {
    mats[key].uniforms.uA.value = tex(slots[key]?.a);
    mats[key].uniforms.uB.value = tex(slots[key]?.b);
  }

  // The page block shows where this page sits in the 604-page mushaf.
  const anchorPage = slots.R0?.b;
  const mushafPage = anchorPage ? BOOK_PAGES[anchorPage - 1].mushafPage : 1;
  const target = blockThickness(mushafPage, MUSHAF_PAGES);
  const blocks = useRef({ ...target });
  const blockL = useRef<THREE.Mesh>(null);
  const blockR = useRef<THREE.Mesh>(null);
  const shadowL = useRef<THREE.Mesh>(null);
  const shadowR = useRef<THREE.Mesh>(null);

  // The leaf that landed now lies on its new side; hand it over in the same frame.
  useLayoutEffect(() => {
    engine.acknowledge();
    invalidate();
  }, [position, engine, invalidate]);

  const lightL = useMemo(() => new THREE.Vector3(), []);
  const lightR = useMemo(() => new THREE.Vector3(), []);
  const q = useMemo(() => new THREE.Quaternion(), []);

  useFrame((_, dt) => {
    const b = blocks.current;
    const k = Math.min(1, dt * 10);
    b.left += (target.left - b.left) * k;
    b.right += (target.right - b.right) * k;
    if (Math.abs(target.left - b.left) + Math.abs(target.right - b.right) > 1e-5) invalidate();

    blockL.current?.scale.set(PAGE_W, PAGE_H, b.left);
    blockL.current?.position.set(-PAGE_W / 2, 0, b.left / 2);
    blockR.current?.scale.set(PAGE_W, PAGE_H, b.right);
    blockR.current?.position.set(PAGE_W / 2, 0, b.right / 2);

    if (left.current && right.current) {
      left.current.getWorldQuaternion(q);
      lightL.copy(LIGHT_DIR).applyQuaternion(q.invert());
      right.current.getWorldQuaternion(q);
      lightR.copy(LIGHT_DIR).applyQuaternion(q.invert());
    }

    const rest: Array<[THREE.ShaderMaterial, number, THREE.Vector3]> = [
      [mats.L0, b.left + 0.002, lightL],
      [mats.L1, b.left + 0.001, lightL],
      [mats.R0, b.right + 0.002, lightR],
      [mats.R1, b.right + 0.001, lightR],
    ];
    for (const [m, z, light] of rest) {
      m.uniforms.uActive.value = 0;
      m.uniforms.uZFrom.value = z;
      m.uniforms.uZTo.value = z;
      m.uniforms.uCrossAll.value = 0;
      m.uniforms.uLight.value.copy(light);
    }

    const turning = engine.active;
    for (const m of [mats.shadowL, mats.shadowR]) m.uniforms.uActive.value = turning ? 1 : 0;
    if (!turning) return;

    const f = engine.fold;
    const fromLeft = engine.side === 1;
    const leaf = fromLeft ? mats.L0 : mats.R0;
    const zFrom = fromLeft ? b.left : b.right;
    const zTo = fromLeft ? b.right : b.left;
    const u = leaf.uniforms;
    u.uActive.value = 1;
    u.uP0.value.set(f.p0x, f.p0y);
    u.uN.value.set(f.nx, f.ny);
    u.uR.value = f.r;
    u.uZFrom.value = zFrom + 0.002;
    u.uZTo.value = zTo + 0.003;
    u.uCrossAll.value = smoothstep(0.8, 1, f.progress);

    const fromShadow = fromLeft ? mats.shadowL : mats.shadowR;
    const toShadow = fromLeft ? mats.shadowR : mats.shadowL;
    for (const m of [fromShadow, toShadow]) {
      m.uniforms.uP0.value.set(f.p0x, f.p0y);
      m.uniforms.uN.value.set(f.nx, f.ny);
      m.uniforms.uR.value = f.r;
      m.uniforms.uSide.value = engine.side;
    }
    fromShadow.uniforms.uIsFrom.value = 1;
    toShadow.uniforms.uIsFrom.value = 0;
    const fromMesh = fromLeft ? shadowL.current : shadowR.current;
    const toMesh = fromLeft ? shadowR.current : shadowL.current;
    fromMesh?.position.set(0, 0, zFrom + 0.0015);
    toMesh?.position.set(0, 0, zTo + 0.0025);
  });

  const coverMaterial = useMemo(() => new THREE.MeshLambertMaterial({ color: "#2a1511" }), []);
  const blockMaterials = useMemo(() => {
    const top = new THREE.MeshLambertMaterial({ color: "#efe3c6" });
    const across = new THREE.MeshLambertMaterial({ map: edges.across });
    const along = new THREE.MeshLambertMaterial({ map: edges.along });
    return [across, across, along, along, top, top];
  }, [edges]);

  const cover = (side: 1 | -1) => (
    <mesh
      material={coverMaterial}
      position={[(-side * (PAGE_W + COVER_PAD)) / 2, 0, -COVER_THICKNESS / 2]}
    >
      <boxGeometry args={[PAGE_W + COVER_PAD, PAGE_H + 2 * COVER_PAD, COVER_THICKNESS]} />
    </mesh>
  );

  return (
    <group position={[0, SPINE_Y, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <group ref={left} rotation={[0, OPEN_ANGLE, 0]}>
        {cover(1)}
        <mesh ref={blockL} material={blockMaterials}>
          <boxGeometry args={[1, 1, 1]} />
        </mesh>
        <mesh geometry={geometry} material={mats.L1} visible={!!slots.L1} />
        <mesh geometry={geometry} material={mats.L0} visible={!!slots.L0} />
        <mesh ref={shadowL} geometry={shadowGeometries.l} material={mats.shadowL} renderOrder={2} />
      </group>
      <group ref={right} rotation={[0, -OPEN_ANGLE, 0]}>
        {cover(-1)}
        <mesh ref={blockR} material={blockMaterials}>
          <boxGeometry args={[1, 1, 1]} />
        </mesh>
        <mesh geometry={geometry} material={mats.R1} visible={!!slots.R1} />
        <mesh geometry={geometry} material={mats.R0} visible={!!slots.R0} />
        <mesh ref={shadowR} geometry={shadowGeometries.r} material={mats.shadowR} renderOrder={2} />
      </group>
      <mesh position={[0, 0, -COVER_THICKNESS * 1.1]} material={coverMaterial}>
        <cylinderGeometry args={[COVER_THICKNESS * 0.8, COVER_THICKNESS * 0.8, PAGE_H + 2 * COVER_PAD, 16]} />
      </mesh>
    </group>
  );
}
