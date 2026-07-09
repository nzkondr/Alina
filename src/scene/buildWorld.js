import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { memories, misplacedDates } from "../config/memories.js";
import { makeTextTexture, makeWrappedTextTexture } from "../utils/textures.js";

const photoLoader = new THREE.TextureLoader();
const textureLoader = new THREE.TextureLoader();
const modelLoader = new GLTFLoader();
const hiddenModelParts = {
  "/models/table/scene.gltf": ["Environment"]
};
const corridorEnd = -58;
const unlockedEnd = -88;
const doorZ = corridorEnd - 0.05;
const gardenZ = corridorEnd - 12;

export function buildWorld(scene) {
  const interactables = [];
  const frames = [];
  const dissolvingWalls = [];
  const gifts = [];

  scene.background = new THREE.Color("#10131a");
  scene.fog = new THREE.Fog("#fff4df", 18, 58);

  const wallMaterial = makeTiledMaterial("/textures/wall-plaster.png", 18, 2.6, 0.82, {
    mirrored: true,
    emissiveIntensity: 0.11
  });
  const floorMaterial = makeTiledMaterial("/textures/floor-marble.png", 3.2, 28, 0.5);
  const ceilingMaterial = makeTiledMaterial("/textures/ceiling-texture.png", 4.6, 30, 0.88, {
    mirrored: true,
    emissiveIntensity: 0.22
  });

  const corridorCenter = (4 + corridorEnd) / 2;
  const corridorLength = Math.abs(4 - corridorEnd);
  addBox(scene, [0, -0.06, corridorCenter], [5.2, 0.12, corridorLength], floorMaterial);
  addBox(scene, [0, 3.15, corridorCenter], [5.2, 0.16, corridorLength], ceilingMaterial);
  addBox(scene, [-2.65, 1.5, corridorCenter], [0.16, 3.1, corridorLength], wallMaterial);
  addBox(scene, [2.65, 1.5, corridorCenter], [0.16, 3.1, corridorLength], wallMaterial);
  addBox(scene, [0, 1.5, 3.9], [5.2, 3.1, 0.18], wallMaterial);
  addDoorWall(scene, wallMaterial);

  const door = makeDoor();
  door.position.set(0, 1.34, doorZ);
  scene.add(door);

  const ambient = new THREE.HemisphereLight("#fff7e8", "#d6b894", 1.8);
  scene.add(ambient);

  for (let z = 0; z > corridorEnd; z -= 5.5) {
    const light = new THREE.PointLight("#ffdba6", 1.6, 9, 1.8);
    light.position.set(0, 2.75, z - 2);
    scene.add(light);
  }

  addCorridorDecor(scene);

  memories.forEach((memory) => {
    const sideSign = memory.side === "left" ? -1 : 1;
    const frame = makeFrame(memory);
    frame.group.position.set(sideSign * 2.54, 1.72, memory.z);
    frame.group.rotation.y = sideSign * -Math.PI / 2;
    scene.add(frame.group);
    frames.push(frame);

    const gift = makeGift(memory.gift);
    gift.position.set(sideSign * 5.1, 0.08, memory.z - 2.75);
    gift.rotation.y = sideSign * -Math.PI / 2;
    gift.visible = false;
    scene.add(gift);
    gifts.push(gift);

    const sideLight = new THREE.PointLight("#ffc98f", 0.55, 4, 2);
    sideLight.position.set(sideSign * 2.1, 2.2, memory.z);
    sideLight.intensity = 0;
    scene.add(sideLight);
    frame.glowLight = sideLight;
  });

  misplacedDates.forEach((dateItem) => {
    const plaque = makeDatePlaque(dateItem.date);
    plaque.position.set(...dateItem.position);
    plaque.rotation.x = -Math.PI / 2;
    plaque.userData = { type: "date", date: dateItem.date, placed: false };
    scene.add(plaque);
    interactables.push(plaque);
  });

  const garden = makeGarden();
  garden.position.set(0, 0, gardenZ);
  garden.visible = false;
  scene.add(garden);

  return { interactables, frames, dissolvingWalls, gifts, door, garden, unlockedEnd };
}

function addBox(scene, position, scale, material) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), material);
  mesh.position.set(...position);
  mesh.scale.set(...scale);
  mesh.receiveShadow = true;
  scene.add(mesh);
  return mesh;
}

function makeTiledMaterial(url, repeatX, repeatY, roughness, options = {}) {
  const texture = textureLoader.load(url);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = options.mirrored ? THREE.MirroredRepeatWrapping : THREE.RepeatWrapping;
  texture.wrapT = options.mirrored ? THREE.MirroredRepeatWrapping : THREE.RepeatWrapping;
  texture.repeat.set(repeatX, repeatY);
  texture.anisotropy = 8;
  return new THREE.MeshStandardMaterial({
    map: texture,
    roughness,
    color: options.color ?? "#ffffff",
    emissive: options.emissive ?? "#ffffff",
    emissiveIntensity: options.emissiveIntensity ?? 0
  });
}

const modelCache = new Map();

function loadNormalizedModel(url) {
  if (!modelCache.has(url)) {
    modelCache.set(url, modelLoader.loadAsync(url).then((gltf) => {
      const root = new THREE.Group();
      const model = gltf.scene;
      const hiddenParts = hiddenModelParts[url] ?? [];
      model.traverse((child) => {
        if (hiddenParts.some((name) => child.name?.includes(name))) {
          child.visible = false;
          return;
        }
        if (!child.isMesh) return;
        child.castShadow = true;
        child.receiveShadow = true;
      });

      const box = new THREE.Box3().setFromObject(model);
      const size = new THREE.Vector3();
      const center = new THREE.Vector3();
      box.getSize(size);
      box.getCenter(center);
      model.position.sub(center);
      root.add(model);
      root.userData.sourceHeight = size.y || 1;
      return root;
    }));
  }

  return modelCache.get(url);
}

function addModelInstance(parent, url, options) {
  const {
    position,
    height = 1,
    rotationY = 0,
    rotationX = 0,
    rotationZ = 0,
    wallSide = 0,
    wallInset = 0.1,
    visibleOnFail = null
  } = options;

  loadNormalizedModel(url).then((template) => {
    const model = template.clone(true);
    const sourceHeight = template.userData.sourceHeight || 1;
    model.scale.setScalar(height / sourceHeight);
    model.position.set(position[0], position[1] + height / 2, position[2]);
    model.rotation.set(rotationX, rotationY, rotationZ);
    if (wallSide !== 0) {
      model.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(model);
      const wallX = wallSide * (2.65 - wallInset);
      const edgeX = wallSide > 0 ? box.max.x : box.min.x;
      model.position.x += wallX - edgeX;
    }
    parent.add(model);
    if (visibleOnFail) visibleOnFail.visible = false;
  }).catch(() => {
    if (visibleOnFail) visibleOnFail.visible = true;
  });
}

function addCorridorDecor(scene) {
  const leftAlongWall = Math.PI / 2;
  const rightAlongWall = -Math.PI / 2;
  const leftWallFront = Math.PI;
  const rightWallFront = 0;

  addModelInstance(scene, "/models/hall-flower/scene.gltf", {
    position: [2.2, 0, -6.6],
    height: 1.58,
    rotationY: rightAlongWall,
    wallSide: 1
  });
  addModelInstance(scene, "/models/nightstand/scene.gltf", {
    position: [-2.2, 0, -13.9],
    height: 1.22,
    rotationY: leftWallFront + Math.PI,
    wallSide: -1
  });
  addModelInstance(scene, "/models/table/scene.gltf", {
    position: [2.2, 0, -21.8],
    height: 4.45,
    rotationY: rightAlongWall,
    wallSide: 1,
    wallInset: 0.03
  });
  addModelInstance(scene, "/models/bookshelf/scene.gltf", {
    position: [-2.2, 0, -30.2],
    height: 1.86,
    rotationY: leftAlongWall,
    wallSide: -1
  });
  addModelInstance(scene, "/models/hall-flower/scene.gltf", {
    position: [2.2, 0, -36.4],
    height: 1.38,
    rotationY: rightAlongWall,
    wallSide: 1
  });
  addModelInstance(scene, "/models/nightstand/scene.gltf", {
    position: [-2.2, 0, -43.8],
    height: 1.14,
    rotationY: leftWallFront + Math.PI,
    wallSide: -1
  });
  addModelInstance(scene, "/models/table/scene.gltf", {
    position: [2.2, 0, -51.2],
    height: 3.95,
    rotationY: rightAlongWall,
    wallSide: 1,
    wallInset: 0.03
  });
}

function addDrawerCabinet(scene, side, z) {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: "#f2eadc", roughness: 0.58 });
  const frontMat = new THREE.MeshStandardMaterial({ color: "#d9c8ad", roughness: 0.62 });
  const handleMat = new THREE.MeshStandardMaterial({ color: "#c4a05e", roughness: 0.36, metalness: 0.25 });
  const shadowMat = new THREE.MeshStandardMaterial({ color: "#bba98e", roughness: 0.7 });

  const body = new THREE.Mesh(new THREE.BoxGeometry(0.36, 1.02, 0.78), bodyMat);
  body.position.y = 0.51;
  group.add(body);

  const frontX = -side * 0.186;
  for (let i = 0; i < 3; i += 1) {
    const drawer = new THREE.Mesh(new THREE.BoxGeometry(0.024, 0.25, 0.68), frontMat);
    drawer.position.set(frontX, 0.3 + i * 0.29, 0);
    group.add(drawer);

    const handle = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.035, 0.22), handleMat);
    handle.position.set(frontX - side * 0.02, drawer.position.y + 0.02, -0.21);
    group.add(handle);
  }

  [-0.26, 0.26].forEach((offsetZ) => {
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.14, 0.07), shadowMat);
    foot.position.set(0, 0.07, offsetZ);
    group.add(foot);
  });

  placeWallDecor(scene, group, side, z, 0.18, 1.68);
}

function addPlantStand(scene, side, z, scale = 1) {
  const group = new THREE.Group();
  const black = new THREE.MeshStandardMaterial({ color: "#16130f", roughness: 0.42 });
  const ceramic = new THREE.MeshStandardMaterial({ color: "#fbf2e4", roughness: 0.5 });
  const stemMat = new THREE.MeshStandardMaterial({ color: "#567b4a", roughness: 0.7 });
  const pink = new THREE.MeshStandardMaterial({ color: "#f0b0bd", roughness: 0.48 });
  const cream = new THREE.MeshStandardMaterial({ color: "#fff0d4", roughness: 0.48 });

  const top = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.035, 32), black);
  top.position.y = 0.66;
  group.add(top);

  for (let i = 0; i < 4; i += 1) {
    const angle = i * Math.PI / 2 + Math.PI / 4;
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.64, 10), black);
    leg.position.set(Math.cos(angle) * 0.2, 0.33, Math.sin(angle) * 0.2);
    group.add(leg);
  }

  const vase = new THREE.Mesh(new THREE.SphereGeometry(0.14, 24, 16), ceramic);
  vase.scale.set(0.9, 1.18, 0.9);
  vase.position.y = 0.81;
  group.add(vase);

  for (let i = 0; i < 12; i += 1) {
    const angle = i * 0.78;
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.34, 6), stemMat);
    stem.position.set(Math.cos(angle) * 0.05, 1.0, Math.sin(angle) * 0.05);
    stem.rotation.z = THREE.MathUtils.randFloat(-0.28, 0.28);
    stem.rotation.x = THREE.MathUtils.randFloat(-0.18, 0.18);
    const bloom = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 8), i % 2 ? pink : cream);
    bloom.position.set(stem.position.x + Math.cos(angle) * 0.12, 1.18 + (i % 3) * 0.035, stem.position.z + Math.sin(angle) * 0.1);
    group.add(stem, bloom);
  }

  placeWallDecor(scene, group, side, z, 0.3, scale);
}

function addFloatingShelf(scene, side, z) {
  const group = new THREE.Group();
  const wood = new THREE.MeshStandardMaterial({ color: "#d5a14b", roughness: 0.45 });
  const darkWood = new THREE.MeshStandardMaterial({ color: "#a36b2e", roughness: 0.5 });
  const bookMats = ["#efd7b2", "#c8806d", "#819b78", "#e8efe0"].map((color) => (
    new THREE.MeshStandardMaterial({ color, roughness: 0.64 })
  ));

  const shelf = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.08, 1.05), wood);
  shelf.position.y = 1.04;
  group.add(shelf);

  const lip = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.08, 1.08), darkWood);
  lip.position.set(-side * 0.13, 1.08, 0);
  group.add(lip);

  for (let i = 0; i < 8; i += 1) {
    const book = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.28 + (i % 3) * 0.04, 0.055), bookMats[i % bookMats.length]);
    book.position.set(-side * 0.02, 1.24 + book.geometry.parameters.height / 2 - 0.14, -0.36 + i * 0.09);
    book.rotation.z = THREE.MathUtils.randFloat(-0.04, 0.04);
    group.add(book);
  }

  const smallPlant = new THREE.Mesh(
    new THREE.ConeGeometry(0.12, 0.28, 7),
    new THREE.MeshStandardMaterial({ color: "#668f52", roughness: 0.74 })
  );
  smallPlant.position.set(-side * 0.02, 1.32, 0.36);
  group.add(smallPlant);

  placeWallDecor(scene, group, side, z, 0.08, 1.72);
}

function addFloorPlanter(scene, side, z) {
  const group = new THREE.Group();
  const pot = new THREE.Mesh(
    new THREE.CylinderGeometry(0.18, 0.14, 0.28, 20),
    new THREE.MeshStandardMaterial({ color: "#f2e1c7", roughness: 0.58 })
  );
  pot.position.y = 0.14;
  group.add(pot);

  const leafMat = new THREE.MeshStandardMaterial({ color: "#6d9d5b", roughness: 0.78, side: THREE.DoubleSide });
  for (let i = 0; i < 10; i += 1) {
    const leaf = new THREE.Mesh(new THREE.PlaneGeometry(0.08, 0.34), leafMat);
    const angle = i * 0.7;
    leaf.position.set(Math.cos(angle) * 0.08, 0.42, Math.sin(angle) * 0.08);
    leaf.rotation.set(THREE.MathUtils.randFloat(-0.45, 0.45), angle, THREE.MathUtils.randFloat(-0.18, 0.18));
    group.add(leaf);
  }

  placeWallDecor(scene, group, side, z, 0.22, 1.72);
}

function placeWallDecor(scene, group, side, z, halfDepth, scale = 1) {
  group.scale.setScalar(scale);
  group.position.set(side * (2.63 - halfDepth * scale), 0, z);
  scene.add(group);
}

function addSideWallSegments(scene, x, sideMemories, material) {
  const openings = sideMemories
    .map((memory) => ({ start: memory.z - 1.55, end: memory.z - 3.95 }))
    .sort((a, b) => b.start - a.start);
  let cursor = 4;
  openings.forEach((opening) => {
    addWallSpan(scene, x, cursor, opening.start, material);
    cursor = opening.end;
  });
  addWallSpan(scene, x, cursor, corridorEnd, material);
}

function addWallSpan(scene, x, zA, zB, material) {
  const length = Math.abs(zA - zB);
  if (length < 0.2) return;
  addBox(scene, [x, 1.5, (zA + zB) / 2], [0.16, 3.1, length], material);
}

function addDoorWall(scene, material) {
  addBox(scene, [-2.05, 1.5, doorZ], [1.1, 3.1, 0.18], material);
  addBox(scene, [2.05, 1.5, doorZ], [1.1, 3.1, 0.18], material);
  addBox(scene, [0, 2.92, doorZ], [3.05, 0.38, 0.18], material);
}

function makeFrame(memory) {
  const group = new THREE.Group();
  const frameRoot = new THREE.Group();
  frameRoot.position.y = 0.24;
  group.add(frameRoot);

  const photoTexture = photoLoader.load(memory.photo);
  photoTexture.colorSpace = THREE.SRGBColorSpace;

  const glowMat = new THREE.MeshStandardMaterial({
    color: "#ffe6ba",
    emissive: "#ffbe73",
    emissiveIntensity: 0,
    roughness: 0.42
  });
  const backing = new THREE.Mesh(new THREE.BoxGeometry(1.28, 1.74, 0.08), glowMat);
  backing.position.z = -0.045;
  frameRoot.add(backing);

  const photo = new THREE.Mesh(
    new THREE.PlaneGeometry(0.96, 1.52),
    new THREE.MeshStandardMaterial({ map: photoTexture, roughness: 0.55 })
  );
  photo.position.z = 0.018;
  frameRoot.add(photo);

  const frameMat = new THREE.MeshStandardMaterial({ color: "#c9a96f", roughness: 0.28, metalness: 0.28 });
  const matBoardMat = new THREE.MeshStandardMaterial({ color: "#fff7ea", roughness: 0.68 });
  addMinimalPhotoFrame(frameRoot, frameMat, matBoardMat);

  const dateSlot = new THREE.Mesh(
    new THREE.BoxGeometry(1.34, 0.3, 0.045),
    new THREE.MeshStandardMaterial({ color: "#fff7ed", roughness: 0.64 })
  );
  dateSlot.position.set(0, -1.16, 0);
  group.add(dateSlot);

  const noteMaterial = new THREE.MeshStandardMaterial({
    map: makeWrappedTextTexture(memory.note, {
      width: 980,
      height: 460,
      background: "#fff6e7",
      color: "#3a2b1f",
      accent: "#c99748",
      font: "43px Georgia, 'Times New Roman', serif",
      lineHeight: 62,
      padding: 70,
      transparent: false,
      border: true
    }),
    transparent: true,
    opacity: 0,
    roughness: 0.66
  });
  const notePanel = new THREE.Mesh(new THREE.PlaneGeometry(1.72, 0.78), noteMaterial);
  notePanel.position.set(-1.65, 0.2, 0.028);
  notePanel.visible = false;
  notePanel.scale.setScalar(0.94);
  notePanel.userData = { progress: 0, revealing: false };
  group.add(notePanel);

  return {
    id: memory.id,
    date: memory.date,
    gift: memory.gift,
    group,
    dateSlot,
    notePanel,
    noteMaterial,
    glowMaterial: glowMat,
    placed: false
  };
}

function addMinimalPhotoFrame(group, frameMat, matBoardMat) {
  const matBoard = new THREE.Group();
  matBoard.add(makeFlatRail(matBoardMat, 0, 0.83, 1.26, 0.18, -0.002));
  matBoard.add(makeFlatRail(matBoardMat, 0, -0.83, 1.26, 0.18, -0.002));
  matBoard.add(makeFlatRail(matBoardMat, -0.62, 0, 0.14, 1.5, -0.002));
  matBoard.add(makeFlatRail(matBoardMat, 0.62, 0, 0.14, 1.5, -0.002));
  group.add(matBoard);

  const outer = new THREE.Group();
  outer.add(makeFrameRail(frameMat, 0, 0.95, 1.46, 0.1));
  outer.add(makeFrameRail(frameMat, 0, -0.95, 1.46, 0.1));
  outer.add(makeFrameRail(frameMat, -0.73, 0, 0.1, 1.9));
  outer.add(makeFrameRail(frameMat, 0.73, 0, 0.1, 1.9));
  outer.add(makeFlatRail(frameMat, 0, 0.79, 1.08, 0.035, 0.065));
  outer.add(makeFlatRail(frameMat, 0, -0.79, 1.08, 0.035, 0.065));
  outer.add(makeFlatRail(frameMat, -0.55, 0, 0.035, 1.54, 0.065));
  outer.add(makeFlatRail(frameMat, 0.55, 0, 0.035, 1.54, 0.065));
  group.add(outer);
}

function makeFrameRail(material, x, y, w, h) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.11), material);
  mesh.position.set(x, y, 0.035);
  return mesh;
}

function makeFlatRail(material, x, y, w, h, z) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.024), material);
  mesh.position.set(x, y, z);
  return mesh;
}

function makeDatePlaque(date) {
  return new THREE.Mesh(
    new THREE.BoxGeometry(1.05, 0.08, 0.35),
    new THREE.MeshStandardMaterial({
      map: makeTextTexture(date, {
        width: 700,
        height: 240,
        font: "58px Inter, Arial, sans-serif",
        background: "#ffe9c5",
        accent: "#cc9a5f"
      }),
      roughness: 0.5
    })
  );
}

function makeDissolvingWall(memory) {
  const group = new THREE.Group();
  const wall = new THREE.Mesh(
    new THREE.BoxGeometry(0.16, 3.1, 2.4),
    new THREE.MeshStandardMaterial({
      color: "#fbf6ee",
      transparent: true,
      opacity: 1,
      roughness: 0.72
    })
  );
  group.add(wall);
  group.userData = { memoryId: memory.id, progress: 0, opening: false, wall };

  const particles = new THREE.Group();
  for (let i = 0; i < 54; i += 1) {
    const particle = new THREE.Mesh(
      new THREE.SphereGeometry(0.025 + Math.random() * 0.035, 8, 8),
      new THREE.MeshBasicMaterial({ color: "#ffe3ae", transparent: true, opacity: 0 })
    );
    particle.position.set(
      0,
      THREE.MathUtils.randFloat(-1.45, 1.45),
      THREE.MathUtils.randFloat(-1.08, 1.08)
    );
    particle.userData.velocity = new THREE.Vector3(
      THREE.MathUtils.randFloat(-0.18, 0.18),
      THREE.MathUtils.randFloat(0.25, 0.9),
      THREE.MathUtils.randFloat(-0.42, 0.42)
    );
    particles.add(particle);
  }
  group.add(particles);
  group.userData.particles = particles;
  return group;
}

function makeDoor() {
  const group = new THREE.Group();
  const left = makeDoorLeaf(-1);
  const right = makeDoorLeaf(1);
  left.position.x = -0.05;
  right.position.x = 0.05;
  group.add(left, right);

  const header = new THREE.Mesh(
    new THREE.BoxGeometry(3.05, 0.16, 0.16),
    new THREE.MeshStandardMaterial({ color: "#c8b086", metalness: 0.25, roughness: 0.28 })
  );
  header.position.set(0, 1.42, 0);
  group.add(header);

  group.userData = { opening: false, progress: 0, left, right };
  return group;
}

function makeDoorLeaf(side) {
  const pivot = new THREE.Group();
  const leaf = new THREE.Group();
  leaf.position.x = side * 0.62;
  pivot.add(leaf);

  const metal = new THREE.MeshStandardMaterial({ color: "#c8b086", metalness: 0.45, roughness: 0.2 });
  const glass = new THREE.MeshPhysicalMaterial({
    color: "#eaf8ff",
    transparent: true,
    opacity: 0.32,
    roughness: 0.04,
    metalness: 0,
    transmission: 0.2
  });

  leaf.add(makeDoorRail(metal, 0, 0, 0.08, 2.66, 0.08));
  leaf.add(makeDoorRail(metal, side * -0.62, 0, 0.08, 2.66, 0.08));
  leaf.add(makeDoorRail(metal, side * -0.31, 1.29, 0.7, 0.08, 0.08));
  leaf.add(makeDoorRail(metal, side * -0.31, -1.29, 0.7, 0.08, 0.08));

  const pane = new THREE.Mesh(new THREE.BoxGeometry(0.54, 2.24, 0.035), glass);
  pane.position.set(side * -0.31, 0, 0.01);
  leaf.add(pane);

  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.38, 16), metal);
  handle.rotation.x = Math.PI / 2;
  handle.position.set(side * -0.12, 0.02, 0.09);
  leaf.add(handle);
  return pivot;
}

function makeDoorRail(material, x, y, w, h, d) {
  const rail = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  rail.position.set(x, y, 0);
  return rail;
}

function makeGift(kind) {
  const group = new THREE.Group();
  if (kind === "flowers") {
    for (let i = 0; i < 9; i += 1) {
      const stem = new THREE.Mesh(
        new THREE.CylinderGeometry(0.015, 0.015, 0.85, 8),
        new THREE.MeshStandardMaterial({ color: "#5e9b68" })
      );
      stem.rotation.z = THREE.MathUtils.randFloat(-0.35, 0.35);
      stem.position.set((i - 4) * 0.07, 0.4, Math.sin(i) * 0.06);
      const bloom = new THREE.Mesh(
        new THREE.SphereGeometry(0.105, 16, 12),
        new THREE.MeshStandardMaterial({ color: i % 2 ? "#e77387" : "#f4c35f", roughness: 0.4 })
      );
      bloom.position.set(stem.position.x + stem.rotation.z * 0.34, 0.86, stem.position.z);
      group.add(stem, bloom);
    }
  } else if (kind === "perfume") {
    group.add(new THREE.Mesh(
      new THREE.BoxGeometry(0.58, 0.78, 0.32),
      new THREE.MeshPhysicalMaterial({ color: "#f4d0c9", transmission: 0.25, roughness: 0.08, metalness: 0.05 })
    ));
    const cap = new THREE.Mesh(
      new THREE.BoxGeometry(0.28, 0.18, 0.24),
      new THREE.MeshStandardMaterial({ color: "#d6b06d", metalness: 0.4, roughness: 0.22 })
    );
    cap.position.y = 0.48;
    group.add(cap);
  } else {
    const table = new THREE.Mesh(
      new THREE.CylinderGeometry(0.58, 0.58, 0.08, 36),
      new THREE.MeshStandardMaterial({ color: "#f5eee4", roughness: 0.45 })
    );
    table.position.y = 0.55;
    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.1, 0.62, 16),
      new THREE.MeshStandardMaterial({ color: "#9c785a", roughness: 0.4 })
    );
    base.position.y = 0.25;
    const candle = new THREE.PointLight("#ffc478", 1.2, 3, 2);
    candle.position.set(0, 0.85, 0);
    group.add(table, base, candle);
  }
  group.scale.setScalar(1.35);
  return group;
}

function makeSoftSkyTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext("2d");

  const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
  gradient.addColorStop(0, "#030714");
  gradient.addColorStop(0.52, "#08142a");
  gradient.addColorStop(1, "#101f33");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.globalAlpha = 0.32;
  ctx.fillStyle = "#ffffff";
  for (let i = 0; i < 90; i += 1) {
    const x = (i * 157) % canvas.width;
    const y = 34 + ((i * 83) % 250);
    const radius = 0.7 + (i % 3) * 0.35;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  return texture;
}

function makeGarden() {
  const group = new THREE.Group();
  const skyTexture = makeSoftSkyTexture();
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(64, 36, 18),
    new THREE.MeshBasicMaterial({
      map: skyTexture,
      side: THREE.BackSide,
      color: "#ffffff"
    })
  );
  sky.material.fog = false;
  sky.position.set(0, 7, -7);
  sky.rotation.y = Math.PI * 0.18;
  group.add(sky);

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(42, 42, 1, 1),
    makeTiledMaterial("/textures/grass-photo.png", 10, 10, 0.78, {
      color: "#445a36",
      emissive: "#0b1409",
      emissiveIntensity: 0.08
    })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.z = -8;
  group.add(ground);
  addOutdoorFlowers(group);
  addGardenModelScatter(group);
  addGardenLanterns(group);

  const fallbackBench = new THREE.Group();
  const benchSeat = new THREE.Mesh(
    new THREE.BoxGeometry(2.4, 0.16, 0.5),
    new THREE.MeshStandardMaterial({ color: "#a87552", roughness: 0.55 })
  );
  benchSeat.position.set(0, 0.55, -2.8);
  const benchBack = benchSeat.clone();
  benchBack.position.set(0, 0.95, -3.02);
  benchBack.scale.z = 0.35;
  fallbackBench.add(benchSeat, benchBack);
  group.add(fallbackBench);
  addBenchModel(group, fallbackBench);

  const light = new THREE.DirectionalLight("#7d96c4", 0.16);
  light.position.set(-3, 7, 3);
  group.add(light);

  return group;
}

function addGardenLanterns(group) {
  const lanternSpots = [
    [-4.2, -3.8, 0.25],
    [4.2, -3.9, -0.25],
    [-7.6, -9.4, 0.55],
    [7.6, -9.2, -0.55],
    [-4.8, -16.6, 0.35],
    [4.8, -16.2, -0.35]
  ];

  lanternSpots.forEach(([x, z, rotationY], index) => {
    addModelInstance(group, "/models/lantern/scene.gltf", {
      position: [x, 0, z],
      height: 2.85,
      rotationY
    });

    const glow = new THREE.PointLight("#ffd18a", 1.35, 7.2, 2.1);
    glow.position.set(x, 2.1, z);
    group.add(glow);

    const bulb = new THREE.Mesh(
      new THREE.SphereGeometry(0.08, 16, 12),
      new THREE.MeshBasicMaterial({
        color: index % 2 ? "#ffd28b" : "#ffe0a8",
        transparent: true,
        opacity: 0.72
      })
    );
    bulb.position.copy(glow.position);
    group.add(bulb);
  });
}

function addOutdoorFlowers(group) {
  const flowerSpots = [
    [-5.8, -6.5, 0.5, 0.46],
    [-2.6, -12.4, 2.4, 0.5],
    [1.2, -6.2, 2.1, 0.48],
    [4.8, -8.7, 0.3, 0.52],
    [-7.0, -11.2, -1.9, 0.4],
    [3.2, -14.5, 2.6, 0.41]
  ];

  flowerSpots.forEach(([x, z, rotationSeed, height]) => {
    addModelInstance(group, "/models/outdoor-flower/scene.gltf", {
      position: [x, 0, z],
      height,
      rotationY: rotationSeed
    });
  });
}

function addGardenModelScatter(group) {
  const scatteredModels = [
    {
      url: "/models/garden-flowers/scene.gltf",
      spots: [
        [-7.5, -3.2, 0.2, 0.64],
        [-5.6, -9.4, 1.8, 0.52],
        [-6.9, -15.6, 2.7, 0.7],
        [-2.8, -17.8, 0.9, 0.58],
        [2.4, -16.1, 2.2, 0.66],
        [6.8, -14.4, 3.4, 0.56],
        [7.5, -6.8, 1.2, 0.62],
        [3.8, -2.9, 2.9, 0.5]
      ]
    },
    {
      url: "/models/verbena-flower/scene.gltf",
      spots: [
        [-8.2, -6.1, 2.1, 0.42],
        [-6.1, -12.8, 0.6, 0.5],
        [-3.3, -5.1, 3.2, 0.38],
        [-0.9, -18.4, 1.1, 0.46],
        [1.6, -4.4, 2.6, 0.4],
        [4.6, -10.7, 0.4, 0.52],
        [7.9, -17.2, 2.3, 0.44],
        [8.3, -3.5, 1.7, 0.48]
      ]
    },
    {
      url: "/models/heart-in-love/scene.gltf",
      spots: [
        [-4.8, -4.1, 0.45, 0.72],
        [-7.8, -13.9, 2.15, 0.66],
        [0.8, -15.2, 3.35, 0.82],
        [5.6, -5.5, 1.2, 0.68],
        [7.2, -12.4, 2.7, 0.76],
        [-8.4, -6.8, 1.6, 0.62],
        [-3.4, -10.9, 2.95, 0.74],
        [3.7, -9.9, 0.35, 0.72],
        [8.3, -17.7, 2.2, 0.7],
        [-0.9, -4.8, 3.85, 0.64]
      ]
    },
    {
      url: "/models/pumping-heart/scene.gltf",
      spots: [
        [-1.8, -7.4, 0.8, 0.62],
        [-5.1, -18.2, 2.9, 0.7],
        [3.1, -13.7, 1.6, 0.66],
        [6.1, -8.1, 3.6, 0.6],
        [-7.0, -3.9, 2.35, 0.58],
        [-2.9, -16.6, 0.55, 0.64],
        [2.1, -5.9, 2.65, 0.58],
        [7.7, -14.9, 1.1, 0.68]
      ]
    }
  ];

  scatteredModels.forEach(({ url, spots }) => {
    spots.forEach(([x, z, rotationY, height]) => {
      addModelInstance(group, url, {
        position: [x, 0, z],
        height,
        rotationY
      });
    });
  });
}

function addBenchModel(group, fallbackBench) {
  modelLoader.loadAsync("/models/bench/scene.gltf").then((gltf) => {
    const model = gltf.scene;
    model.traverse((child) => {
      if (!child.isMesh) return;
      child.castShadow = true;
      child.receiveShadow = true;
    });

    const box = new THREE.Box3().setFromObject(model);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);
    model.position.sub(center);
    model.scale.setScalar(2.6 / Math.max(size.x, size.z));
    model.position.set(0, 0.65, -2.85);
    model.rotation.y = 0;
    group.add(model);
    fallbackBench.visible = false;
  }).catch(() => {
    fallbackBench.visible = true;
  });
}
