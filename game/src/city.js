// city.js — builds Costa Verde: the road grid, buildings, park, beach,
// street props, and the road graph traffic drives on. Exports the collision
// boxes and the named places missions use.
import * as THREE from 'three';
import { CONFIG, mulberry32, pick } from './config.js';

// Make a canvas texture of lit windows on a coloured facade.
function facadeTexture(base, lit, rng) {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = base; g.fillRect(0, 0, 128, 256);
  for (let y = 8; y < 248; y += 22) {
    for (let x = 8; x < 120; x += 18) {
      g.fillStyle = rng() < 0.28 ? lit : '#1d2733';
      g.fillRect(x, y, 11, 14);
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Make a canvas texture for a road strip: asphalt, edge lines, centre dashes.
function roadTexture() {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#33363b'; g.fillRect(0, 0, 64, 256);
  g.fillStyle = '#e8e4d8'; g.fillRect(3, 0, 2, 256); g.fillRect(59, 0, 2, 256);
  g.fillStyle = '#d8c95a';
  for (let y = 0; y < 256; y += 64) g.fillRect(30, y + 8, 4, 32);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping; t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function buildCity(scene, seed = 7) {
  const rng = mulberry32(seed);
  const { BLOCK, ROAD, PITCH, GRID } = CONFIG;
  const half = GRID * PITCH + ROAD / 2;
  const colliders = [];   // { minX, maxX, minZ, maxZ } building footprints
  const graph = { nodes: [], edges: [] };

  // --- ground: grass base, sand beach to the south, sea beyond it.
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(half * 2 + 260, half * 2 + 260),
    new THREE.MeshLambertMaterial({ color: 0x5d8a4a }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, -0.05, 40);
  scene.add(ground);
  const sand = new THREE.Mesh(
    new THREE.PlaneGeometry(half * 2 + 260, 46),
    new THREE.MeshLambertMaterial({ color: 0xdcc78f }),
  );
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(0, 0.0, -half - 20);
  scene.add(sand);
  const sea = new THREE.Mesh(
    new THREE.PlaneGeometry(half * 2 + 260, 220),
    new THREE.MeshLambertMaterial({ color: 0x2a6f9e }),
  );
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(0, -0.4, -half - 150);
  scene.add(sea);

  // --- roads: one strip per road line, both directions, plus intersections.
  const roadTex = roadTexture();
  const roadMat = new THREE.MeshLambertMaterial({ map: roadTex });
  const walkMat = new THREE.MeshLambertMaterial({ color: 0x9a938a });
  for (let k = -GRID; k <= GRID; k++) {
    for (const horiz of [true, false]) {
      const len = half * 2 + ROAD;
      const strip = new THREE.Mesh(new THREE.PlaneGeometry(len, ROAD), roadMat);
      strip.rotation.x = -Math.PI / 2;
      if (horiz) strip.rotation.z = Math.PI / 2;
      strip.position.set(horiz ? 0 : k * PITCH, 0.02, horiz ? k * PITCH : 0);
      // repeat the dash texture along the strip
      const tex = roadTex.clone();
      tex.needsUpdate = true;
      tex.repeat.set(1, len / 58);
      strip.material = new THREE.MeshLambertMaterial({ map: tex });
      scene.add(strip);
      // sidewalks flanking the road
      for (const s of [-1, 1]) {
        const walk = new THREE.Mesh(new THREE.PlaneGeometry(len, 3), walkMat);
        walk.rotation.x = -Math.PI / 2;
        if (horiz) walk.rotation.z = Math.PI / 2;
        walk.position.set(
          horiz ? s * (ROAD / 2 + 1.5) : k * PITCH + s * (ROAD / 2 + 1.5),
          0.03,
          horiz ? k * PITCH : s * (ROAD / 2 + 1.5),
        );
        scene.add(walk);
      }
    }
  }

  // --- road graph: a node per intersection, edges between neighbours.
  const nodeAt = (i, j) => i * (2 * GRID + 1) + (j + GRID);
  for (let i = -GRID; i <= GRID; i++) {
    for (let j = -GRID; j <= GRID; j++) {
      graph.nodes.push({ x: i * PITCH, z: j * PITCH });
    }
  }
  const id = (i, j) => (i + GRID) * (2 * GRID + 1) + (j + GRID);
  for (let i = -GRID; i <= GRID; i++) {
    for (let j = -GRID; j <= GRID; j++) {
      if (i < GRID) graph.edges.push([id(i, j), id(i + 1, j)]);
      if (j < GRID) graph.edges.push([id(i, j), id(i, j + 1)]);
    }
  }
  graph.neighbours = graph.nodes.map(() => []);
  for (const [a, b] of graph.edges) {
    graph.neighbours[a].push(b);
    graph.neighbours[b].push(a);
  }

  // --- buildings: one or two per block, taller toward the centre.
  const palette = ['#e8dcc8', '#d9a06b', '#c97e6d', '#8fa8b8', '#b8b0a0', '#e0b56a', '#a8c0a0'];
  const facades = palette.map((c) => facadeTexture(c, '#ffd98a', rng));
  const buildingGeo = new THREE.BoxGeometry(1, 1, 1);
  buildingGeo.translate(0, 0.5, 0);
  const roofMat = new THREE.MeshLambertMaterial({ color: 0x4a4640 });
  const parkBlock = { i: -3, j: 2 };   // the green park
  const plazaBlock = { i: 2, j: -2 };  // open plaza with the gold sedan
  for (let i = -GRID; i < GRID; i++) {
    for (let j = -GRID; j < GRID; j++) {
      const cx = (i + 0.5) * PITCH;
      const cz = (j + 0.5) * PITCH;
      if (i === parkBlock.i && j === parkBlock.j) {
        const lawn = new THREE.Mesh(
          new THREE.PlaneGeometry(BLOCK, BLOCK),
          new THREE.MeshLambertMaterial({ color: 0x4e7d3a }),
        );
        lawn.rotation.x = -Math.PI / 2;
        lawn.position.set(cx, 0.04, cz);
        scene.add(lawn);
        continue;
      }
      if (i === plazaBlock.i && j === plazaBlock.j) {
        const stone = new THREE.Mesh(
          new THREE.PlaneGeometry(BLOCK, BLOCK),
          new THREE.MeshLambertMaterial({ color: 0xb0a894 }),
        );
        stone.rotation.x = -Math.PI / 2;
        stone.position.set(cx, 0.04, cz);
        scene.add(stone);
        continue;
      }
      const distCentre = Math.max(Math.abs(cx), Math.abs(cz));
      const tall = distCentre < 90;
      const count = rng() < 0.45 ? 1 : 2;
      for (let b = 0; b < count; b++) {
        const w = 12 + rng() * (count === 1 ? 20 : 8);
        const d = 12 + rng() * (count === 1 ? 20 : 8);
        const h = tall ? 18 + rng() * 30 : 8 + rng() * 14;
        const ox = count === 1 ? 0 : (b === 0 ? -w / 2 - 2 : w / 2 + 2);
        const oz = count === 1 ? 0 : (rng() - 0.5) * 8;
        const mat = new THREE.MeshLambertMaterial({ map: pick(rng, facades) });
        const m = new THREE.Mesh(buildingGeo, mat);
        m.scale.set(w, h, d);
        m.position.set(cx + ox, 0, cz + oz);
        m.castShadow = true; m.receiveShadow = true;
        scene.add(m);
        const roof = new THREE.Mesh(new THREE.BoxGeometry(w * 0.5, 1.2, d * 0.5), roofMat);
        roof.position.set(cx + ox, h + 0.6, cz + oz);
        scene.add(roof);
        colliders.push({
          minX: cx + ox - w / 2, maxX: cx + ox + w / 2,
          minZ: cz + oz - d / 2, maxZ: cz + oz + d / 2,
        });
      }
    }
  }

  // --- street lamps along every road, instanced for few draw calls.
  const lampPoleGeo = new THREE.CylinderGeometry(0.12, 0.16, 6, 6);
  const lampHeadGeo = new THREE.SphereGeometry(0.35, 8, 6);
  const lampPoleMat = new THREE.MeshLambertMaterial({ color: 0x2e3134 });
  const lampHeadMat = new THREE.MeshLambertMaterial({
    color: 0xffe9a8, emissive: 0xffdf8a, emissiveIntensity: 0.9,
  });
  const lampSpots = [];
  for (let k = -GRID; k <= GRID; k++) {
    for (let t = -half + 20; t < half - 10; t += 58) {
      lampSpots.push([k * PITCH + ROAD / 2 + 1, t]);
      lampSpots.push([t, k * PITCH - ROAD / 2 - 1]);
    }
  }
  const poles = new THREE.InstancedMesh(lampPoleGeo, lampPoleMat, lampSpots.length);
  const heads = new THREE.InstancedMesh(lampHeadGeo, lampHeadMat, lampSpots.length);
  const m4 = new THREE.Matrix4();
  lampSpots.forEach(([x, z], n) => {
    m4.makeTranslation(x, 3, z); poles.setMatrixAt(n, m4);
    m4.makeTranslation(x, 6.1, z); heads.setMatrixAt(n, m4);
  });
  scene.add(poles); scene.add(heads);

  // --- palm trees in the park and along the beach.
  const trunkGeo = new THREE.CylinderGeometry(0.18, 0.3, 5, 6);
  const crownGeo = new THREE.ConeGeometry(2.2, 3.2, 7);
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x7a5a38 });
  const crownMat = new THREE.MeshLambertMaterial({ color: 0x2f7d3a });
  const treeSpots = [];
  for (let n = 0; n < 16; n++) {
    treeSpots.push([
      (parkBlock.i + 0.5) * PITCH + (rng() - 0.5) * 34,
      (parkBlock.j + 0.5) * PITCH + (rng() - 0.5) * 34,
    ]);
  }
  for (let x = -half + 10; x < half; x += 24) treeSpots.push([x, -half - 8 + (rng() - 0.5) * 6]);
  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, treeSpots.length);
  const crowns = new THREE.InstancedMesh(crownGeo, crownMat, treeSpots.length);
  treeSpots.forEach(([x, z], n) => {
    m4.makeTranslation(x, 2.5, z); trunks.setMatrixAt(n, m4);
    m4.makeTranslation(x, 6.2, z); crowns.setMatrixAt(n, m4);
    colliders.push({ minX: x - 0.4, maxX: x + 0.4, minZ: z - 0.4, maxZ: z + 0.4 });
  });
  scene.add(trunks); scene.add(crowns);

  // Named places missions use (world coordinates). Every one sits ON a road
  // or in the open plaza, never inside a block where a building could stand
  // between the player and the marker.
  const places = {
    spawn: { x: 0, z: 58 },                                   // downtown start
    garage: { x: -232, z: 87 },                               // west road garage
    pier: { x: 87, z: -232 },                                 // south pier on the beach road
    safehouse: { x: 232, z: 145 },                            // east road safehouse
    docks: { x: -232, z: -203 },                              // south-west docks road
    plaza: { x: (plazaBlock.i + 0.5) * PITCH, z: (plazaBlock.j + 0.5) * PITCH },
    hospital: { x: 29, z: 232 },                              // north road hospital
    policeStation: { x: -29, z: 232 },                        // north road police station
  };
  return { colliders, graph, places, half };
}

// Push a circle (x, z, radius) out of every building box it overlaps.
// Returns true when a push happened.
export function resolveCircleCollision(pos, radius, colliders) {
  let hit = false;
  for (const b of colliders) {
    const cx = Math.max(b.minX, Math.min(pos.x, b.maxX));
    const cz = Math.max(b.minZ, Math.min(pos.z, b.maxZ));
    const dx = pos.x - cx, dz = pos.z - cz;
    const d2 = dx * dx + dz * dz;
    if (d2 < radius * radius) {
      hit = true;
      if (d2 > 1e-6) {
        const d = Math.sqrt(d2);
        pos.x = cx + (dx / d) * radius;
        pos.z = cz + (dz / d) * radius;
      } else {
        // centre inside the box: push out along the smallest penetration axis
        const pl = pos.x - b.minX, pr = b.maxX - pos.x;
        const pt = pos.z - b.minZ, pb = b.maxZ - pos.z;
        const m = Math.min(pl, pr, pt, pb);
        if (m === pl) pos.x = b.minX - radius;
        else if (m === pr) pos.x = b.maxX + radius;
        else if (m === pt) pos.z = b.minZ - radius;
        else pos.z = b.maxZ + radius;
      }
    }
  }
  return hit;
}

// Is a point on a road (within the asphalt, not on a block)?
export function onRoad(x, z) {
  const { PITCH, ROAD } = CONFIG;
  const fx = Math.abs(((x + PITCH / 2) % PITCH + PITCH) % PITCH - PITCH / 2);
  const fz = Math.abs(((z + PITCH / 2) % PITCH + PITCH) % PITCH - PITCH / 2);
  return fx < ROAD / 2 + 1 || fz < ROAD / 2 + 1;
}
