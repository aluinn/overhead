import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Points,
  ShaderMaterial,
  type Object3D,
} from "three";
import { starFragment, starVertex } from "@/lib/three/shaders";

export interface StarfieldHandle {
  object: Object3D;
  update(timeSeconds: number): void;
  setPixelRatio(ratio: number): void;
  dispose(): void;
}

/** Deterministic PRNG so the sky is identical on every load (and in the OG image). */
function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createStarfield(count = 2200, radius = 80): StarfieldHandle {
  const rand = mulberry32(0x5a7e111e);
  const positions = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const twinkle = new Float32Array(count);

  for (let i = 0; i < count; i++) {
    // Uniform on the sphere.
    const u = rand() * 2 - 1;
    const phi = rand() * Math.PI * 2;
    const r = Math.sqrt(1 - u * u);
    positions[i * 3] = radius * r * Math.cos(phi);
    positions[i * 3 + 1] = radius * u;
    positions[i * 3 + 2] = radius * r * Math.sin(phi);
    // Mostly faint, a few bright.
    sizes[i] = 1.0 + Math.pow(rand(), 6) * 3.2;
    twinkle[i] = rand();
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(positions, 3));
  geometry.setAttribute("aSize", new BufferAttribute(sizes, 1));
  geometry.setAttribute("aTwinkle", new BufferAttribute(twinkle, 1));

  const material = new ShaderMaterial({
    vertexShader: starVertex,
    fragmentShader: starFragment,
    uniforms: { uTime: { value: 0 }, uPixelRatio: { value: 1 } },
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
  });

  const points = new Points(geometry, material);
  points.frustumCulled = false;
  points.renderOrder = -1;

  return {
    object: points,
    update(t) {
      material.uniforms.uTime.value = t;
    },
    setPixelRatio(ratio) {
      material.uniforms.uPixelRatio.value = ratio;
    },
    dispose() {
      geometry.dispose();
      material.dispose();
    },
  };
}
