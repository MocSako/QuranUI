"use client";

import { useMemo } from "react";
import * as THREE from "three";
import { STAND } from "./geometry";
import { boardShape } from "./standShape";
import {
  contactShadowTexture,
  diamondKilimTexture,
  floorKilimTexture,
  stripedKilimTexture,
  WOOD,
  woodBoardTexture,
} from "./textures";

/** Two carved boards crossing in an X, half-lapped where they meet, pegged with a dowel. */
export function Stand() {
  const { geometry, faces, edge, peg } = useMemo(() => {
    const legLength = STAND.crossY / Math.sin(STAND.angle);
    const length = legLength + STAND.armLength;
    const shape = boardShape(length, STAND.thickness);
    const geometry = new THREE.ExtrudeGeometry(shape, {
      depth: STAND.depth,
      bevelEnabled: true,
      bevelThickness: 0.012,
      bevelSize: 0.01,
      bevelSegments: 2,
      curveSegments: 12,
    });
    geometry.translate(0, 0, -STAND.depth / 2);
    geometry.computeVertexNormals();

    const map = woodBoardTexture();
    return {
      geometry,
      faces: new THREE.MeshStandardMaterial({
        map,
        roughness: 0.82,
        metalness: 0.03,
        color: "#d09264",
      }),
      edge: new THREE.MeshStandardMaterial({
        color: WOOD.recess,
        roughness: 0.9,
        metalness: 0,
      }),
      peg: new THREE.MeshStandardMaterial({
        color: WOOD.highlight,
        roughness: 0.5,
        metalness: 0.05,
      }),
    };
  }, []);

  const legLength = STAND.crossY / Math.sin(STAND.angle);
  const offset = (STAND.armLength - legLength) / 2;
  const materials = [edge, faces, faces];

  return (
    <group>
      {[1, -1].map((dir, i) => {
        const a = dir === 1 ? STAND.angle : Math.PI - STAND.angle;
        const lap = (i === 0 ? 1 : -1) * 0.014;
        return (
          <mesh
            key={dir}
            geometry={geometry}
            material={materials}
            castShadow
            receiveShadow
            position={[Math.cos(a) * offset - lap * Math.sin(a), STAND.crossY + Math.sin(a) * offset + lap * Math.cos(a), 0]}
            rotation={[0, 0, a]}
          />
        );
      })}
      <mesh material={peg} position={[0, STAND.crossY, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <cylinderGeometry args={[0.022, 0.022, STAND.depth * 0.28, 16]} />
      </mesh>
    </group>
  );
}

/**
 * Textile room: one bordered kilim under the rehal, two hangings flanking the
 * open book, dark void past the fringe and behind the pages.
 */
export function Room() {
  const { floor, leftHang, rightHang, shadow } = useMemo(() => {
    return {
      floor: new THREE.MeshLambertMaterial({ map: floorKilimTexture() }),
      leftHang: new THREE.MeshLambertMaterial({ map: diamondKilimTexture() }),
      rightHang: new THREE.MeshLambertMaterial({ map: stripedKilimTexture() }),
      shadow: new THREE.MeshBasicMaterial({
        map: contactShadowTexture(),
        transparent: true,
        depthWrite: false,
        opacity: 0.7,
        color: "#000000",
      }),
    };
  }, []);

  // Floor: fringe toward the camera (+Z). Hangings sit beside the spread so the
  // wall directly behind the pages stays empty; fog eats their outer edges.
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0.35]} material={floor} receiveShadow>
        <planeGeometry args={[4.2, 4.8]} />
      </mesh>
      <mesh
        position={[-1.58, 1.05, -0.42]}
        rotation={[0, 0.18, 0]}
        material={leftHang}
        castShadow
        receiveShadow
      >
        <planeGeometry args={[1.15, 2.1]} />
      </mesh>
      <mesh
        position={[1.58, 1.05, -0.42]}
        rotation={[0, -0.18, 0]}
        material={rightHang}
        castShadow
        receiveShadow
      >
        <planeGeometry args={[0.9, 2.1]} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.002, 0]} material={shadow} scale={[2.2, 1.7, 1]}>
        <planeGeometry args={[1, 1]} />
      </mesh>
    </group>
  );
}
