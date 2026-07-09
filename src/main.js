import * as THREE from "three";
import "./styles.css";
import { Input } from "./core/Input.js";
import { Player } from "./core/Player.js";
import { Sound } from "./core/Sound.js";
import { buildWorld } from "./scene/buildWorld.js";
import { Interactions } from "./game/Interactions.js";
import { Animations } from "./game/Animations.js";
import { Hud } from "./ui/Hud.js";

const canvas = document.querySelector("#game");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.98;
renderer.shadowMap.enabled = true;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(68, window.innerWidth / window.innerHeight, 0.05, 100);
const hud = new Hud();
const input = new Input({
  canvas,
  actionButton: document.querySelector("#mobile-action"),
  joystick: document.querySelector("#mobile-stick")
});
const player = new Player(camera, input);
const sound = new Sound();
const world = buildWorld(scene);
hud.setProgress(0, world.frames.length);
const interactions = new Interactions({ player, input, world, sound, hud });
const animations = new Animations(world, player, hud, scene);
const clock = new THREE.Clock();

setTimeout(() => {
  const wasGardenVisible = world.garden.visible;
  world.garden.visible = true;
  renderer.compile(scene, camera);
  world.garden.visible = wasGardenVisible;
}, 3500);

if (new URLSearchParams(window.location.search).get("preview") === "final") {
  document.querySelector("#start-screen").classList.add("hidden");
  world.door.userData.opening = true;
  world.door.userData.progress = 1;
  world.garden.visible = true;
  scene.background = new THREE.Color("#030714");
  scene.fog = new THREE.Fog("#050b16", 20, 82);
  player.bounds.minZ = world.unlockedEnd;
  player.position.set(0, 1.62, -61.4);
  player.enabled = true;
  hud.setProgress(world.frames.length, world.frames.length);
  hud.showFinal();
}

document.querySelector("#start-button").addEventListener("click", () => {
  document.querySelector("#start-screen").classList.add("hidden");
  sound.ensure();
  player.start();
});

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

function tick() {
  const delta = Math.min(clock.getDelta(), 0.05);
  const elapsed = clock.elapsedTime;
  player.update(delta);
  interactions.update(delta);
  animations.update(delta, elapsed);
  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}

tick();
