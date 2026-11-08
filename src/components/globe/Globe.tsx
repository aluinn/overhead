"use client";

import { useEffect, useRef, useState } from "react";
import { ACESFilmicToneMapping, PerspectiveCamera, Scene, Vector3, WebGLRenderer } from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { footprintAngleDeg } from "@/lib/orbital/lookAngles";
import { sunDirectionEcef } from "@/lib/orbital/sun";
import { CameraRig } from "@/lib/three/camera";
import { latLonToScene } from "@/lib/three/coords";
import { pickNearest, projectToScreen } from "@/lib/three/picking";
import { MIN_ELEVATION_DEG, useRuntime } from "@/store/runtime";
import { createAtmosphere } from "./Atmosphere";
import { createEarth } from "./Earth";
import { LabelLayer } from "./labels";
import { createConnector } from "./Connector";
import { createObserverMarker } from "./ObserverMarker";
import { createOrbitTrail } from "./OrbitTrail";
import { createSatellitePoints } from "./SatellitePoints";
import { createStarfield } from "./Starfield";

const MIN_DISTANCE = 1.06;
const MAX_DISTANCE = 12;
const HOME_DISTANCE = 3.6;
const AUTO_ROTATE_RESUME_MS = 4000;
const TRAIL_STEPS = 200;
const MAX_TRAIN_LABELS = 5;
/** Start a close-approach replay this long before TCA so you watch the objects converge. */
const CONJUNCTION_LEAD_MS = 25_000;
const CONJUNCTION_TRAIL_MS = 24 * 60_000;
const CONJUNCTION_CAMERA_DISTANCE = 1.32;
const PAIR_COLOR_B = "#ff8a4c";
/** Typical Starlink shell altitude, used to size the on-ground horizon ring. */
const STARLINK_ALT_KM = 550;

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
    const marker = createObserverMarker();
    const trailA = createOrbitTrail("#38e1ff");
    const trailB = createOrbitTrail(PAIR_COLOR_B);
    const connector = createConnector();
    scene.add(stars.object, earth.object, trail.object, trailA.object, trailB.object, connector.object, marker.object, points.object, atmosphere.object);

    const labelLayer = new LabelLayer(container);
    const labelHandles = LABELLED.map((l) => ({ ...l, handle: labelLayer.create(`sat-${l.id}`), index: -1 }));
    const hoverLabel = labelLayer.create("hover", "hover");
    const pairLabel = labelLayer.create("pair", "hover");
    const trainLabels = Array.from({ length: MAX_TRAIN_LABELS }, (_, i) => labelLayer.create(`train-${i}`, "train"));

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

    // Flags (above-you / train members) and observer marker follow the store.
    let flaggedTick = -1;
    let flaggedTrains: Int16Array | null = null;
    let flaggedObserver: ReturnType<typeof store.get>["observer"] = null;
    const syncSky = () => {
      const s = store.get();
      if (s.observer !== flaggedObserver) {
        flaggedObserver = s.observer;
        marker.set(s.observer, footprintAngleDeg(STARLINK_ALT_KM, MIN_ELEVATION_DEG));
        if (s.observer) {
          controls.autoRotate = false;
          window.clearTimeout(resumeTimer);
          rig.flyTo(latLonToScene(s.observer.latDeg, s.observer.lonDeg), 2.7, new Vector3(), 2200);
        }
        flaggedTick = -1;
      }
      if (s.sky.tick !== flaggedTick || s.trainOf !== flaggedTrains) {
        flaggedTick = s.sky.tick;
        flaggedTrains = s.trainOf;
        const { visible } = s.sky;
        points.setFlags(s.observer ? visible.indices.subarray(0, visible.count) : null, s.trainOf, s.observer !== null);
      }
    };

    const onStore = () => {
      const s = store.get();
      bindCatalog();
      syncSky();
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
      syncConjunction();
    };

    // ---- close approach: time-travel, frame both objects, draw both paths -------------
    let shownConjunction: ReturnType<typeof store.get>["activeConjunction"] = null;
    const syncConjunction = () => {
      const c = store.get().activeConjunction;
      if (c === shownConjunction) return;
      shownConjunction = c;
      trailA.setPositions(new Float32Array(0));
      trailB.setPositions(new Float32Array(0));
      connector.set(false);
      if (!c) return;

      controls.autoRotate = false;
      window.clearTimeout(resumeTimer);
      clock.setSpeed(1);
      clock.seek(c.tcaMs - CONJUNCTION_LEAD_MS);

      void client
        .call("pairState", { indexA: c.indexA, indexB: c.indexB, timeMs: c.tcaMs })
        .then(({ state }) => {
          if (disposed || store.get().activeConjunction !== c || !state) return;
          const mid = new Vector3((state.a[0] + state.b[0]) / 2, (state.a[1] + state.b[1]) / 2, (state.a[2] + state.b[2]) / 2);
          rig.flyTo(mid, CONJUNCTION_CAMERA_DISTANCE, new Vector3(), 2400);
        })
        .catch(() => undefined);

      const startMs = c.tcaMs - CONJUNCTION_TRAIL_MS / 2;
      for (const [index, line] of [[c.indexA, trailA], [c.indexB, trailB]] as const) {
        void client
          .call("trail", { index, startMs, spanMs: CONJUNCTION_TRAIL_MS, steps: 160 })
          .then(({ positions }) => {
            if (!disposed && store.get().activeConjunction === c) line.setPositions(positions);
          })
          .catch(() => undefined);
      }
      connector.set(true);
    };
    syncSky();
    const unsubscribe = store.subscribe(onStore);
    const infoTimer = window.setInterval(pollInfo, 500);
    const trailTimer = window.setInterval(refreshTrail, 1000);

    // ---- frame loop -------------------------------------------------------------
    let raf = 0;
    const t0 = performance.now();
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      stars.update((now - t0) / 1000);
      marker.update((now - t0) / 1000);
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

      const pair = s.activeConjunction;
      points.update(stream, pair ? pair.indexA : s.selected, pair ? pair.indexB : s.hovered);

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
      for (let i = 0; i < trainLabels.length; i++) {
        const train = s.trains[i];
        if (!train) {
          trainLabels[i].place(null);
          continue;
        }
        stream.positionAt(train.members[train.members.length >> 1], alpha, tmp);
        trainLabels[i].place(projectToScreen(camera, tmp.x, tmp.y, tmp.z, width, height), `TRAIN ×${train.members.length}`);
      }
      if (pair) {
        stream.positionAt(pair.indexA, alpha, tmp);
        const ax = tmp.x, ay = tmp.y, az = tmp.z;
        stream.positionAt(pair.indexB, alpha, tmp);
        connector.update(ax, ay, az, tmp.x, tmp.y, tmp.z);
        const km = Math.hypot(ax - tmp.x, ay - tmp.y, az - tmp.z) * 6371;
        pairLabel.place(projectToScreen(camera, (ax + tmp.x) / 2, (ay + tmp.y) / 2, (az + tmp.z) / 2, width, height), `${km < 100 ? km.toFixed(1) : Math.round(km)} km`);
      } else {
        pairLabel.place(null);
      }
      if (s.hovered !== null && s.hovered !== s.selected && s.catalog && !pair) {
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
        if (store.get().observer) return; // a saved location already steered the camera
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
      trailA.dispose();
      trailB.dispose();
      connector.dispose();
      marker.dispose();
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
