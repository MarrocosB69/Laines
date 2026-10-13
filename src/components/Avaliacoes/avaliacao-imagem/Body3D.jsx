import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

/**
 * Body3D — corpo humano 3D procedural baseado em medidas reais.
 *
 * O torso é gerado via LatheGeometry: um perfil 2D (pescoço→ombro→peitoral→cintura→quadril)
 * girado 360° em torno do eixo Y, driven pelos valores reais de neck_cm / waist_cm / hip_cm
 * retornados pelo processador.  Quando as medidas não estão disponíveis, usa estimativas
 * baseadas em % de gordura e massa magra.
 */
export default function Body3D({
  percGordura = 20,
  massaMagra  = 60,
  estatura    = 170,
  sexo        = 'masculino',
  zoneColor   = '#22c55e',
  measurements = null,
  meshUrl      = null,   // GLB from SMPL-X fit — uses procedural geometry when null
}) {
  const mountRef = useRef(null);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const w = container.clientWidth  || 220;
    const h = container.clientHeight || 300;
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;

    // ── Renderer ──────────────────────────────────────────────────────────────
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    // ── Scene & Camera ────────────────────────────────────────────────────────
    const scene  = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(34, w / h, 0.1, 100);
    camera.position.set(0, 0.9, 10.2);
    camera.lookAt(0, 0.5, 0);

    // ── Lighting (physically-based look) ─────────────────────────────────────
    // Sky/ground hemisphere
    scene.add(new THREE.HemisphereLight(0xfff4e0, 0x8899cc, 0.55));
    // Key
    const key = new THREE.DirectionalLight(0xfff6ee, 1.05);
    key.position.set(3.5, 7, 5);
    scene.add(key);
    // Fill (cooler, left side)
    const fill = new THREE.DirectionalLight(0xaaccff, 0.30);
    fill.position.set(-4, 2, 3);
    scene.add(fill);
    // Rim (back glow)
    const rim = new THREE.DirectionalLight(0xffffff, 0.18);
    rim.position.set(0, 5, -7);
    scene.add(rim);

    // ── GLB (SMPL-X fitted mesh) branch ──────────────────────────────────────
    if (meshUrl) {
      let raf;
      const loader = new GLTFLoader();

      const ro = new ResizeObserver(() => {
        const nw = container.clientWidth;
        const nh = container.clientHeight;
        camera.aspect = nw / nh;
        camera.updateProjectionMatrix();
        renderer.setSize(nw, nh);
        if (reduceMotion) renderer.render(scene, camera);
      });
      ro.observe(container);

      let bodyGroup = null;
      const tick = () => {
        if (bodyGroup && !reduceMotion) bodyGroup.rotation.y += 0.008;
        renderer.render(scene, camera);
        if (!reduceMotion) raf = requestAnimationFrame(tick);
      };
      const onVis = () => {
        if (document.hidden) cancelAnimationFrame(raf);
        else tick();
      };
      document.addEventListener('visibilitychange', onVis);

      loader.load(
        meshUrl,
        (gltf) => {
          // Center and scale the SMPL-X mesh to fill the viewport
          const root = gltf.scene;
          const box  = new THREE.Box3().setFromObject(root);
          const size = box.getSize(new THREE.Vector3());
          const center = box.getCenter(new THREE.Vector3());

          const targetH = 4.2; // scene units — same as procedural body height
          const scale   = targetH / size.y;
          root.scale.setScalar(scale);
          // Re-center after scale
          root.position.sub(center.clone().multiplyScalar(scale));
          root.position.y += 0.3; // lift slightly above ground

          // Apply suit material tinted by zoneColor
          const zoneC = new THREE.Color(zoneColor);
          const suitC = new THREE.Color(0x7ab87a).lerp(zoneC, 0.3);
          const mat   = new THREE.MeshStandardMaterial({ color: suitC, roughness: 0.72 });
          root.traverse((child) => {
            if (child.isMesh) child.material = mat;
          });

          bodyGroup = root;
          scene.add(root);
          tick();
        },
        undefined,
        () => { /* GLB failed — fall back to blank scene, callouts still show */ tick(); },
      );

      return () => {
        cancelAnimationFrame(raf);
        document.removeEventListener('visibilitychange', onVis);
        ro.disconnect();
        scene.traverse((o) => {
          o.geometry?.dispose();
          if (o.material) {
            (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m.dispose());
          }
        });
        renderer.dispose();
        if (container.contains(renderer.domElement)) container.removeChild(renderer.domElement);
      };
    }

    // ── Body metrics ─────────────────────────────────────────────────────────
    const isMale  = sexo === 'masculino';
    const fatT    = Math.max(0, Math.min(1, (percGordura - 6) / 36));
    const muscleW = Math.max(0.85, 1 + (massaMagra - 55) / 200);

    // Unit system: 1 scene unit ≈ UNIT cm  (full body spans ~4.5 units)
    const UNIT = estatura / 4.5;
    const toR  = (cm) => (cm / (2 * Math.PI)) / UNIT;

    // Measurements → fall back to estimated values based on fat %
    const neck_cm  = measurements?.neck_cm  ?? (isMale ? 37 + fatT * 5  : 33 + fatT * 4);
    const waist_cm = measurements?.waist_cm ?? (isMale ? 79 + fatT * 32 : 70 + fatT * 28);
    const hip_cm   = measurements?.hip_cm   ?? (isMale
      ? waist_cm * (1.06 + fatT * 0.04)
      : waist_cm * (1.15 + fatT * 0.07));

    const neckR  = toR(neck_cm);
    const waistR = toR(waist_cm);
    const hipR   = toR(hip_cm);

    // Chest estimated (not measured) — males wider than hips, females slightly narrower
    const chestR    = hipR * (isMale ? 1.08 - fatT * 0.04 : 0.93 + fatT * 0.02);
    const shoulderR = chestR * (isMale ? 1.20 : 1.06) * muscleW;

    // ── Materials (MeshStandardMaterial = PBR) ────────────────────────────────
    const zoneC = new THREE.Color(zoneColor);
    const skinC = new THREE.Color(0xd09070);

    // Body suit color blends from lean-green toward zone color with fat
    const suitC = new THREE.Color(0x7ab87a).lerp(zoneC, 0.15 + fatT * 0.70);

    const mkM = (color, rough = 0.68, metal = 0.0) =>
      new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal });

    const matSuit  = mkM(suitC,  0.72);
    const matShade = mkM(suitC.clone().multiplyScalar(0.80), 0.80);
    const matSkin  = mkM(skinC,  0.62);

    // ── Body group ────────────────────────────────────────────────────────────
    const body = new THREE.Group();
    body.scale.y = Math.max(0.88, Math.min(1.14, estatura / 170));

    const addMesh = (geo, mat, x = 0, y = 0, z = 0, rx = 0, rz = 0) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z);
      if (rx) m.rotation.x = rx;
      if (rz) m.rotation.z = rz;
      body.add(m);
      return m;
    };

    // LatheGeometry helper: pts = [[radius, y], ...]
    const lathe = (pts, segs = 20) =>
      new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), segs);

    const sph = (r, ws = 16, hs = 12) => new THREE.SphereGeometry(r, ws, hs);

    // ── HEAD ─────────────────────────────────────────────────────────────────
    const headGeo = new THREE.SphereGeometry(0.305, 18, 14);
    headGeo.scale(1.0, 1.10, 0.92);
    addMesh(headGeo, matSkin, 0, 2.68);

    // Ears
    for (const s of [-1, 1]) addMesh(sph(0.065, 8, 6), matSkin, s * 0.31, 2.68);

    // ── NECK ─────────────────────────────────────────────────────────────────
    addMesh(
      lathe([
        [neckR * 1.05, 0.00],
        [neckR,        0.12],
        [neckR * 1.08, 0.26],
      ], 14),
      matSkin, 0, 2.36,
    );

    // ── TORSO — LatheGeometry with actual measurements ────────────────────────
    // Profile from hip (y=0) to shoulder junction (y=1.52)
    const torsoProfile = [
      [hipR   * 0.82,   0.00],  // hip base
      [hipR,            0.13],  // hip max
      [hipR   * 1.01,   0.22],  // upper hip
      [hipR   * 0.93,   0.31],  // taper to waist
      [waistR * 1.04,   0.40],
      [waistR,          0.48],  // WAIST minimum
      [waistR * 1.10,   0.58],
      [chestR * 0.86,   0.74],  // sub-chest
      [chestR,          0.94],  // pectoral max
      [chestR * 0.96,   1.08],  // upper chest
      [shoulderR * 0.82, 1.26], // shoulder taper
      [shoulderR * 0.68, 1.42],
      [shoulderR * 0.54, 1.52], // top of torso
    ];
    addMesh(lathe(torsoProfile, 24), matSuit, 0, 0.43);

    // Connector: fills the gap between torso top (y=1.95) and neck base (y=2.36)
    addMesh(
      lathe([
        [shoulderR * 0.50, 0.00],
        [neckR * 1.30,     0.41],
      ], 14),
      matSuit, 0, 1.95,
    );

    // ── SHOULDER CAPS ────────────────────────────────────────────────────────
    const shCapR = 0.175 * muscleW * (1 + fatT * 0.08);
    for (const s of [-1, 1]) {
      addMesh(sph(shCapR, 12, 8), matSuit, s * (shoulderR + shCapR * 0.45), 1.83);
    }

    // ── ARMS ─────────────────────────────────────────────────────────────────
    const armFat  = 1 + fatT * 0.20;
    const uArmR   = 0.130 * muscleW * armFat;
    const lArmR   = 0.108 * armFat;

    const upperArmPts = [
      [uArmR * 0.88, 0.00],
      [uArmR,        0.32],
      [uArmR * 0.96, 0.65],
      [uArmR * 0.85, 0.80],
    ];
    const lowerArmPts = [
      [lArmR * 0.72, 0.00],  // wrist
      [lArmR * 0.85, 0.18],
      [lArmR,        0.46],  // forearm max
      [lArmR * 0.92, 0.68],
      [lArmR * 0.88, 0.80],  // elbow
    ];

    for (const s of [-1, 1]) {
      const xBase = s * (shoulderR + shCapR * 0.8);
      const lean  = s * 0.15;

      // Upper arm (elbow→shoulder), pointing down
      const uaGeo = lathe(upperArmPts, 12);
      const ua    = new THREE.Mesh(uaGeo, matSuit);
      ua.rotation.z = s * 0.22;
      ua.rotation.x = 0.05;
      ua.position.set(xBase + lean * 0.3, 1.06, 0);
      body.add(ua);

      // Elbow joint
      addMesh(sph(lArmR * 0.95, 8, 6), matSuit, xBase + lean * 0.85, 1.04);

      // Lower arm (wrist→elbow), pointing down
      const laGeo = lathe(lowerArmPts, 12);
      const la    = new THREE.Mesh(laGeo, matSkin);
      la.rotation.z = s * 0.25;
      la.rotation.x = 0.06;
      la.position.set(xBase + lean * 1.45, 0.26, 0);
      body.add(la);

      // Hand
      addMesh(sph(0.088, 8, 6), matSkin, xBase + lean * 2.05, 0.10);
    }

    // ── LEGS ─────────────────────────────────────────────────────────────────
    const legFat  = 1 + fatT * 0.25;
    const thighR  = hipR * 0.50 * legFat;
    const calfR   = thighR * 0.60;
    const legGap  = hipR * 0.70;

    // Thigh: from knee (y=0) to hip (y=1.05)
    const thighPts = [
      [thighR * 0.82, 0.00],  // knee
      [thighR * 0.90, 0.22],
      [thighR,        0.55],  // max thigh
      [thighR * 0.96, 0.85],
      [thighR * 0.88, 1.05],  // hip junction
    ];
    // Calf: from ankle (y=0) to knee (y=0.98)
    const calfPts = [
      [calfR * 0.52, 0.00],  // ankle
      [calfR * 0.62, 0.12],
      [calfR,        0.42],  // calf max
      [calfR * 0.80, 0.70],
      [calfR * 0.88, 0.98],  // knee bottom
    ];

    for (const s of [-1, 1]) {
      const x = s * legGap;

      addMesh(lathe(thighPts, 14), matShade, x, -0.62);
      addMesh(sph(calfR * 0.96, 10, 8), matShade, x, -0.60);
      addMesh(lathe(calfPts, 14), matShade, x, -1.58);

      // Ankle
      addMesh(sph(calfR * 0.50, 8, 6), matSkin, x, -1.60);

      // Foot
      const foot = new THREE.Mesh(
        new THREE.BoxGeometry(calfR * 1.5, calfR * 0.60, calfR * 2.6),
        matSkin,
      );
      foot.position.set(x, -1.74, calfR * 0.65);
      body.add(foot);
    }

    body.position.y = -0.42;
    scene.add(body);

    // ── Ground disc ───────────────────────────────────────────────────────────
    const disc = new THREE.Mesh(
      new THREE.CircleGeometry(0.58, 36),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.07 }),
    );
    disc.rotation.x = -Math.PI / 2;
    disc.position.y  = -2.18;
    scene.add(disc);

    // ── Animate ───────────────────────────────────────────────────────────────
    let raf;
    const tick = () => {
      if (!reduceMotion) body.rotation.y += 0.008;
      renderer.render(scene, camera);
      if (!reduceMotion) raf = requestAnimationFrame(tick);
    };
    tick();

    const onVisibility = () => {
      if (document.hidden) { cancelAnimationFrame(raf); } else { tick(); }
    };
    document.addEventListener('visibilitychange', onVisibility);

    const ro = new ResizeObserver(() => {
      const nw = container.clientWidth;
      const nh = container.clientHeight;
      camera.aspect = nw / nh;
      camera.updateProjectionMatrix();
      renderer.setSize(nw, nh);
      if (reduceMotion) renderer.render(scene, camera);
    });
    ro.observe(container);

    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener('visibilitychange', onVisibility);
      ro.disconnect();
      scene.traverse((o) => {
        o.geometry?.dispose();
        if (o.material) {
          (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m.dispose());
        }
      });
      renderer.dispose();
      if (container.contains(renderer.domElement)) container.removeChild(renderer.domElement);
    };
  }, [percGordura, massaMagra, estatura, sexo, zoneColor, measurements, meshUrl]);

  return <div ref={mountRef} className="body3d-mount" />;
}
