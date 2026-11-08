import { BufferAttribute, BufferGeometry, Color, Line, LineBasicMaterial, type Object3D } from "three";

export interface OrbitTrailHandle {
  object: Object3D;
  /** Replace the polyline with scene-space points (xyz triples). Empty hides it. */
  setPositions(positions: Float32Array): void;
  setColor(color: string): void;
  dispose(): void;
}

/** A thin, translucent polyline for an object's path. */
export function createOrbitTrail(color = "#38e1ff"): OrbitTrailHandle {
  const material = new LineBasicMaterial({ color: new Color(color), transparent: true, opacity: 0.75, depthWrite: false });
  const line = new Line(new BufferGeometry(), material);
  line.frustumCulled = false;
  line.visible = false;
  line.renderOrder = 1;

  return {
    object: line,
    setPositions(positions) {
      line.geometry.dispose();
      const geo = new BufferGeometry();
      geo.setAttribute("position", new BufferAttribute(positions, 3));
      line.geometry = geo;
      line.visible = positions.length >= 6;
    },
    setColor(c) {
      material.color.set(c);
    },
    dispose() {
      line.geometry.dispose();
      material.dispose();
    },
  };
}
