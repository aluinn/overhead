"use client";

import { useEffect, useRef, useState } from "react";
import {
  ACESFilmicToneMapping,
  PerspectiveCamera,
  Scene,
  Vector3,
  WebGLRenderer,
} from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { sunDirectionEcef } from "@/lib/orbital/sun";
import { CameraRig } from "@/lib/three/camera";
import { latLonToScene } from "@/lib/three/coords";
import { createAtmosphere } from "./Atmosphere";
import { createEarth } from "./Earth";
import { createStarfield } from "./Starfield";

const MIN_DISTANCE = 1.35;
const MAX_DISTANCE = 12;
const HOME_DISTANCE = 3.6;
const AUTO_ROTATE_RESUME_MS = 4000;

/**
 * Hero 3D view. Owns the renderer, scene and camera; everything else
 * (satellite points, trails, selection) is added to this scene in later stages.
 */
export function Globe() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

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
    container.appendChild(renderer.domElement);
    renderer.domElement.className = "block h-full w-full touch-none outline-none";
    renderer.domElement.dataset.testid = "globe-canvas";

    const scene = new Scene();
    const camera = new PerspectiveCamera(42, 1, 0.05, 400);
    // Start far out and looking at the night side of Europe, then fly in.
    camera.position.set(0, 1.2, 9);

    const controls = new OrbitControls(camera, renderer.domElement);
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
    stars.setPixelRatio(pixelRatio);
    scene.add(stars.object, earth.object, atmosphere.object);

    const updateSun = () => {
      const dir = sunDirectionEcef(new Date());
      earth.setSunDirection(dir);
      atmosphere.setSunDirection(dir);
    };
    updateSun();
    const sunTimer = window.setInterval(updateSun, 30_000);

    const resize = () => {
      const { clientWidth: w, clientHeight: h } = container;
      if (w === 0 || h === 0) return;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      // Keep the globe comfortably framed on tall (mobile) screens.
      camera.fov = w / h < 0.8 ? 52 : 42;
      camera.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(container);
    resize();

    // Pause auto-rotate while the user is interacting; resume after a pause.
    let resumeTimer: number | undefined;
    const onStart = () => {
      controls.autoRotate = false;
      rig.cancel();
      window.clearTimeout(resumeTimer);
    };
    const onEnd = () => {
      window.clearTimeout(resumeTimer);
      resumeTimer = window.setTimeout(() => {
        controls.autoRotate = true;
      }, AUTO_ROTATE_RESUME_MS);
    };
    controls.addEventListener("start", onStart);
    controls.addEventListener("end", onEnd);

    let raf = 0;
    let disposed = false;
    const t0 = performance.now();
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      stars.update((now - t0) / 1000);
      rig.update(now);
      controls.update();
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
        // Opening shot: swoop in over the user's longitude (best guess from timezone offset).
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
      document.removeEventListener("visibilitychange", onVisibility);
      controls.removeEventListener("start", onStart);
      controls.removeEventListener("end", onEnd);
      controls.dispose();
      observer.disconnect();
      earth.dispose();
      atmosphere.dispose();
      stars.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

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
