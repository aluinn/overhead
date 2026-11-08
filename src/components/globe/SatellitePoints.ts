import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  Points,
  ShaderMaterial,
  type Object3D,
} from "three";
import type { PositionStream } from "@/lib/three/positionStream";
import { satFragment, satVertex } from "@/lib/three/shaders";
import { ObjectKind } from "@/types";

/** One accent hue (cyan) plus a small semantic palette for the other kinds. */
export const KIND_COLORS: Record<ObjectKind, string> = {
  [ObjectKind.Other]: "#e8eef7",
  [ObjectKind.Debris]: "#ff6a3d",
  [ObjectKind.Starlink]: "#38e1ff",
  [ObjectKind.Station]: "#ffc83d",
};

// Point sizes in CSS px at the reference camera distance.
const KIND_SIZES: Record<ObjectKind, number> = {
  [ObjectKind.Other]: 2.4,
  [ObjectKind.Debris]: 2.2,
  [ObjectKind.Starlink]: 2.2,
  [ObjectKind.Station]: 9,
};

export interface SatellitePointsHandle {
  object: Object3D;
  /** Call every frame: syncs GPU buffers with the stream and sets the lerp factor. */
  update(stream: PositionStream, selected: number | null, hovered: number | null): void;
  setKinds(kinds: ArrayLike<number>): void;
  /** Mark objects above the observer (`visible` indices) and train members; `dim` fades the rest. */
  setFlags(visible: ArrayLike<number> | null, trainOf: ArrayLike<number> | null, dim: boolean): void;
  setPixelRatio(ratio: number): void;
  dispose(): void;
}

export function createSatellitePoints(): SatellitePointsHandle {
  const material = new ShaderMaterial({
    vertexShader: satVertex,
    fragmentShader: satFragment,
    uniforms: {
      uAlpha: { value: 0 },
      uPixelRatio: { value: 1 },
      uDim: { value: 0 },
      uSelected: { value: -1 },
      uHovered: { value: -1 },
      uColors: { value: [ObjectKind.Other, ObjectKind.Debris, ObjectKind.Starlink, ObjectKind.Station].map((k) => new Color(KIND_COLORS[k as ObjectKind])) },
      uSizes: { value: [ObjectKind.Other, ObjectKind.Debris, ObjectKind.Starlink, ObjectKind.Station].map((k) => KIND_SIZES[k as ObjectKind]) },
    },
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
  });

  const points = new Points(new BufferGeometry(), material);
  points.frustumCulled = false;
  points.renderOrder = 2;

  let kinds: ArrayLike<number> = new Uint8Array(0);
  let boundGeneration = -1;
  let boundVersion = -1;
  let flags = new Float32Array(0);
  let flagAttr: BufferAttribute | null = null;
  let prevAttr: BufferAttribute | null = null;
  let nextAttr: BufferAttribute | null = null;

  const rebuild = (stream: PositionStream): void => {
    points.geometry.dispose();
    const geo = new BufferGeometry();
    // `position` is required by three for draw-count; aPrev/aNext carry the data.
    prevAttr = new BufferAttribute(stream.prev, 3).setUsage(35048 /* DynamicDrawUsage */);
    nextAttr = new BufferAttribute(stream.next, 3).setUsage(35048);
    geo.setAttribute("position", prevAttr);
    geo.setAttribute("aPrev", prevAttr);
    geo.setAttribute("aNext", nextAttr);
    const kindAttr = new Float32Array(stream.count);
    for (let i = 0; i < stream.count; i++) kindAttr[i] = kinds[i] ?? 0;
    geo.setAttribute("aKind", new BufferAttribute(kindAttr, 1));
    if (flags.length !== stream.count) flags = new Float32Array(stream.count);
    flagAttr = new BufferAttribute(flags, 1).setUsage(35048);
    geo.setAttribute("aFlag", flagAttr);
    points.geometry = geo;
    boundGeneration = stream.generation;
    boundVersion = -1;
  };

  return {
    object: points,
    setKinds(k) {
      kinds = k;
      boundGeneration = -1; // force rebuild on next update
    },
    setFlags(visible, trainOf, dim) {
      flags.fill(0);
      if (visible) for (let k = 0; k < visible.length; k++) flags[visible[k]] |= 1;
      if (trainOf) for (let i = 0; i < Math.min(trainOf.length, flags.length); i++) if (trainOf[i] >= 0) flags[i] |= 2;
      material.uniforms.uDim.value = dim ? 1 : 0;
      if (flagAttr) flagAttr.needsUpdate = true;
    },
    update(stream, selected, hovered) {
      if (stream.count === 0) return;
      if (stream.generation !== boundGeneration) rebuild(stream);
      if (stream.version !== boundVersion && prevAttr && nextAttr) {
        prevAttr.needsUpdate = true;
        nextAttr.needsUpdate = true;
        boundVersion = stream.version;
      }
      material.uniforms.uAlpha.value = stream.alpha();
      material.uniforms.uSelected.value = selected ?? -1;
      material.uniforms.uHovered.value = hovered ?? -1;
    },
    setPixelRatio(ratio) {
      material.uniforms.uPixelRatio.value = ratio;
    },
    dispose() {
      points.geometry.dispose();
      material.dispose();
    },
  };
}
