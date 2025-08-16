import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";


// Espresso Logo
import EspressoLogo from "./assets/logo/logo.png";


// icons
import { TfiTimer } from "react-icons/tfi";

//sides
import rightSide from "./assets/sides/side1.png";
import leftSide from "./assets/sides/side2.png";
import backSide from "./assets/sides/side3.png";
import bottomSide from "./assets/sides/side4.png";
import topSide from "./assets/sides/side5.png";
import frontSide from "./assets/sides/side6.png";

const textureLoader = new THREE.TextureLoader();

const rightSideImage = textureLoader.load(rightSide);
const leftSideImagge = textureLoader.load(leftSide);
const backSideImage = textureLoader.load(backSide);
const bottomSideImage = textureLoader.load(bottomSide);
const topSideImage = textureLoader.load(topSide);
const frontSideImage = textureLoader.load(frontSide);

const C = {
  U: topSideImage, 
  D: bottomSideImage, 
  L: leftSideImagge, 
  R: rightSideImage, 
  F: frontSideImage, 
  B: backSideImage, 
  H: 0x111111, 
};

const MAP = {
  U: { axis: "y", layer: 1, dir: +1 },
  D: { axis: "y", layer: -1, dir: -1 },
  L: { axis: "x", layer: -1, dir: -1 },
  R: { axis: "x", layer: 1, dir: +1 },
  F: { axis: "z", layer: 1, dir: +1 },
  B: { axis: "z", layer: -1, dir: -1 },
};

const RIGHT_ANGLE = Math.PI / 2;
const ease = (k) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);

export default function RubiksCube() {
  const mountRef = useRef(null);
  const state = useRef({
    scene: null,
    renderer: null,
    camera: null,
    controls: null,
    cubeGroup: null,
    cubies: [],
    animId: 0,
    rotating: false,
    lastMove: null,
  });

  const [history, setHistory] = useState([]); // Store move history ex: ["R", "L", "B" etc]
  const [running, setRunning] = useState(false);
  const [ms, setMs] = useState(0);
  const tRef = useRef({ start: 0, raf: 0 });
  const [status, setStatus] = useState("Ready");
  const doMoveRef = useRef(null);
  /* ---------------- Timer helpers ---------------- */
  const startTimer = () => {
    if (running) return;

    setRunning(true);
    tRef.current.start = performance.now();

    const tick = () => {
      if (!tRef.current.start) return;
      const elapsed = performance.now() - tRef.current.start;
      setMs(elapsed);
      tRef.current.raf = requestAnimationFrame(tick);
    };

    tRef.current.raf = requestAnimationFrame(tick);
  };
  const stopTimer = () => {
    if (!running) return;
    setRunning(false);
    cancelAnimationFrame(tRef.current.raf);
  };
  const resetTimer = () => {
    if (tRef.current.raf) {
      cancelAnimationFrame(tRef.current.raf);
      tRef.current.raf = null;
    }

    tRef.current.start = 0;

    // reset states
    setRunning(false);
    setMs(0);
  };
  useEffect(() => {
    doMoveRef.current = doMove;
  });


  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    while (mount.firstChild) mount.removeChild(mount.firstChild);

    const w = mount.clientWidth;
    const h = mount.clientHeight;

    // Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x270903);

    // Camera
    const camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 1000);
    camera.position.set(5.5, 6.5, 7.5);

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.setSize(w, h);
    mount.appendChild(renderer.domElement);

    // Lights
    scene.add(new THREE.AmbientLight(0xffffff, 0.9));
    const dir = new THREE.DirectionalLight(0xffffff, 0.6);
    dir.position.set(5, 10, 7);
    scene.add(dir);

    // Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.target.set(0, 0, 0);
    controls.minDistance = 4;
    controls.maxDistance = 20;

    // Cube group + cubies
    const cubeGroup = new THREE.Group();
    scene.add(cubeGroup);
    const cubies = buildCubies(cubeGroup);

    Object.assign(state.current, {
      scene,
      renderer,
      camera,
      controls,
      cubeGroup,
      cubies,
    });

    // Render loop
    const loop = () => {
      controls.update();
      renderer.render(scene, camera);
      state.current.animId = requestAnimationFrame(loop);
    };
    loop();

    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const cr = entry.contentRect;
        camera.aspect = cr.width / cr.height;
        camera.updateProjectionMatrix();
        renderer.setSize(cr.width, cr.height);
      }
    });
    ro.observe(mount);

    // Handle keyboard controls
    const onKeyDown = (e) => {
      if (state.current.rotating) return;
      const k = e.key.toUpperCase();

      if (MAP[k]) {
        const prime = e.shiftKey;
        doMoveRef.current?.(k, prime ? -1 : +1, true);
        state.current.lastMove = {
          k,
          dir: prime ? -1 : +1,
          time: performance.now(),
        };
        return;
      }

      if ((e.key === "2" || e.code === "Digit2") && state.current.lastMove) {
        const { k: lk, dir, time } = state.current.lastMove;
        if (performance.now() - time < 400) {
          doMoveRef.current?.(lk, dir, true, "double");
          state.current.lastMove = null;
        }
        return;
      }

      if ((e.key === "'" || e.key === "’") && state.current.lastMove) {
        const { k: lk, dir, time } = state.current.lastMove;
        if (performance.now() - time < 400) {
          doMoveRef.current?.(lk, -dir, true);
          state.current.lastMove = null;
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      cancelAnimationFrame(state.current.animId);
      window.removeEventListener("keydown", onKeyDown);

      ro.disconnect();
      disposeCubies(state.current.cubies);
      controls.dispose();

      if (renderer) {
        renderer.dispose();
        while (mount.firstChild) mount.removeChild(mount.firstChild);
      }

      // reset refs
      state.current.scene = null;
      state.current.renderer = null;
      state.current.camera = null;
      state.current.controls = null;
      state.current.cubies = [];
      stopTimer();
    };
  }, []);

 // Handle moves logic
  const doMove = async (
    faceKey,
    dir = +1,
    record = true,
    special = null,
    manual = true
  ) => {
    // Start timer on first manual move
    if (manual && !running) {
      startTimer();
      // resetTimer();
    }

    const { cubeGroup, cubies } = state.current;
    const { axis, layer, dir: faceSign } = MAP[faceKey];

    const targets = pickLayer(cubies, axis, layer);
    const rotGroup = new THREE.Group();
    cubeGroup.add(rotGroup);

    targets.forEach((c) => rotGroup.attach(c.mesh));

    // Handle double moves
    const turns = special === "double" ? 2 : 1;
    state.current.rotating = true;

    const chain = async () => {
      for (let i = 0; i < turns; i++) {
        await rotateGroup(rotGroup, axis, RIGHT_ANGLE * dir * faceSign, 180);
      }
    };

    return chain().then(() => {
      // Bake back into main group and snap to grid
      targets.forEach((c) => {
        cubeGroup.attach(c.mesh);
        snap(c.mesh);
      });
      cubeGroup.remove(rotGroup);
      state.current.rotating = false;

      if (record) {
        const moveStr =
          special === "double"
            ? `${faceKey}2`
            : dir === -1
            ? `${faceKey}'`
            : faceKey;
        setHistory((h) => [...h, moveStr]);
        setStatus("In progress…");

        if (isSolved(state.current.cubies)) {
          stopTimer();
          setStatus("Solved! 🎉");
        }
      }
    });
  };

  // HUD Buttons Functions
  const handleScramble = async () => {
    setStatus("Scrambling…");

    stopTimer();
    resetTimer();

    setHistory([]);

    const seq = makeScramble(25);
    for (const s of seq) {
      await doMove(s.face, s.dir, false, s.double ? "double" : null, false); // False if manual move
    }

    setStatus("Scrambled. Start solving!");
  };

  const handleReset = async () => {
    setStatus("Resetting…");

    resetTimer(); // Call reset timer
    setHistory([]);

    disposeCubies(state.current.cubies);
    state.current.cubeGroup.clear();

    state.current.cubies = buildCubies(state.current.cubeGroup);

    setStatus("Ready");
  };

  const handleCheckerboard = async () => {
    setStatus("Checkerboarding…");

    stopTimer();
    resetTimer();

    setHistory([]);

    const checkerMoves = ["U", "D", "R", "L", "F", "B"];
    for (const f of checkerMoves) {
      await doMove(f, +1, false, "double", false); // manual = false
    }

    setStatus("Checkerboard pattern applied!");
  };

  // UI
  const mm = Math.floor(ms / 60000);
  const ss = Math.floor((ms % 60000) / 1000);
  const msDisp = Math.floor((ms % 1000) / 10)
    .toString()
    .padStart(2, "0");

  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        position: "relative",
        background: "#0a0a0a",
        overflow: "hidden",
      }}
    >
      <div ref={mountRef} style={{ width: "100%", height: "100%" }} />

      {/* HUD */}
      <div
        style={{
          position: "absolute",
          top: 12,
          left: 12,
          display: "flex",
          gap: 12,
          flexWrap: "wrap",
          alignItems: "center",
          background: "rgba(0,0,0,0.35)",
          padding: "12px 14px",
          borderRadius: 12,
          backdropFilter: "blur(4px)",
          userSelect: "none",
        }}
      >
        <button onClick={handleScramble} style={btnStyle}>
          Scramble
        </button>
        <button onClick={handleReset} style={btnStyle}>
          Reset
        </button>
        <button onClick={handleCheckerboard} style={btnStyle}>
          Checkerboard
        </button>
        <span
          className="flex gap-1 justify-center items-center"
          style={{ color: "white", fontFamily: "ui-monospace, monospace" }}
        >
          <TfiTimer size={20} /> {String(mm).padStart(2, "0")}:
          {String(ss).padStart(2, "0")}.{msDisp}
        </span>
        <span style={{ color: "#B67237" }}>{status}</span>
      </div>
      <div
        style={{
          position: "absolute",
          top: 12,
          right: 12,
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          userSelect: "none",
        }}
      >
        <img src={EspressoLogo} alt="" className="w-18" />
      </div>
      {/* Move history */}
      <div
        style={{
          position: "absolute",
          bottom: 12,
          left: 12,
          right: 12,
          maxHeight: 120,
          overflowY: "auto",
          background: "rgba(0,0,0,0.3)",
          padding: 10,
          borderRadius: 10,
          color: "white",
          fontFamily: "ui-monospace, monospace",
          fontSize: 14,
        }}
      >
        <strong style={{ opacity: 0.9 }}>Moves:</strong>{" "}
        {history.length ? (
          history.join(" ")
        ) : (
          <em style={{ opacity: 0.6 }}>—</em>
        )}
        <div style={{ marginTop: 6, opacity: 0.7 }}>
          Keys: <code>U D L R F B</code>, hold <code>Shift</code> for prime,
          press <code>2</code> right after a move for doubles.
        </div>
      </div>
    </div>
  );
}


function buildCubies(parent) {
  const cubies = [];
  const size = 0.95;
  const geo = new THREE.BoxGeometry(size, size, size);

  // material cache
  const cache = new Map();
  const mat = (value) => {
    if (!cache.has(value)) {
      if (value instanceof THREE.Texture) {
        cache.set(
          value,
          new THREE.MeshBasicMaterial({
            map: value
          })
        );
      } else {
        cache.set(
          value,
          new THREE.MeshStandardMaterial({
            color: value, // Image
            roughness: 20,
            metalness: 20,
          })
        );
      }
    }
    return cache.get(value);
  };
  const hidden = mat(C.H);

  // create 27 cubies at -1,0,1
  for (let x = -1; x <= 1; x++) {
    for (let y = -1; y <= 1; y++) {
      for (let z = -1; z <= 1; z++) {
        const mats = new Array(6).fill(hidden);
        // BoxGeometry group order: +x, -x, +y, -y, +z, -z
        if (x === 1) mats[0] = mat(C.R);
        if (x === -1) mats[1] = mat(C.L);
        if (y === 1) mats[2] = mat(C.U);
        if (y === -1) mats[3] = mat(C.D);
        if (z === 1) mats[4] = mat(C.F);
        if (z === -1) mats[5] = mat(C.B);

        const mesh = new THREE.Mesh(geo, mats);
        mesh.position.set(x, y, z);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        parent.add(mesh);
        cubies.push({ mesh });
      }
    }
  }
  return cubies;
}

function disposeCubies(cubies) {
  if (!cubies) return;
  const disposed = new Set();
  cubies.forEach(({ mesh }) => {
    if (mesh.geometry && !disposed.has(mesh.geometry)) {
      disposed.add(mesh.geometry);
      mesh.geometry.dispose();
    }
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    mats.forEach((m) => {
      if (m && !disposed.has(m)) {
        disposed.add(m);
        m.dispose?.();
      }
    });
  });
}

function pickLayer(cubies, axis, layer) {
  const eps = 0.001;
  return cubies.filter(
    ({ mesh }) => Math.abs(mesh.position[axis] - layer) < 1 - eps
  );
}

function rotateGroup(group, axis, angle, duration = 200) {
  return new Promise((resolve) => {
    const start = performance.now();
    const from = group.rotation[axis];
    const to = from + angle;
    const step = (t) => {
      const k = Math.min(1, (t - start) / duration);
      group.rotation[axis] = from + (to - from) * ease(k);
      if (k < 1) requestAnimationFrame(step);
      else {
        group.rotation[axis] =
          Math.round(group.rotation[axis] / RIGHT_ANGLE) * RIGHT_ANGLE;
        resolve();
      }
    };
    requestAnimationFrame(step);
  });
}

function snap(mesh) {
  const r = (v, s = 1) => Math.round(v / s) * s;
  mesh.position.set(r(mesh.position.x), r(mesh.position.y), r(mesh.position.z));
  mesh.rotation.set(
    Math.round(mesh.rotation.x / RIGHT_ANGLE) * RIGHT_ANGLE,
    Math.round(mesh.rotation.y / RIGHT_ANGLE) * RIGHT_ANGLE,
    Math.round(mesh.rotation.z / RIGHT_ANGLE) * RIGHT_ANGLE
  );
}


// Handle Scramble Logic
function makeScramble(n = 25) {
  const faces = Object.keys(MAP);
  const seq = [];
  let last = null;
  for (let i = 0; i < n; i++) {
    let f;
    do f = faces[(Math.random() * faces.length) | 0];
    while (f === last);
    last = f;
    const dir = Math.random() < 0.5 ? +1 : -1;
    const double = Math.random() < 0.33;
    seq.push({ face: f, dir, double });
  }
  return seq;
}

// Solved detection: each outward face must be a single image
function isSolved(cubies) {
  const faces = [
    { axis: "x", sign: +1, color: C.R, world: new THREE.Vector3(1, 0, 0) },
    { axis: "x", sign: -1, color: C.L, world: new THREE.Vector3(-1, 0, 0) },
    { axis: "y", sign: +1, color: C.U, world: new THREE.Vector3(0, 1, 0) },
    { axis: "y", sign: -1, color: C.D, world: new THREE.Vector3(0, -1, 0) },
    { axis: "z", sign: +1, color: C.F, world: new THREE.Vector3(0, 0, 1) },
    { axis: "z", sign: -1, color: C.B, world: new THREE.Vector3(0, 0, -1) },
  ];

  const localDirs = [
    new THREE.Vector3(1, 0, 0),
    new THREE.Vector3(-1, 0, 0),
    new THREE.Vector3(0, 1, 0),
    new THREE.Vector3(0, -1, 0),
    new THREE.Vector3(0, 0, 1),
    new THREE.Vector3(0, 0, -1),
  ];

  const tmp = new THREE.Vector3();

  for (const f of faces) {
    const layer = cubies.filter(
      ({ mesh }) => Math.round(mesh.position[f.axis]) === f.sign
    );
    const colors = [];

    for (const { mesh } of layer) {
      let bestIdx = 0;
      let bestDot = -Infinity;
      for (let i = 0; i < 6; i++) {
        tmp.copy(localDirs[i]).applyQuaternion(mesh.quaternion);
        const d = tmp.dot(f.world);
        if (d > bestDot) {
          bestDot = d;
          bestIdx = i;
        }
      }
      const mats = Array.isArray(mesh.material)
        ? mesh.material
        : [mesh.material];
      const col = mats[bestIdx]?.color?.getHex();
      colors.push(col);
    }

    if (!colors.every((c) => c === f.color)) return false;
  }
  return true;
}

// Buttons Style
const btnStyle = {
  background: "#B67237",
  color: "white",
  border: "none",
  padding: "8px 12px",
  borderRadius: 8,
  cursor: "pointer",
  fontWeight: 600,
};
