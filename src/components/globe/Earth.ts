import {
  Color,
  Mesh,
  type Object3D,
  type Texture,
  ShaderMaterial,
  SphereGeometry,
  SRGBColorSpace,
  TextureLoader,
  Vector3,
  type WebGLRenderer,
} from "three";
import { earthFragment, earthVertex } from "@/lib/three/shaders";

export const ACCENT = "#38e1ff";

export interface EarthHandle {
  object: Object3D;
  setSunDirection(dir: readonly [number, number, number]): void;
  /** Resolves once all textures are decoded and uploaded. */
  ready: Promise<void>;
  dispose(): void;
}

/** The dark Earth: day texture dimmed, city lights on the night side. */
export function createEarth(renderer: WebGLRenderer): EarthHandle {
  const loader = new TextureLoader();
  const maxAniso = renderer.capabilities.getMaxAnisotropy();

  const load = (url: string, srgb: boolean): Promise<Texture> =>
    loader.loadAsync(url).then((tex) => {
      if (srgb) tex.colorSpace = SRGBColorSpace;
      tex.anisotropy = Math.min(8, maxAniso);
      return tex;
    });

  const day = load("/textures/earth_atmos_2048.jpg", true);
  const night = load("/textures/earth_lights_2048.png", true);
  const spec = load("/textures/earth_specular_2048.jpg", false);

  const material = new ShaderMaterial({
    vertexShader: earthVertex,
    fragmentShader: earthFragment,
    uniforms: {
      uDay: { value: null },
      uNight: { value: null },
      uSpecular: { value: null },
      uSunDir: { value: new Vector3(1, 0.2, 0.3).normalize() },
      uAccent: { value: new Color(ACCENT) },
    },
  });

  const geometry = new SphereGeometry(1, 96, 64);
  const mesh = new Mesh(geometry, material);

  const ready = Promise.all([day, night, spec]).then(([d, n, s]) => {
    material.uniforms.uDay.value = d;
    material.uniforms.uNight.value = n;
    material.uniforms.uSpecular.value = s;
  });

  return {
    object: mesh,
    ready,
    setSunDirection(dir) {
      (material.uniforms.uSunDir.value as Vector3).set(dir[0], dir[2], -dir[1]).normalize();
    },
    dispose() {
      geometry.dispose();
      material.dispose();
      for (const key of ["uDay", "uNight", "uSpecular"] as const) {
        (material.uniforms[key].value as Texture | null)?.dispose();
      }
    },
  };
}
