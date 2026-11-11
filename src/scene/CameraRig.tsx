"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { useReader } from "@/state/reader";
import { springStep } from "@/turn/spring";
import { tuning } from "@/turn/tuning";
import { bookToWorld, halfToBook, PAGE_H, PAGE_W } from "./geometry";

interface Pose {
  position: THREE.Vector3;
  target: THREE.Vector3;
  up: THREE.Vector3;
}

const FOV = 30;

function fitDistance(width: number, height: number, aspect: number): number {
  const t = Math.tan(THREE.MathUtils.degToRad(FOV / 2));
  return Math.max(height / 2 / t, width / 2 / (t * aspect));
}

function lookFrom(target: THREE.Vector3, elevation: number, azimuth: number, distance: number): Pose {
  const dir = new THREE.Vector3(
    Math.sin(azimuth) * Math.cos(elevation),
    Math.sin(elevation),
    Math.cos(azimuth) * Math.cos(elevation),
  );
  return { position: target.clone().addScaledVector(dir, distance), target, up: new THREE.Vector3(0, 1, 0) };
}

/** As if you have just sat down: further back and a little lower. */
function approachPose(aspect: number): Pose {
  const seated = seatedPose(aspect);
  const distance = seated.position.distanceTo(seated.target) * 1.32;
  return lookFrom(seated.target.clone().add(new THREE.Vector3(0, -0.1, 0.18)), THREE.MathUtils.degToRad(28), THREE.MathUtils.degToRad(14), distance);
}

/** Sitting on the floor in front of the rehal, stand and book both in view. */
function seatedPose(aspect: number): Pose {
  const portrait = aspect < 0.9;
  const target = new THREE.Vector3(0, portrait ? 0.78 : 0.62, 0);
  const width = portrait ? 2.05 : 2.35;
  const height = portrait ? 2.15 : 2.05;
  return lookFrom(target, THREE.MathUtils.degToRad(24), THREE.MathUtils.degToRad(10), fitDistance(width, height, aspect));
}

/** Face-on to one open page. */
function focusPose(half: 1 | -1, aspect: number): Pose {
  const local = new THREE.Vector3(half === 1 ? -PAGE_W / 2 : PAGE_W / 2, 0, 0.03);
  const target = bookToWorld(halfToBook(local, half));
  const normal = bookToWorld(halfToBook(new THREE.Vector3(0, 0, 1), half)).sub(bookToWorld(new THREE.Vector3()));
  const up = bookToWorld(new THREE.Vector3(0, 1, 0)).sub(bookToWorld(new THREE.Vector3()));
  const distance = fitDistance(PAGE_W * 0.9, PAGE_H * 0.92, aspect);
  return { position: target.clone().addScaledVector(normal, distance), target, up };
}

function springVec(current: THREE.Vector3, velocity: THREE.Vector3, target: THREE.Vector3, omega: number, dt: number): void {
  const [x, vx] = springStep(current.x, velocity.x, target.x, omega, dt);
  const [y, vy] = springStep(current.y, velocity.y, target.y, omega, dt);
  const [z, vz] = springStep(current.z, velocity.z, target.z, omega, dt);
  current.set(x, y, z);
  velocity.set(vx, vy, vz);
}

/** One glide from the approach to the seated view, then springs between seated and a page. */
export function CameraRig() {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const size = useThree((s) => s.size);
  const invalidate = useThree((s) => s.invalidate);
  const gl = useThree((s) => s.gl);
  const focus = useReader((s) => s.focus);
  const turning = useReader((s) => s.turning);
  const texturesReady = useReader((s) => s.texturesReady);
  const reducedMotion = useReader((s) => s.reducedMotion);

  const glide = useRef({ t: 0, v: 0, started: false });
  const cam = useRef({
    p: new THREE.Vector3(),
    t: new THREE.Vector3(),
    u: new THREE.Vector3(0, 1, 0),
    pv: new THREE.Vector3(),
    tv: new THREE.Vector3(),
    uv: new THREE.Vector3(),
    seeded: false,
  });
  const parallax = useRef({ x: 0, y: 0, vx: 0, vy: 0, tx: 0, ty: 0 });
  const aspect = size.width / size.height;
  const poses = useMemo(
    () => ({
      approach: approachPose(aspect),
      seated: seatedPose(aspect),
      left: focusPose(1, aspect),
      right: focusPose(-1, aspect),
    }),
    [aspect],
  );

  useEffect(() => {
    invalidate();
  }, [focus, turning, invalidate]);

  useEffect(() => {
    camera.fov = FOV;
    camera.near = 0.05;
    camera.far = 30;
    camera.updateProjectionMatrix();
  }, [camera]);

  useEffect(() => {
    if (!texturesReady || glide.current.started) return;
    if (reducedMotion) {
      glide.current = { t: 1, v: 0, started: true };
      invalidate();
      return;
    }
    const id = window.setTimeout(() => {
      glide.current.started = true;
      invalidate();
    }, 400);
    return () => window.clearTimeout(id);
  }, [texturesReady, reducedMotion, invalidate]);

  useEffect(() => {
    const fine = window.matchMedia("(pointer: fine)");
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse" || !fine.matches) return;
      if (useReader.getState().reducedMotion) return;
      const rect = gl.domElement.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      parallax.current.tx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      parallax.current.ty = ((e.clientY - rect.top) / rect.height) * 2 - 1;
      invalidate();
    };
    window.addEventListener("pointermove", onMove);
    return () => window.removeEventListener("pointermove", onMove);
  }, [gl, invalidate]);

  useFrame(({ scene: { fog } }, dt) => {
    const g = glide.current;
    if (g.started && g.t < 0.9995) {
      [g.t, g.v] = springStep(g.t, g.v, 1, tuning.glideOmega, Math.min(dt, 1 / 30));
      invalidate();
    } else if (g.started) {
      g.t = 1;
    }

    const seated = poses.seated;
    const desired = focus === 1 ? poses.left : focus === -1 ? poses.right : seated;
    const opening = g.t < 1;
    const from = opening ? poses.approach : desired;
    const to = opening ? seated : desired;

    const par = parallax.current;
    const allowParallax = !reducedMotion && focus === null && turning === null && !opening;
    const pxTarget = allowParallax ? par.tx : 0;
    const pyTarget = allowParallax ? par.ty : 0;
    if (reducedMotion) {
      par.x = pxTarget;
      par.y = pyTarget;
      par.vx = 0;
      par.vy = 0;
    } else {
      [par.x, par.vx] = springStep(par.x, par.vx, pxTarget, 8, Math.min(dt, 1 / 30));
      [par.y, par.vy] = springStep(par.y, par.vy, pyTarget, 8, Math.min(dt, 1 / 30));
    }
    if (Math.abs(par.x - pxTarget) + Math.abs(par.y - pyTarget) > 0.002) invalidate();

    const yaw = THREE.MathUtils.degToRad(tuning.parallaxDeg) * par.x;
    const pitch = THREE.MathUtils.degToRad(tuning.parallaxDeg * 0.65) * par.y;
    const offset = new THREE.Vector3().subVectors(to.position, to.target);
    offset.applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
    const right = new THREE.Vector3().crossVectors(offset, to.up).normalize();
    offset.applyAxisAngle(right, pitch);
    const aimed: Pose = {
      position: to.target.clone().add(offset),
      target: to.target,
      up: to.up,
    };

    const c = cam.current;
    if (!c.seeded) {
      c.p.copy(from.position);
      c.t.copy(from.target);
      c.u.copy(from.up);
      c.seeded = true;
    }

    const step = Math.min(dt, 1 / 30);
    if (opening) {
      c.p.lerpVectors(poses.approach.position, aimed.position, g.t);
      c.t.lerpVectors(poses.approach.target, aimed.target, g.t);
      c.u.lerpVectors(poses.approach.up, aimed.up, g.t).normalize();
    } else if (reducedMotion) {
      c.p.copy(aimed.position);
      c.t.copy(aimed.target);
      c.u.copy(aimed.up);
      c.pv.set(0, 0, 0);
      c.tv.set(0, 0, 0);
      c.uv.set(0, 0, 0);
    } else {
      springVec(c.p, c.pv, aimed.position, tuning.viewOmega, step);
      springVec(c.t, c.tv, aimed.target, tuning.viewOmega, step);
      springVec(c.u, c.uv, aimed.up, tuning.viewOmega, step);
      c.u.normalize();
      if (c.p.distanceTo(aimed.position) + c.t.distanceTo(aimed.target) > 0.0008) invalidate();
    }

    camera.position.copy(c.p);
    camera.up.copy(c.u);
    camera.lookAt(c.t);

    if (fog instanceof THREE.Fog) {
      const d = c.p.distanceTo(c.t);
      fog.near = d * 0.95;
      fog.far = d * 2.4;
    }
  });

  return null;
}
