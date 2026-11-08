"use client";

import { useEffect, useRef, useState } from "react";
import { ACESFilmicToneMapping, PerspectiveCamera, Scene, Vector3, WebGLRenderer } from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { sunDirectionEcef } from "@/lib/orbital/sun";
import { CameraRig } from "@/lib/three/camera";
import { latLonToScene } from "@/lib/three/coords";
import { pickNearest, projectToScreen } from "@/lib/three/picking";
import { useRuntime } from "@/store/runtime";
import { createAtmosphere } from "./Atmosphere";
import { createEarth } from "./Earth";
import { LabelLayer } from "./labels";
import { createOrbitTrail } from "./OrbitTrail";
import { createSatellitePoints } from "./SatellitePoints";
import { createStarfield } from "./Starfield";

const MIN_DISTANCE = 1.35;
const MAX_DISTANCE = 12;
const HOME_DISTANCE = 3.6;
const AUTO_ROTATE_RESUME_MS = 4000;
const TRAIL_STEPS = 200;

/** NORAD ids that get permanent on-globe labels. */
const LABELLED: Array<{ id: number; text: string }> = [
  { id: 25544, text: "ISS" },
  { id: 48274, text: "TIANGONG" },
];

/**
 * Hero 3D view. Owns the renderer/scene/camera and wires the runtime
 * (position stream, selection, trails) into them. All per-frame work is
 * imperative; React is only involved for mount/unmount.
 */
export function Globe() {
  const runtime = useRuntime();
  const containerRef = useRef<HTMLDivElement>(null);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    runtime.init();
    const { store, clock } = runtime;
    const stream = runtime.stream;
    const client = runtime.client;
    if (!stream || !client) return;

    let renderer: WebGLRenderer;
    try {
      renderer = new WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" });
    } catch {
      queueMicrotask(() => setFailed(true));
      return;
    }

    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    renderer.setPixelRatio(pixelRatio);
    renderer.setClearColor(0x03050a, 1);
    renderer.toneMapping = ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    const canvas = renderer.domElement;
    canvas.className = "block h-full w-full touch-none outline-none";
    canvas.dataset.testid = "globe-canvas";
    container.appendChild(canvas);

    const scene = new Scene();
    const camera = new PerspectiveCamera(42, 1, 0.05, 400);
    camera.position.set(0, 1.2, 9);

    const controls = new OrbitControls(camera, canvas);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.enablePan = false;
    controls.minDistance = MIN_DISTANCE;
    controls.maxDistance = MAX_DISTANCE;
    controls.rotateSpeed = 0.5;
    controls.zoomSpeed = 0.7;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.35;

    const rig = new CameraRig(camera, controls);

    const earth = createEarth(renderer);
    const atmosphere = createAtmosphere();
    const stars = createStarfield();
    const points = createSatellitePoints();
    const trail = createOrbitTrail();
    stars.setPixelRatio(pixelRatio);
    points.setPixelRatio(pixelRatio);
    scene.add(stars.object, earth.object, trail.object, points.object, atmosphere.object);

    const labelLayer = new LabelLayer(container);
    const labelHandles = LABELLED.map((l) => ({ ...l, handle: labelLayer.create(`sat-${l.id}`), index: -1 }));
    const hoverLabel = labelLayer.create("hover", "hover");

    const updateSun = () => {
      const dir = sunDirectionEcef(new Date(clock.now()));
      earth.setSunDirection(dir);
      atmosphere.setSunDirection(dir);
    };
    updateSun();
    const sunTimer = window.setInterval(updateSun, 5_000);

    let width = 1;
    let height = 1;
    const resize = () => {
      width = container.clientWidth;
      height = container.clientHeight;
      if (width === 0 || height === 0) return;
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.fov = width / height < 0.8 ? 52 : 42;
      camera.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(container);
    resize();

    // ---- catalog changes ----------------------------------------------------
    let boundCatalog: ReturnType<typeof store.get>["catalog"] = null;
    const bindCatalog = () => {
      const catalog = store.get().catalog;
      if (!catalog || catalog === boundCatalog) return;
      boundCatalog = catalog;
      points.setKinds(catalog.kinds);
      for (const l of labelHandles) l.index = catalog.ids.indexOf(l.id);
    };
    bindCatalog();

    // ---- interaction ----------------------------------------------------------
    const tmp = { x: 0, y: 0, z: 0 };
    const pick = (clientX: number, clientY: number, radius: number): number | null => {
      const catalog = store.get().catalog;
      if (!catalog) return null;
      camera.updateMatrixWorld();
      return pickNearest(stream, camera, catalog.kinds, clientX, clientY, canvas.getBoundingClientRect(), radius);
    };

    let pendingMove: { x: number; y: number } | null = null;
    const onPointerMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse" || e.buttons !== 0) return;
      pendingMove = { x: e.clientX, y: e.clientY };
    };
    const onPointerLeave = () => {
      pendingMove = null;
      store.set({ hovered: null });
    };

    let downAt: { x: number; y: number } | null = null;
    const onPointerDown = (e: PointerEvent) => {
      downAt = { x: e.clientX, y: e.clientY };
    };
    const onPointerUp = (e: PointerEvent) => {
      if (!downAt) return;
      const moved = Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y);
      downAt = null;
      if (moved > 5) return;
      const hit = pick(e.clientX, e.clientY, e.pointerType === "mouse" ? 14 : 26);
      store.set({ selected: hit, info: hit === null ? null : store.get().info });
    };
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerleave", onPointerLeave);
    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointerup", onPointerUp);

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") store.set({ selected: null, info: null });
    };
    window.addEventListener("keydown", onKey);

    // Pause auto-rotate while interacting; resume after idle.
    let resumeTimer: number | undefined;
    const onStart = () => {
      controls.autoRotate = false;
      rig.cancel();
      window.clearTimeout(resumeTimer);
    };
    const onEnd = () => {
      window.clearTimeout(resumeTimer);
      if (store.get().selected !== null) return;
      resumeTimer = window.setTimeout(() => {
        controls.autoRotate = true;
      }, AUTO_ROTATE_RESUME_MS);
    };
    controls.addEventListener("start", onStart);
    controls.addEventListener("end", onEnd);

    // ---- selection side effects: fly-to, info polling, trail --------------------
    let lastSelected: number | null = null;
    let trailKey = "";
    let trailCenter = 0;
    let disposed = false;

    const refreshTrail = () => {
      const { selected, showTrail, catalog } = store.get();
      if (selected === null || !showTrail || !catalog) {
        trailKey = "";
        trail.setPositions(new Float32Array(0));
        return;
      }
      const now = clock.now();
      const periodMin = 1440 / catalog.gps[selected][3];
      const span = Math.min(periodMin, 220) * 60_000;
      const key = `${selected}:${clock.epoch}`;
      const stale = key !== trailKey || Math.abs(now - trailCenter) > span * 0.2;
      if (!stale) return;
      trailKey = key;
      trailCenter = now;
      const wanted = selected;
      void client
        .call("trail", { index: selected, startMs: now - span / 2, spanMs: span, steps: TRAIL_STEPS })
        .then(({ positions }) => {
          if (!disposed && store.get().selected === wanted && trailKey === key) trail.setPositions(positions);
        })
        .catch(() => undefined);
    };

    const pollInfo = () => {
      const { selected } = store.get();
      if (selected === null) return;
      void client
        .call("inspect", { index: selected, timeMs: clock.now() })
        .then(({ info }) => {
          if (!disposed && store.get().selected === selected) store.set({ info });
        })
        .catch(() => undefined);
    };

    const onStore = () => {
      const s = store.get();
      bindCatalog();
      if (s.selected !== lastSelected) {
        lastSelected = s.selected;
        trailKey = "";
        trail.setPositions(new Float32Array(0));
        if (s.selected !== null) {
          controls.autoRotate = false;
          window.clearTimeout(resumeTimer);
          stream.positionAt(s.selected, stream.alpha(), tmp);
          const dist = Math.min(Math.max(camera.position.length(), 2.3), HOME_DISTANCE);
          rig.flyTo(new Vector3(tmp.x, tmp.y, tmp.z), dist, new Vector3(), 1400);
          pollInfo();
        } else {
          resumeTimer = window.setTimeout(() => {
            controls.autoRotate = true;
          }, AUTO_ROTATE_RESUME_MS);
        }
      }
      refreshTrail();
    };
    const unsubscribe = store.subscribe(onStore);
    const infoTimer = window.setInterval(pollInfo, 500);
    const trailTimer = window.setInterval(refreshTrail, 1000);

    // ---- frame loop -------------------------------------------------------------
    let raf = 0;
    const t0 = performance.now();
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      stars.update((now - t0) / 1000);
      rig.update(now);
      controls.update();
      camera.updateMatrixWorld();

      const s = store.get();

      if (pendingMove) {
        const hit = pick(pendingMove.x, pendingMove.y, 14);
        pendingMove = null;
        if (hit !== s.hovered) store.set({ hovered: hit });
        canvas.style.cursor = hit === null ? "" : "pointer";
      }

      points.update(stream, s.selected, s.hovered);

      // Labels
      const alpha = stream.alpha();
      for (const l of labelHandles) {
        if (l.index < 0) {
          l.handle.place(null);
          continue;
        }
        stream.positionAt(l.index, alpha, tmp);
        l.handle.place(projectToScreen(camera, tmp.x, tmp.y, tmp.z, width, height), l.text);
      }
      if (s.hovered !== null && s.hovered !== s.selected && s.catalog) {
        stream.positionAt(s.hovered, alpha, tmp);
        hoverLabel.place(projectToScreen(camera, tmp.x, tmp.y, tmp.z, width, height), s.catalog.names[s.hovered]);
      } else {
        hoverLabel.place(null);
      }

      // Keep the selected object centred while following it.
      if (s.selected !== null && !rig.isFlying) {
        stream.positionAt(s.selected, alpha, tmp);
        const target = new Vector3(tmp.x, tmp.y, tmp.z).normalize();
        const dir = camera.position.clone().normalize();
        // Gentle pull of the camera's direction toward the object only when the user isn't dragging.
        if (!controls.autoRotate && downAt === null && dir.dot(target) < 0.995) {
          dir.lerp(target, 0.012).normalize();
          camera.position.copy(dir.multiplyScalar(camera.position.length()));
        }
      }

      renderer.render(scene, camera);
    };

    const onVisibility = () => {
      cancelAnimationFrame(raf);
      if (!document.hidden && !disposed) raf = requestAnimationFrame(frame);
    };
    document.addEventListener("visibilitychange", onVisibility);

    earth.ready
      .then(() => {
        if (disposed) return;
        setLoaded(true);
        const guessLon = -new Date().getTimezoneOffset() / 4;
        rig.flyTo(latLonToScene(28, guessLon), HOME_DISTANCE, new Vector3(), 3200);
      })
      .catch(() => {
        if (!disposed) setFailed(true);
      });

    raf = requestAnimationFrame(frame);

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      window.clearTimeout(resumeTimer);
      window.clearInterval(sunTimer);
      window.clearInterval(infoTimer);
      window.clearInterval(trailTimer);
      unsubscribe();
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("keydown", onKey);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerleave", onPointerLeave);
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointerup", onPointerUp);
      controls.removeEventListener("start", onStart);
      controls.removeEventListener("end", onEnd);
      controls.dispose();
      observer.disconnect();
      labelLayer.dispose();
      earth.dispose();
      atmosphere.dispose();
      stars.dispose();
      points.dispose();
      trail.dispose();
      renderer.dispose();
      canvas.remove();
    };
  }, [runtime]);

  return (
    <div className="absolute inset-0">
      <div
        ref={containerRef}
        className={`absolute inset-0 transition-opacity duration-1000 ${loaded ? "opacity-100" : "opacity-0"}`}
      />
      {failed && (
        <p className="absolute inset-0 grid place-items-center px-6 text-center font-mono text-xs text-[var(--muted)]">
          WebGL is unavailable in this browser. OVERHEAD needs it to draw the sky.
        </p>
      )}
    </div>
  );
}
