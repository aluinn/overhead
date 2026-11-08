import {
  BufferAttribute,
  BufferGeometry,
  Color,
  Group,
  Line,
  LineBasicMaterial,
  Mesh,
  MeshBasicMaterial,
  SphereGeometry,
  Vector3,
  type Object3D,
} from "three";
import { latLonToScene } from "@/lib/three/coords";

export interface ObserverMarkerHandle {
  object: Object3D;
  /** Place at lat/lon with a horizon ring of `ringDeg` degrees of arc; null hides it. */
  set(target: { latDeg: number; lonDeg: number } | null, ringDeg?: number): void;
  /** Gentle pulse; call per frame with seconds. */
  update(t: number): void;
  dispose(): void;
}

/** Dot + ring on the ground showing the observer and the horizon-limited footprint. */
export function createObserverMarker(color = "#38e1ff"): ObserverMarkerHandle {
  const group = new Group();
  group.visible = false;

  const dotGeo = new SphereGeometry(0.011, 16, 12);
  const dotMat = new MeshBasicMaterial({ color: new Color(color) });
  const dot = new Mesh(dotGeo, dotMat);

  const pulseGeo = new SphereGeometry(0.011, 16, 12);
  const pulseMat = new MeshBasicMaterial({ color: new Color(color), transparent: true, opacity: 0.4, depthWrite: false });
  const pulse = new Mesh(pulseGeo, pulseMat);

  const ringMat = new LineBasicMaterial({ color: new Color(color), transparent: true, opacity: 0.55, depthWrite: false });
  const ring = new Line(new BufferGeometry(), ringMat);
  ring.frustumCulled = false;

  group.add(dot, pulse, ring);

  return {
    object: group,
    set(target, ringDeg = 15) {
      if (!target) {
        group.visible = false;
        return;
      }
      const o = latLonToScene(target.latDeg, target.lonDeg);
      dot.position.copy(o).multiplyScalar(1.004);
      pulse.position.copy(dot.position);

      // Tangent basis at the observer, then sweep a small circle around it.
      const helper = Math.abs(o.y) > 0.95 ? new Vector3(1, 0, 0) : new Vector3(0, 1, 0);
      const e1 = new Vector3().crossVectors(o, helper).normalize();
      const e2 = new Vector3().crossVectors(o, e1).normalize();
      const d = (ringDeg * Math.PI) / 180;
      const N = 128;
      const pts = new Float32Array((N + 1) * 3);
      for (let i = 0; i <= N; i++) {
        const th = (i / N) * Math.PI * 2;
        const p = o
          .clone()
          .multiplyScalar(Math.cos(d))
          .addScaledVector(e1, Math.sin(d) * Math.cos(th))
          .addScaledVector(e2, Math.sin(d) * Math.sin(th))
          .multiplyScalar(1.003);
        pts.set([p.x, p.y, p.z], i * 3);
      }
      ring.geometry.dispose();
      const geo = new BufferGeometry();
      geo.setAttribute("position", new BufferAttribute(pts, 3));
      ring.geometry = geo;
      group.visible = true;
    },
    update(t) {
      const k = (t % 2) / 2;
      pulse.scale.setScalar(1 + k * 3.5);
      pulseMat.opacity = 0.45 * (1 - k);
    },
    dispose() {
      dotGeo.dispose();
      dotMat.dispose();
      pulseGeo.dispose();
      pulseMat.dispose();
      ring.geometry.dispose();
      ringMat.dispose();
    },
  };
}
