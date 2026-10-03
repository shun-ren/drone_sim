import * as T from 'three';
import { START, DEST, FINISH, GATES, TARGETS, OBSTACLES } from './sim.mjs';
// This renderer consumes simulation state only. No physics or evaluator writes occur here.
export class FlightScene {
  constructor(container, { design = false, reduced = false } = {}) {
    this.container = container;
    this.design = design;
    this.reduced = reduced;
    this.mode = '';
    this.orbit = 0;
    this.renderer = new T.WebGLRenderer({
      antialias: !reduced,
      alpha: false,
      preserveDrawingBuffer: true,
    });
    this.renderer.setPixelRatio(
      Math.min(window.devicePixelRatio, reduced ? 1 : 1.7),
    );
    this.renderer.shadowMap.enabled = !reduced;
    this.renderer.shadowMap.type = T.PCFSoftShadowMap;
    this.renderer.outputColorSpace = T.SRGBColorSpace;
    this.renderer.toneMapping = T.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.renderer.domElement.setAttribute(
      'aria-label',
      '3D drone training field',
    );
    this.renderer.domElement.setAttribute('role', 'img');
    container.appendChild(this.renderer.domElement);
    this.scene = new T.Scene();
    this.scene.background = new T.Color('#b9e8ff');
    this.scene.fog = new T.Fog('#b9e8ff', 80, 260);
    this.camera = new T.PerspectiveCamera(55, 1, 0.04, 600);
    this.camera.up.set(0, 0, 1);
    this.camera.position.set(START[0] - 7, START[1] - 9, 7);
    this.ambient = new T.HemisphereLight(0xdcecf3, 0xa97689, 2.1);
    this.ambient.position.set(0, 0, 100);
    this.scene.add(this.ambient);
    this.sun = new T.DirectionalLight(0xfff0e8, 3);
    this.sun.position.set(-50, -80, 120);
    this.sun.castShadow = !reduced;
    this.sun.shadow.mapSize.set(2048, 2048);
    Object.assign(this.sun.shadow.camera, {
      left: -110,
      right: 110,
      top: 110,
      bottom: -110,
      near: 1,
      far: 300,
    });
    this.sun.shadow.bias = -0.0004;
    this.scene.add(this.sun);
    this.materials = {
      grass: new T.MeshStandardMaterial({ color: 0xffbdac, roughness: 1 }),
      concrete: new T.MeshStandardMaterial({ color: 0xfff1dc, roughness: 0.9 }),
      road: new T.MeshStandardMaterial({ color: 0xb67abb }),
      building: new T.MeshStandardMaterial({ color: 0xffdfb0, roughness: 0.8 }),
      roof: new T.MeshStandardMaterial({
        color: 0xf36fa5,
        metalness: 0.2,
        roughness: 0.8,
      }),
      gate: new T.MeshStandardMaterial({
        color: 0xffd54f,
        emissive: 0x6d3500,
        emissiveIntensity: 0.15,
      }),
      accent: new T.MeshStandardMaterial({
        color: 0x59dbef,
        emissive: 0x167c92,
        emissiveIntensity: 0.25,
      }),
      drone: new T.MeshStandardMaterial({
        color: 0xff567b,
        roughness: 0.4,
        metalness: 0.25,
      }),
      dark: new T.MeshStandardMaterial({
        color: 0x422c56,
        roughness: 0.4,
        metalness: 0.5,
      }),
    };
    this.props = [];
    this.gateMeshes = [];
    this.targetMeshes = [];
    this.buildWorld();
    this.drone = this.buildDrone();
    this.scene.add(this.drone);
    this.marker = new T.Mesh(
      new T.TorusGeometry(0.8, 0.035, 8, 48),
      this.materials.accent,
    );
    this.marker.rotation.x = Math.PI / 2;
    this.scene.add(this.marker);
    this.targetLine = new T.Line(
      new T.BufferGeometry().setFromPoints([new T.Vector3(), new T.Vector3()]),
      new T.LineDashedMaterial({
        color: 0x68dff0,
        dashSize: 0.7,
        gapSize: 0.45,
        transparent: true,
        opacity: 0.55,
      }),
    );
    this.scene.add(this.targetLine);
    this.sensorCamera = new T.PerspectiveCamera(60, 16 / 9, 0.05, 250);
    this.sensorCamera.up.set(0, 0, 1);
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.resize();
  }
  mesh(geometry, material, p, parent = this.scene) {
    const m = new T.Mesh(geometry, material);
    m.position.set(...p);
    m.castShadow = true;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  }
  box(size, p, mat, parent = this.scene) {
    return this.mesh(new T.BoxGeometry(...size), mat, p, parent);
  }
  label(text, p, size = 3, color = '#fff0e8') {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 96;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'rgba(57,36,63,0.84)';
    ctx.fillRect(0, 0, 512, 96);
    ctx.font = 'bold 36px monospace';
    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 256, 50);
    const texture = new T.CanvasTexture(canvas),
      s = new T.Sprite(new T.SpriteMaterial({ map: texture, depthTest: true }));
    s.position.set(...p);
    s.scale.set(size * 5.3, size, 1);
    this.scene.add(s);
    return s;
  }
  pad(p, text, color = 0xff6b96) {
    const mat = new T.MeshStandardMaterial({ color, roughness: 0.85 });
    this.mesh(
      new T.CylinderGeometry(2.4, 2.4, 0.1, 48).rotateX(Math.PI / 2),
      this.materials.concrete,
      [p[0], p[1], 0.02],
    );
    this.mesh(new T.RingGeometry(0.94, 1.03, 48), mat, [p[0], p[1], 0.083]);
    this.box([0.65, 0.08, 0.01], [p[0], p[1], 0.09], mat);
    this.box([0.08, 0.7, 0.01], [p[0] - 0.29, p[1], 0.09], mat);
    this.box([0.08, 0.7, 0.01], [p[0] + 0.29, p[1], 0.09], mat);
    this.label(text, [p[0], p[1] + 3, 1.4], 0.5);
  }
  buildWorld() {
    this.mesh(
      new T.PlaneGeometry(500, 500),
      this.materials.grass,
      [0, 0, -0.05],
    );
    const grid = new T.GridHelper(200, 40, 0xee9cbd, 0xdf90ad);
    grid.rotation.x = Math.PI / 2;
    grid.position.z = 0.004;
    grid.material.transparent = true;
    grid.material.opacity = 0.18;
    this.scene.add(grid);
    this.grid = grid;
    this.box([200, 5, 0.02], [0, -35, -0.01], this.materials.road);
    this.box([5, 105, 0.02], [-50, 12.5, -0.005], this.materials.road);
    this.box([125, 5, 0.02], [12.5, 57, 0], this.materials.road);
    for (let x = -90; x < 100; x += 6)
      this.box([2.6, 0.07, 0.01], [x, -35, 0.009], this.materials.concrete);
    const boundary = new T.LineLoop(
      new T.BufferGeometry().setFromPoints(
        [
          [-100, -100, 0.1],
          [100, -100, 0.1],
          [100, 100, 0.1],
          [-100, 100, 0.1],
        ].map((v) => new T.Vector3(...v)),
      ),
      new T.LineDashedMaterial({ color: 0xfff1dc, dashSize: 2, gapSize: 2 }),
    );
    boundary.computeLineDistances();
    this.scene.add(boundary);
    this.pad(START, 'A / LAUNCH');
    this.pad(DEST, 'B / DELIVERY', 0xf5bd75);
    this.pad(FINISH, 'C / FINISH', 0x8bd7f5);
    for (const b of OBSTACLES) {
      const size = b.max.map((v, i) => v - b.min[i]),
        p = b.min.map((v, i) => (v + b.max[i]) / 2);
      this.box(size, p, this.materials.building);
      this.box(
        [size[0] + 0.5, size[1] + 0.5, 0.4],
        [p[0], p[1], b.max[2]],
        this.materials.roof,
      );
      const windows = new T.MeshStandardMaterial({
        color: 0x587c86,
        metalness: 0.6,
        roughness: 0.3,
      });
      for (let z = 2; z < b.max[2] - 1; z += 3.3)
        for (let y = b.min[1] + 1.5; y < b.max[1] - 1; y += 3)
          this.box([0.04, 1.3, 1.5], [b.min[0] - 0.025, y, z], windows);
    }
    this.label('INSPECTION TOWER', [10, 40, 28], 1.2);
    this.label('LOGISTICS / A', [-69, -50, 11], 1.2);
    for (const gate of GATES) {
      const group = new T.Group();
      group.position.set(...gate.p);
      const ring = this.mesh(
        new T.TorusGeometry(gate.radius + 0.08, 0.08, 10, 56).rotateY(
          Math.PI / 2,
        ),
        this.materials.gate,
        [0, 0, 0],
        group,
      );
      const postH = Math.max(0, gate.p[2] - gate.radius);
      this.box(
        [0.12, 0.12, postH],
        [0, 0, -gate.radius - postH / 2],
        this.materials.dark,
        group,
      );
      this.scene.add(group);
      this.gateMeshes.push({ group, ring });
      this.label(
        String(gate.id).padStart(2, '0'),
        [gate.p[0], gate.p[1], gate.p[2] + 2.8],
        0.5,
      );
    }
    for (const target of TARGETS) {
      const mesh = this.mesh(
        new T.RingGeometry(0.28, 0.4, 24).rotateY(Math.PI / 2),
        new T.MeshBasicMaterial({ color: 0xffbd6b, side: T.DoubleSide }),
        [target.p[0] - 0.035, target.p[1], target.p[2]],
      );
      this.targetMeshes.push(mesh);
      this.label(
        target.id,
        [target.p[0] - 0.1, target.p[1], target.p[2] + 0.7],
        0.25,
      );
    }
    // Perimeter landscaping is outside the flight boundary; mission structures above own colliders.
    const treeMat = new T.MeshStandardMaterial({
        color: 0xa46cd3,
        roughness: 1,
      }),
      trunkMat = new T.MeshStandardMaterial({ color: 0x9c6a89 });
    for (let i = 0; i < 55; i++) {
      const side = i % 4,
        a = -120 + ((i * 37) % 240),
        p =
          side === 0
            ? [a, 112]
            : side === 1
              ? [112, a]
              : side === 2
                ? [a, -114]
                : [-115, a],
        h = 4 + (i % 5);
      this.mesh(
        new T.CylinderGeometry(0.22, 0.4, h * 0.5, 7).rotateX(Math.PI / 2),
        trunkMat,
        [...p, h * 0.25],
      );
      this.mesh(new T.ConeGeometry(2.7, h, 7).rotateX(Math.PI / 2), treeMat, [
        ...p,
        h * 0.8,
      ]);
    }
  }
  buildDrone() {
    const group = new T.Group(),
      m = this.materials;
    this.box([0.28, 0.2, 0.09], [0, 0, 0], m.drone, group);
    this.box([0.2, 0.16, 0.055], [-0.02, 0, 0.075], m.dark, group);
    this.box([0.045, 0.13, 0.025], [0.12, 0, 0.065], m.accent, group);
    const a = 0.26 / Math.SQRT2;
    for (const [i, p] of [
      [a, a],
      [a, -a],
      [-a, -a],
      [-a, a],
    ].entries()) {
      const arm = this.box(
        [0.28, 0.026, 0.03],
        [p[0] / 2, p[1] / 2, -0.015],
        m.dark,
        group,
      );
      arm.rotation.z = Math.atan2(p[1], p[0]);
      this.mesh(
        new T.CylinderGeometry(0.027, 0.027, 0.055, 12).rotateX(Math.PI / 2),
        m.dark,
        [...p, 0.025],
        group,
      );
      const rotor = new T.Group();
      rotor.position.set(...p, 0.062);
      this.box(
        [0.305, 0.019, 0.004],
        [0, 0, 0],
        new T.MeshStandardMaterial({
          color: i < 2 ? 0xff6b96 : 0x765792,
          transparent: true,
          opacity: 0.8,
        }),
        rotor,
      );
      this.mesh(
        new T.CircleGeometry(0.152, 32),
        new T.MeshBasicMaterial({
          color: 0xffd5e5,
          transparent: true,
          opacity: 0.06,
          side: T.DoubleSide,
        }),
        [0, 0, 0.005],
        rotor,
      );
      group.add(rotor);
      this.props.push(rotor);
    }
    this.mesh(
      new T.SphereGeometry(0.032, 12, 8),
      new T.MeshStandardMaterial({
        color: 0x1f3b45,
        metalness: 0.8,
        roughness: 0.1,
      }),
      [0.155, 0, -0.02],
      group,
    );
    for (const y of [-0.1, 0.1]) {
      this.box([0.22, 0.014, 0.018], [0, y, -0.14], m.dark, group);
      for (const x of [-0.08, 0.08])
        this.box([0.014, 0.014, 0.12], [x, y, -0.075], m.dark, group);
    }
    this.payload = this.box(
      [0.14, 0.14, 0.12],
      [-0.02, 0, -0.09],
      new T.MeshStandardMaterial({ color: 0xd59b59 }),
      group,
    );
    this.payload.visible = false;
    return group;
  }
  setStyle(mode) {
    if (mode === this.mode) return;
    this.mode = mode;
    const game = mode === 'game';
    this.scene.background.set(game ? 0x54ebf6 : 0xb8d8e4);
    this.scene.fog.color.copy(this.scene.background);
    this.materials.grass.color.set(game ? 0xf56bc6 : 0xaaa3b8);
    this.materials.building.color.set(game ? 0xff993d : 0xb7b9ae);
    this.materials.roof.color.set(game ? 0x168cc6 : 0x666078);
    this.materials.road.color.set(game ? 0x78b9ee : 0x626276);
    this.materials.concrete.color.set(game ? 0xffd2ec : 0xd1cbd8);
    this.materials.drone.color.set(game ? 0xffdf37 : 0xd4d7e2);
    this.materials.accent.color.set(game ? 0xff148e : 0x60ddf3);
    this.sun.intensity = game ? 3 : 2.3;
    this.grid.visible = game;
    this.targetLine.visible = game;
  }
  resize() {
    const w = this.container.clientWidth,
      h = this.container.clientHeight;
    if (!w || !h) return;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
  }
  draw(sim, delta = 0.016) {
    if (!sim) return;
    this.setStyle(sim.mode);
    const p = new T.Vector3(...sim.p);
    this.drone.position.copy(p);
    this.drone.quaternion.set(...sim.q);
    this.payload.visible = sim.payload > 0;
    const scale = sim.aircraft.frame?.arm / 0.26 || 1;
    this.drone.scale.setScalar(scale);
    for (let i = 0; i < 4; i++)
      this.props[i].rotation.z +=
        (sim.motors[i] || 0) * delta * 180 * (i % 2 ? -1 : 1);
    const waypoint = sim.waypoint();
    this.marker.position.set(...waypoint);
    this.marker.position.z = Math.max(0.3, this.marker.position.z);
    this.marker.visible = !this.design && sim.status !== 'completed';
    this.marker.rotation.z += delta * 0.3;
    this.targetLine.geometry.setFromPoints([p, new T.Vector3(...waypoint)]);
    this.targetLine.computeLineDistances();
    this.gateMeshes.forEach((g, i) => {
      g.ring.material =
        sim.spec.id === 'obstacle' && i < sim.gate
          ? this.materials.accent
          : this.materials.gate;
    });
    this.targetMeshes.forEach((m, i) =>
      m.material.color.set(
        sim.captures.some((c) => c.id === TARGETS[i].id) ? 0x59dbef : 0xffbd6b,
      ),
    );
    const q = new T.Quaternion(...sim.q),
      forward = new T.Vector3(1, 0, 0).applyQuaternion(q),
      sensor = new T.Vector3(
        Math.cos(sim.sensorPitch),
        0,
        Math.sin(sim.sensorPitch),
      ).applyQuaternion(q);
    this.sensorCamera.position.copy(p);
    this.sensorCamera.lookAt(p.clone().add(sensor));
    if (this.design) {
      this.drone.position.set(START[0], START[1], 1.2);
      this.drone.quaternion.setFromAxisAngle(
        new T.Vector3(0, 0, 1),
        performance.now() * 0.00015,
      );
      this.camera.position.set(START[0] + 1.1, START[1] - 1.2, 2);
      this.camera.lookAt(this.drone.position);
      this.marker.visible = false;
      this.targetLine.visible = false;
    } else if (sim.camera === 'fpv') {
      this.drone.visible = false;
      this.camera.position.copy(p.clone().addScaledVector(forward, 0.17));
      this.camera.lookAt(p.clone().addScaledVector(sensor, 10));
    } else if (sim.camera === 'ground') {
      this.drone.visible = true;
      this.camera.position.set(START[0] - 5, START[1] - 8, 1.8);
      this.camera.lookAt(p);
    } else {
      this.drone.visible = true;
      const yaw = new T.Euler().setFromQuaternion(q, 'ZYX').z + this.orbit;
      const offset = new T.Vector3(-7, -9, 5.2).applyAxisAngle(
        new T.Vector3(0, 0, 1),
        yaw,
      );
      const desired = p.clone().add(offset);
      desired.z = Math.max(2, desired.z);
      this.camera.position.lerp(desired, 1 - Math.exp(-5 * delta));
      this.camera.lookAt(p.clone().add(new T.Vector3(1, 0, 0.7)));
    }
    this.renderer.render(this.scene, this.camera);
  }
  photo(sim, capture) {
    const was = this.drone.visible;
    this.drone.visible = false;
    if (capture) {
      const p = new T.Vector3(...capture.p),
        q = new T.Quaternion(...capture.q),
        dir = new T.Vector3(
          Math.cos(capture.pitch),
          0,
          Math.sin(capture.pitch),
        ).applyQuaternion(q);
      this.sensorCamera.position.copy(p);
      this.sensorCamera.lookAt(p.clone().add(dir));
    }
    this.renderer.render(this.scene, this.sensorCamera);
    const url = this.renderer.domElement.toDataURL('image/png');
    this.drone.visible = was;
    this.draw(sim, 0);
    return url;
  }
  dispose() {
    this.resizeObserver.disconnect();
    this.scene.traverse((o) => {
      o.geometry?.dispose();
      if (o.material) {
        for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
          m.map?.dispose();
          m.dispose();
        }
      }
    });
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
