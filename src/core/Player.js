import * as THREE from "three";

const forward = new THREE.Vector3();
const right = new THREE.Vector3();

export class Player {
  constructor(camera, input) {
    this.camera = camera;
    this.input = input;
    this.position = new THREE.Vector3(0, 1.62, 1.8);
    this.yaw = 0;
    this.pitch = 0;
    this.speed = 3.6;
    this.enabled = false;
    this.bounds = { minX: -2.15, maxX: 2.15, minZ: -57, maxZ: 2.2 };
  }

  start() {
    this.enabled = true;
    if (!matchMedia("(hover: none), (pointer: coarse)").matches) {
      this.input.canvas.requestPointerLock?.();
    }
  }

  rotate(dx, dy) {
    this.yaw += dx;
    this.pitch = THREE.MathUtils.clamp(this.pitch + dy, -0.72, 0.72);
  }

  update(delta) {
    if (!this.enabled) return;

    const look = this.input.consumeLookDelta();
    this.rotate(look.x * -0.0022, look.y * -0.0022);

    forward.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw)).normalize();
    right.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw)).normalize();

    const move = new THREE.Vector3();
    const movement = this.input.getMoveVector();
    move.addScaledVector(forward, movement.y);
    move.addScaledVector(right, movement.x);

    if (move.lengthSq() > 0) {
      move.normalize().multiplyScalar(this.speed * delta);
      this.position.add(move);
    }

    this.position.x = THREE.MathUtils.clamp(this.position.x, this.bounds.minX, this.bounds.maxX);
    this.position.z = THREE.MathUtils.clamp(this.position.z, this.bounds.minZ, this.bounds.maxZ);

    this.camera.position.copy(this.position);
    this.camera.rotation.order = "YXZ";
    this.camera.rotation.y = this.yaw;
    this.camera.rotation.x = this.pitch;
  }
}
