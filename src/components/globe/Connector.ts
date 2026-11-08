import { BufferAttribute, BufferGeometry, Color, Line, LineBasicMaterial, type Object3D } from "three";

export interface ConnectorHandle {
  object: Object3D;
  set(visible: boolean): void;
  /** Move the endpoints (scene space). */
  update(ax: number, ay: number, az: number, bx: number, by: number, bz: number): void;
  dispose(): void;
}

/** A bright line between the two objects of a close approach. */
export function createConnector(color = "#ffffff"): ConnectorHandle {
  const positions = new Float32Array(6);
  const geo = new BufferGeometry();
  const attr = new BufferAttribute(positions, 3);
  geo.setAttribute("position", attr);
  const material = new LineBasicMaterial({ color: new Color(color), transparent: true, opacity: 0.9, depthWrite: false });
  const line = new Line(geo, material);
  line.frustumCulled = false;
  line.visible = false;
  line.renderOrder = 3;

  return {
    object: line,
    set(visible) {
      line.visible = visible;
    },
    update(ax, ay, az, bx, by, bz) {
      positions.set([ax, ay, az, bx, by, bz]);
      attr.needsUpdate = true;
    },
    dispose() {
      geo.dispose();
      material.dispose();
    },
  };
}
