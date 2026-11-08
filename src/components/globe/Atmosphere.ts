import {
  AdditiveBlending,
  BackSide,
  Color,
  Mesh,
  type Object3D,
  ShaderMaterial,
  SphereGeometry,
  Vector3,
} from "three";
import { atmosphereFragment, atmosphereVertex } from "@/lib/three/shaders";

export interface AtmosphereHandle {
  object: Object3D;
  setSunDirection(dir: readonly [number, number, number]): void;
  dispose(): void;
}

/** Fresnel-style glow on the back faces of a slightly larger sphere. */
export function createAtmosphere(color = "#5fb8ff", shellRadius = 1.1): AtmosphereHandle {
  const material = new ShaderMaterial({
    vertexShader: atmosphereVertex,
    fragmentShader: atmosphereFragment,
    uniforms: {
      uColor: { value: new Color(color) },
      uSunDir: { value: new Vector3(1, 0, 0) },
      uInvRadius: { value: 1 / shellRadius },
    },
    side: BackSide,
    blending: AdditiveBlending,
    transparent: true,
    depthWrite: false,
  });
  const geometry = new SphereGeometry(shellRadius, 96, 64);
  const mesh = new Mesh(geometry, material);

  return {
    object: mesh,
    setSunDirection(dir) {
      (material.uniforms.uSunDir.value as Vector3).set(dir[0], dir[2], -dir[1]).normalize();
    },
    dispose() {
      geometry.dispose();
      material.dispose();
    },
  };
}
